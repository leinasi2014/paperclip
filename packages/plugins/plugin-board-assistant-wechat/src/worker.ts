import { createHash, createHmac } from "node:crypto";
import {
  definePlugin,
  runWorker,
  type PluginContext,
} from "@paperclipai/plugin-sdk";
import {
  ILinkClient,
  MessageItemType,
  loginWithQR,
} from "weixin-ilink";
import type { GetUpdatesResp, LoginCallbacks, MessageItem, WeixinMessage } from "weixin-ilink";

type WechatPluginConfig = {
  enabled?: boolean;
  paperclipBaseUrl?: string;
  channelSecretRef?: string;
  botTokenSecretRef?: string;
  ilinkBaseUrl?: string;
  enableQrLogin?: boolean;
  longPollTimeoutMs?: number;
  apiTimeoutMs?: number;
};

type WechatAuthState = {
  token: string | null;
  baseUrl: string;
  accountId: string | null;
  userId: string | null;
  source: "config" | "qr" | null;
  qrCodeUrl: string | null;
  loginStatus: "idle" | "waiting" | "scanned" | "expired" | "refreshing" | "ready";
  loginStartedAt: string | null;
  loggedInAt: string | null;
};

type ThreadContext = {
  externalUserId: string;
  externalThreadId: string;
  contextToken: string;
  updatedAt: string;
};

type WechatPluginState = {
  version: 1;
  auth: WechatAuthState;
  cursor: string;
  threadContexts: Record<string, ThreadContext>;
  lastPollAt: string | null;
  lastOutboxAt: string | null;
  lastHealthPingAt: string | null;
  lastError: string | null;
};

type OutboxItem = {
  id: string;
  externalUserId: string;
  externalThreadId: string;
  checkpointKind: string;
  payload: Record<string, unknown>;
};

const STATE_NAMESPACE = "wechat";
const STATE_KEY = "channel-state";
const JOB_KEY = "sync";
const CHANNEL = "wechat";
const LOGIN_STALE_MS = 10 * 60 * 1000;
const CONTEXT_MAX_ENTRIES = 200;
const BINDING_TOKEN_PATTERN = /pcp_ba_bind_[a-f0-9]+/i;

let syncInFlight = false;

function createInitialState(): WechatPluginState {
  return {
    version: 1,
    auth: {
      token: null,
      baseUrl: "https://ilinkai.weixin.qq.com",
      accountId: null,
      userId: null,
      source: null,
      qrCodeUrl: null,
      loginStatus: "idle",
      loginStartedAt: null,
      loggedInAt: null,
    },
    cursor: "",
    threadContexts: {},
    lastPollAt: null,
    lastOutboxAt: null,
    lastHealthPingAt: null,
    lastError: null,
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getTextFromItem(item: MessageItem) {
  if (item.type === MessageItemType.TEXT) return item.text_item?.text?.trim() ?? "";
  if (item.type === MessageItemType.VOICE) return item.voice_item?.text?.trim() ?? "[语音]";
  if (item.type === MessageItemType.IMAGE) return "[图片]";
  if (item.type === MessageItemType.FILE) return `[文件] ${item.file_item?.file_name ?? ""}`.trim();
  if (item.type === MessageItemType.VIDEO) return "[视频]";
  return "";
}

function extractMessageText(message: WeixinMessage) {
  return (message.item_list ?? [])
    .map(getTextFromItem)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractBindingToken(messageText: string) {
  const match = messageText.match(BINDING_TOKEN_PATTERN);
  return match?.[0] ?? null;
}

function getThreadId(message: WeixinMessage) {
  return message.session_id?.trim()
    || message.group_id?.trim()
    || message.from_user_id?.trim()
    || `wechat-${message.message_id ?? message.client_id ?? Date.now()}`;
}

function getMessageId(message: WeixinMessage) {
  return String(message.message_id ?? message.client_id ?? message.seq ?? Date.now());
}

function getMessageTimestamp(message: WeixinMessage) {
  return message.create_time_ms ? new Date(message.create_time_ms).toISOString() : new Date().toISOString();
}

function getThreadContextKey(externalUserId: string, externalThreadId: string) {
  return `${externalUserId}::${externalThreadId}`;
}

function pruneContexts(threadContexts: Record<string, ThreadContext>) {
  const entries = Object.entries(threadContexts).sort((a, b) => {
    return Date.parse(b[1].updatedAt) - Date.parse(a[1].updatedAt);
  });
  return Object.fromEntries(entries.slice(0, CONTEXT_MAX_ENTRIES));
}

function buildBodyHash(messageText: string, normalizedPayload: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify({ messageText, normalizedPayload }))
    .digest("hex");
}

function buildIngressSignature(secret: string, input: {
  externalUserId: string;
  externalThreadId: string;
  externalMessageId: string;
  timestamp: string;
  messageText: string;
  normalizedPayload: Record<string, unknown>;
}) {
  const payload = [
    CHANNEL,
    input.externalUserId,
    input.externalThreadId,
    input.externalMessageId,
    input.timestamp,
    buildBodyHash(input.messageText, input.normalizedPayload),
  ].join(":");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function buildOutboundText(payload: Record<string, unknown>) {
  const baseText = asString(payload.text) ?? "Board Assistant 有新的更新。";
  const card = payload.card;
  if (!card || typeof card !== "object" || Array.isArray(card)) return baseText;
  const record = card as Record<string, unknown>;
  const lines = [baseText];
  const pushLine = (label: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) lines.push(`${label}：${value.trim()}`);
    if (Array.isArray(value) && value.length > 0) {
      lines.push(`${label}：${value.map((item) => String(item)).join("；")}`);
    }
  };
  pushLine("任务", record.task);
  pushLine("目标", record.target);
  pushLine("建议动作", record.suggestedAction);
  pushLine("风险等级", record.riskLevel);
  pushLine("执行方式", record.executionMode);
  pushLine("理解依据", record.rationale);
  pushLine("待确认", record.pendingConfirmation);
  pushLine("预期产出", record.expectedOutput);
  return lines.join("\n");
}

async function readState(ctx: PluginContext) {
  const state = await ctx.state.get({
    scopeKind: "instance",
    namespace: STATE_NAMESPACE,
    stateKey: STATE_KEY,
  });
  return state && typeof state === "object" ? state as WechatPluginState : createInitialState();
}

async function writeState(ctx: PluginContext, state: WechatPluginState) {
  await ctx.state.set({
    scopeKind: "instance",
    namespace: STATE_NAMESPACE,
    stateKey: STATE_KEY,
  }, state);
}

async function resolveConfig(ctx: PluginContext) {
  const raw = await ctx.config.get() as WechatPluginConfig;
  const paperclipBaseUrl = (raw.paperclipBaseUrl ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
  const channelSecretRef = asString(raw.channelSecretRef);
  const botTokenSecretRef = asString(raw.botTokenSecretRef);
  const [channelSecret, configuredToken] = await Promise.all([
    channelSecretRef ? ctx.secrets.resolve(channelSecretRef) : Promise.resolve(""),
    botTokenSecretRef ? ctx.secrets.resolve(botTokenSecretRef) : Promise.resolve(""),
  ]);
  return {
    enabled: raw.enabled === true,
    paperclipBaseUrl,
    channelSecret,
    configuredToken: configuredToken || null,
    ilinkBaseUrl: raw.ilinkBaseUrl ?? "https://ilinkai.weixin.qq.com",
    enableQrLogin: raw.enableQrLogin !== false,
    longPollTimeoutMs: raw.longPollTimeoutMs ?? 35000,
    apiTimeoutMs: raw.apiTimeoutMs ?? 15000,
  };
}

function createClient(config: Awaited<ReturnType<typeof resolveConfig>>, state: WechatPluginState) {
  const token = config.configuredToken ?? state.auth.token;
  if (!token) return null;
  return new ILinkClient({
    baseUrl: state.auth.baseUrl || config.ilinkBaseUrl,
    token,
    longPollTimeoutMs: config.longPollTimeoutMs,
    apiTimeoutMs: config.apiTimeoutMs,
    channelVersion: "paperclip-wechat/0.1.0",
  });
}

async function postJson(ctx: PluginContext, url: string, init: RequestInit) {
  const response = await ctx.http.fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response;
}

async function ingestMessages(
  ctx: PluginContext,
  config: Awaited<ReturnType<typeof resolveConfig>>,
  state: WechatPluginState,
  updates: GetUpdatesResp,
) {
  const messages = updates.msgs ?? [];
  for (const message of messages) {
    const externalUserId = asString(message.from_user_id);
    const contextToken = asString(message.context_token);
    if (!externalUserId || !contextToken) continue;
    if (message.message_type && message.message_type !== 1) continue;
    const externalThreadId = getThreadId(message);
    const messageText = extractMessageText(message);
    const bindingToken = extractBindingToken(messageText);
    const normalizedPayload = {
      contextToken,
      sessionId: message.session_id ?? null,
      groupId: message.group_id ?? null,
      clientId: message.client_id ?? null,
      messageType: message.message_type ?? null,
      messageState: message.message_state ?? null,
      itemList: message.item_list ?? [],
    };
    const timestamp = getMessageTimestamp(message);
    const externalMessageId = getMessageId(message);
    const ingressSignature = buildIngressSignature(config.channelSecret, {
      externalUserId,
      externalThreadId,
      externalMessageId,
      timestamp,
      messageText,
      normalizedPayload,
    });
    await postJson(ctx, `${config.paperclipBaseUrl}/api/board-assistant/channel/ingress`, {
      method: "POST",
      body: JSON.stringify({
        channel: CHANNEL,
        externalUserId,
        externalThreadId,
        externalMessageId,
        timestamp,
        messageText,
        normalizedPayload,
        ...(bindingToken ? { bindingToken } : {}),
        ingressSignature,
      }),
    });
    state.threadContexts[getThreadContextKey(externalUserId, externalThreadId)] = {
      externalUserId,
      externalThreadId,
      contextToken,
      updatedAt: new Date().toISOString(),
    };
  }
  state.threadContexts = pruneContexts(state.threadContexts);
}

async function flushOutbox(
  ctx: PluginContext,
  config: Awaited<ReturnType<typeof resolveConfig>>,
  state: WechatPluginState,
  client: ILinkClient,
) {
  const response = await postJson(
    ctx,
    `${config.paperclipBaseUrl}/api/board-assistant/channel/outbox?channel=${CHANNEL}`,
    {
      method: "GET",
      headers: {
        "x-board-assistant-channel-secret": config.channelSecret,
      },
    },
  );
  const items = await response.json() as OutboxItem[];
  for (const item of items) {
    const context = state.threadContexts[getThreadContextKey(item.externalUserId, item.externalThreadId)];
    let sent = false;
    try {
      if (!context?.contextToken) {
        throw new Error(`Missing context token for ${item.externalUserId}/${item.externalThreadId}`);
      }
      const text = buildOutboundText(item.payload);
      await client.sendTextChunked(item.externalUserId, text, context.contextToken, 1800);
      sent = true;
      await ctx.metrics.write("wechat_outbox_sent", 1, { checkpointKind: item.checkpointKind });
    } catch (error) {
      ctx.logger.warn("Failed to deliver board assistant outbox item", {
        outboxId: item.id,
        error: String(error),
      });
    }
    await postJson(
      ctx,
      `${config.paperclipBaseUrl}/api/board-assistant/channel/outbox/${item.id}/ack?channel=${CHANNEL}`,
      {
        method: "POST",
        headers: {
          "x-board-assistant-channel-secret": config.channelSecret,
        },
        body: JSON.stringify({ sent }),
      },
    );
  }
}

async function pingHealth(ctx: PluginContext, config: Awaited<ReturnType<typeof resolveConfig>>) {
  await postJson(ctx, `${config.paperclipBaseUrl}/api/board-assistant/channel/health?channel=${CHANNEL}`, {
    method: "POST",
    headers: {
      "x-board-assistant-channel-secret": config.channelSecret,
    },
  });
}

async function maybeBootstrapQrLogin(
  ctx: PluginContext,
  config: Awaited<ReturnType<typeof resolveConfig>>,
  state: WechatPluginState,
) {
  if (config.configuredToken || state.auth.token || !config.enableQrLogin) return state;
  const startedAt = state.auth.loginStartedAt ? Date.parse(state.auth.loginStartedAt) : 0;
  if (state.auth.loginStatus !== "idle" && Date.now() - startedAt < LOGIN_STALE_MS) {
    return state;
  }

  state.auth.loginStartedAt = new Date().toISOString();
  state.auth.loginStatus = "refreshing";
  await writeState(ctx, state);

  try {
    const callbacks: LoginCallbacks = {
      onQRCode: async (url: string) => {
        state.auth.qrCodeUrl = url;
        state.auth.loginStatus = "waiting";
        await writeState(ctx, state);
      },
      onStatusChange: async (status) => {
        state.auth.loginStatus = status;
        await writeState(ctx, state);
      },
    };
    const login = await loginWithQR(callbacks, config.ilinkBaseUrl);
    state.auth = {
      token: login.botToken,
      baseUrl: login.baseUrl,
      accountId: login.accountId,
      userId: login.userId ?? null,
      source: "qr",
      qrCodeUrl: null,
      loginStatus: "ready",
      loginStartedAt: null,
      loggedInAt: new Date().toISOString(),
    };
    await writeState(ctx, state);
    await ctx.activity.log({
      companyId: "system",
      message: "Board Assistant WeChat QR login completed",
      entityType: "plugin",
      metadata: { channel: CHANNEL, accountId: login.accountId },
    }).catch(() => undefined);
  } catch (error) {
    state.lastError = String(error);
    state.auth.loginStatus = "expired";
    state.auth.loginStartedAt = null;
    await writeState(ctx, state);
    ctx.logger.warn("WeChat QR login failed", { error: String(error) });
  }
  return state;
}

async function runSync(ctx: PluginContext) {
  if (syncInFlight) {
    ctx.logger.debug("WeChat sync skipped because a previous run is still active");
    return;
  }
  syncInFlight = true;
  try {
    const config = await resolveConfig(ctx);
    if (!config.enabled) return;
    if (!config.channelSecret) {
      ctx.logger.warn("WeChat sync skipped because channel secret is not configured");
      return;
    }

    let state = await readState(ctx);
    state.auth.baseUrl = state.auth.baseUrl || config.ilinkBaseUrl;
    if (config.configuredToken) {
      state.auth.token = config.configuredToken;
      state.auth.baseUrl = config.ilinkBaseUrl;
      state.auth.source = "config";
      state.auth.loginStatus = "ready";
      if (!state.auth.loggedInAt) state.auth.loggedInAt = new Date().toISOString();
    } else {
      state = await maybeBootstrapQrLogin(ctx, config, state);
    }

    const client = createClient(config, state);
    if (!client) {
      await writeState(ctx, state);
      return;
    }

    client.cursor = state.cursor;
    const updates = await client.poll();
    state.cursor = client.cursor;
    state.lastPollAt = new Date().toISOString();
    state.lastError = null;
    await ingestMessages(ctx, config, state, updates);
    await flushOutbox(ctx, config, state, client);
    await pingHealth(ctx, config);
    state.lastOutboxAt = new Date().toISOString();
    state.lastHealthPingAt = new Date().toISOString();
    await writeState(ctx, state);
  } catch (error) {
    const state = await readState(ctx);
    state.lastError = String(error);
    await writeState(ctx, state);
    ctx.logger.error("WeChat sync failed", { error: String(error) });
    await ctx.metrics.write("wechat_sync_failures", 1, { channel: CHANNEL }).catch(() => undefined);
  } finally {
    syncInFlight = false;
  }
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.jobs.register(JOB_KEY, async () => {
      await runSync(ctx);
    });

    ctx.data.register("wechat-health", async () => {
      const state = await readState(ctx);
      const auth = { ...state.auth, token: state.auth.token ? "[stored]" : null };
      return { ...state, auth };
    });

    ctx.actions.register("wechat-sync-now", async () => {
      await runSync(ctx);
      return { ok: true };
    });
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Board Assistant WeChat worker is ready",
    };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
