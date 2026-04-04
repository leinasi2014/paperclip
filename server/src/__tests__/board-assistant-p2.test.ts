import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  boardAssistantBindingSessions,
  boardAssistantBindings,
  boardAssistantMemoryProposals,
  boardAssistantOutbox,
  boardAssistantRequests,
  boardAssistantThreadMessages,
  boardAssistantThreads,
  companies,
  createDb,
} from "@paperclipai/db";
import { getEmbeddedPostgresTestSupport, startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.js";
import {
  createBoardAssistantMemoryProposalIfMissing,
} from "../services/board-assistant-memory.js";
import {
  createBoardAssistantThreadService,
} from "../services/board-assistant-threads.js";
import { boardAssistantService } from "../services/index.js";
import {
  interpretAssistantMessageWithSettings,
  shouldAutoExecuteBoardAssistantRequest,
} from "../services/board-assistant-helpers.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;
const EMBEDDED_POSTGRES_HOOK_TIMEOUT = process.platform === "win32" ? 60_000 : 20_000;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres board assistant P2 tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("board assistant P2 helpers", () => {
  let db!: ReturnType<typeof createDb>;
  let threadService!: ReturnType<typeof createBoardAssistantThreadService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-board-assistant-p2-");
    db = createDb(tempDb.connectionString);
    threadService = createBoardAssistantThreadService(db);
  }, EMBEDDED_POSTGRES_HOOK_TIMEOUT);

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  afterEach(async () => {
    await db.delete(boardAssistantThreadMessages);
    await db.delete(boardAssistantThreads);
    await db.delete(boardAssistantOutbox);
    await db.delete(boardAssistantRequests);
    await db.delete(boardAssistantBindingSessions);
    await db.delete(boardAssistantBindings);
    await db.delete(boardAssistantMemoryProposals);
    await db.delete(companies);
  });

  it("creates one memory proposal and deduplicates repeated seeds", async () => {
    const proposal = await createBoardAssistantMemoryProposalIfMissing(db, {
      memoryKind: "preference",
      summary: "Founder prefers short responses.",
      sourceRefs: ["request:1"],
      confidence: 90,
      visibilityPolicy: "private_only",
    });
    expect(proposal).not.toBeNull();

    const duplicate = await createBoardAssistantMemoryProposalIfMissing(db, {
      memoryKind: "preference",
      summary: "Founder prefers short responses.",
      sourceRefs: ["request:2"],
      confidence: 90,
      visibilityPolicy: "private_only",
    });
    expect(duplicate).not.toBeNull();

    const rows = await db.select().from(boardAssistantMemoryProposals);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("Founder prefers short responses.");
  });

  it("resolves static company groups into structured queries", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Alpha Co",
      issuePrefix: "ALP",
      requireBoardApprovalForNewAgents: false,
    });

    const result = await interpretAssistantMessageWithSettings(db, "查看 founders 组", {
      staticCompanyGroups: [
        {
          groupKey: "founders",
          displayName: "Founders",
          companyIds: [companyId],
          enabled: true,
        },
      ],
    });

    expect(result.status).toBe("done");
    expect(result.intentKind).toBe("company_group_query");
    expect(result.cardPayload).toMatchObject({
      groupKey: "founders",
      displayName: "Founders",
    });
  });

  it("writes assistant follow-up messages when internal thread mode changes or founder posts", async () => {
    const threadId = randomUUID();
    await db.insert(boardAssistantThreads).values({
      id: threadId,
      threadKind: "internal",
      subjectType: "agent",
      subjectId: randomUUID(),
      mode: "observe",
      activeContextSummary: "CEO thread",
    });

    const updated = await threadService.updateThreadMode(threadId, { mode: "takeover" }, "founder-1");
    expect(updated.mode).toBe("takeover");

    await threadService.postThreadMessage(threadId, { content: "继续推进", metadata: {} }, "founder-1");

    const messages = await db
      .select()
      .from(boardAssistantThreadMessages)
      .where(eq(boardAssistantThreadMessages.threadId, threadId));

    expect(messages.some((message) => message.authorKind === "system")).toBe(true);
    expect(messages.some((message) => message.authorKind === "assistant")).toBe(true);
  });

  it("auto-executes low-risk draft generation requests", () => {
    expect(shouldAutoExecuteBoardAssistantRequest({
      autoExecutionMode: "low_risk_auto",
      intentKind: "draft_generation",
      targetKind: "instance",
      proposedPayload: { draftKind: "message" },
    })).toBe(true);
  });

  it("uses binding tokens only once even under concurrent ingress", async () => {
    const assistant = boardAssistantService(db);
    const { bindingToken } = await assistant.createBindingSession({ channel: "wechat" }, "founder-1");
    const payload = {
      channel: "wechat" as const,
      externalUserId: "wx-user",
      externalThreadId: "wx-thread",
      externalMessageId: "wx-msg-1",
      timestamp: new Date().toISOString(),
      messageText: "binding",
      normalizedPayload: {},
      ingressSignature: "",
      bindingToken,
    };

    const { createHmac, createHash } = await import("node:crypto");
    const secret = "secret";
    process.env.BOARD_ASSISTANT_CHANNEL_SECRET_WECHAT = secret;
    const bodyHash = createHash("sha256").update(JSON.stringify({
      messageText: payload.messageText,
      normalizedPayload: payload.normalizedPayload,
    })).digest("hex");
    const signature = createHmac("sha256", secret)
      .update([
        payload.channel,
        payload.externalUserId,
        payload.externalThreadId,
        payload.externalMessageId,
        payload.timestamp,
        bodyHash,
      ].join(":"))
      .digest("hex");
    const ingress = { ...payload, ingressSignature: signature };

    const [first, second] = await Promise.allSettled([
      assistant.ingest(ingress),
      assistant.ingest(ingress),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual(["fulfilled", "rejected"]);
  });
});
