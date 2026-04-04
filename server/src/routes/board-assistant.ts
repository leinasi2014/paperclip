import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  approveBoardAssistantMemoryProposalSchema,
  boardAssistantIngressSchema,
  boardAssistantMemoryProposalQuerySchema,
  boardAssistantMemoryQuerySchema,
  boardAssistantOutboxAckSchema,
  boardAssistantRequestQuerySchema,
  boardAssistantThreadMessageQuerySchema,
  boardAssistantThreadQuerySchema,
  confirmBoardAssistantRequestSchema,
  createBoardAssistantBindingSessionSchema,
  createBoardAssistantThreadMessageSchema,
  patchBoardAssistantSettingsSchema,
  rejectBoardAssistantMemoryProposalSchema,
  rejectBoardAssistantRequestSchema,
  revokeBoardAssistantBindingSchema,
  suppressBoardAssistantMemorySchema,
  updateBoardAssistantThreadModeSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { isPresentedChannelSecretAccepted } from "../services/board-assistant-helpers.js";
import { boardAssistantService } from "../services/index.js";
import { assertInstanceAdmin, getActorInfo } from "./authz.js";

function assertChannelSecret(
  channel: string,
  presentedSecret: string | undefined,
  previousSecretGraceWindowMinutes: number,
) {
  const active = process.env[`BOARD_ASSISTANT_CHANNEL_SECRET_${channel.toUpperCase()}`];
  const previous = process.env[`BOARD_ASSISTANT_CHANNEL_PREVIOUS_SECRET_${channel.toUpperCase()}`];
  if (!active && !previous) {
    throw forbidden(`Channel secret not configured for ${channel}`);
  }
  if (!isPresentedChannelSecretAccepted(channel, presentedSecret, previousSecretGraceWindowMinutes)) {
    throw forbidden("Invalid board assistant channel secret");
  }
}

function normalizeQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeQueryRecord(query: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, normalizeQueryValue(value)]),
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export function boardAssistantRoutes(db: Db) {
  const router = Router();
  const svc = boardAssistantService(db);

  router.get("/board-assistant/settings", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.getSettings());
  });

  router.patch("/board-assistant/settings", validate(patchBoardAssistantSettingsSchema), async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.updateSettings(req.body));
  });

  router.post("/board-assistant/bindings/sessions", validate(createBoardAssistantBindingSessionSchema), async (req, res) => {
    assertInstanceAdmin(req);
    const created = await svc.createBindingSession(req.body, req.actor.userId ?? "board");
    res.status(201).json(created);
  });

  router.get("/board-assistant/bindings/sessions/latest", async (req, res) => {
    assertInstanceAdmin(req);
    const channel = String(req.query.channel ?? "").trim();
    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }
    res.json(await svc.getLatestBindingSession(channel as "wechat"));
  });

  router.get("/board-assistant/bindings/sessions/:bindingSessionId", async (req, res) => {
    assertInstanceAdmin(req);
    const session = await svc.getBindingSession(getSingleParam(req.params.bindingSessionId));
    if (!session) {
      res.status(404).json({ error: "Binding session not found" });
      return;
    }
    res.json(session);
  });

  router.post("/board-assistant/bindings/sessions/:bindingSessionId/confirm", async (req, res) => {
    assertInstanceAdmin(req);
    const confirmed = await svc.confirmBindingSession(getSingleParam(req.params.bindingSessionId));
    res.json(confirmed);
  });

  router.post("/board-assistant/bindings/revoke", validate(revokeBoardAssistantBindingSchema), async (req, res) => {
    assertInstanceAdmin(req);
    const revoked = await svc.revokeBinding(req.body.bindingId);
    res.json(revoked);
  });

  router.get("/board-assistant/bindings/active", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.getActiveBinding());
  });

  router.get("/board-assistant/requests", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.listRequests(boardAssistantRequestQuerySchema.parse(normalizeQueryRecord(req.query))));
  });

  router.get("/board-assistant/requests/:requestId", async (req, res) => {
    assertInstanceAdmin(req);
    const detail = await svc.getRequestById(getSingleParam(req.params.requestId));
    if (!detail) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(detail);
  });

  router.post(
    "/board-assistant/requests/:requestId/confirm",
    validate(confirmBoardAssistantRequestSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const actor = getActorInfo(req);
      const confirmed = await svc.confirmRequest(getSingleParam(req.params.requestId), req.body, actor.actorId);
      res.json(confirmed);
    },
  );

  router.post(
    "/board-assistant/requests/:requestId/reject",
    validate(rejectBoardAssistantRequestSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const actor = getActorInfo(req);
      const rejected = await svc.rejectRequest(getSingleParam(req.params.requestId), req.body, actor.actorId);
      res.json(rejected);
    },
  );

  router.post("/board-assistant/request-targets/:targetId/rewake", async (req, res) => {
    assertInstanceAdmin(req);
    const actor = getActorInfo(req);
    res.json(await svc.rewakeRequestTarget(getSingleParam(req.params.targetId), actor.actorId));
  });

  router.post("/board-assistant/request-targets/:targetId/cancel", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.cancelRequestTarget(getSingleParam(req.params.targetId)));
  });

  router.get("/board-assistant/memories", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.listMemories(boardAssistantMemoryQuerySchema.parse(normalizeQueryRecord(req.query))));
  });

  router.get("/board-assistant/memory-proposals", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.listMemoryProposals(
      boardAssistantMemoryProposalQuerySchema.parse(normalizeQueryRecord(req.query)),
    ));
  });

  router.post(
    "/board-assistant/memory-proposals/:proposalId/approve",
    validate(approveBoardAssistantMemoryProposalSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      res.json(await svc.approveMemoryProposal(getSingleParam(req.params.proposalId), req.body));
    },
  );

  router.post(
    "/board-assistant/memory-proposals/:proposalId/reject",
    validate(rejectBoardAssistantMemoryProposalSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      res.json(await svc.rejectMemoryProposal(getSingleParam(req.params.proposalId), req.body));
    },
  );

  router.post("/board-assistant/memories/:memoryId/suppress", validate(suppressBoardAssistantMemorySchema), async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.suppressMemory(getSingleParam(req.params.memoryId), req.body));
  });

  router.delete("/board-assistant/memories/:memoryId", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.deleteMemory(getSingleParam(req.params.memoryId)));
  });

  router.get("/board-assistant/threads", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.listThreads(boardAssistantThreadQuerySchema.parse(normalizeQueryRecord(req.query))));
  });

  router.get("/board-assistant/threads/:threadId/messages", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.listThreadMessages(
      getSingleParam(req.params.threadId),
      boardAssistantThreadMessageQuerySchema.parse(normalizeQueryRecord(req.query)),
    ));
  });

  router.post(
    "/board-assistant/threads/:threadId/messages",
    validate(createBoardAssistantThreadMessageSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const actor = getActorInfo(req);
      const message = await svc.postThreadMessage(getSingleParam(req.params.threadId), req.body, actor.actorId);
      res.status(201).json(message);
    },
  );

  router.patch(
    "/board-assistant/threads/:threadId/mode",
    validate(updateBoardAssistantThreadModeSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const actor = getActorInfo(req);
      res.json(await svc.updateThreadMode(getSingleParam(req.params.threadId), req.body, actor.actorId));
    },
  );

  router.get("/board-assistant/health", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await svc.health());
  });

  router.post("/board-assistant/channel/ingress", validate(boardAssistantIngressSchema), async (req, res) => {
    const result = await svc.ingest(req.body);
    res.status(202).json(result);
  });

  router.get("/board-assistant/channel/outbox", async (req, res) => {
    const channel = String(req.query.channel ?? "").trim();
    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }
    const cfg = await svc.getSettings();
    assertChannelSecret(channel, req.header("x-board-assistant-channel-secret") ?? undefined, cfg.previousSecretGraceWindowMinutes);
    res.json(await svc.listOutbox(channel as "wechat"));
  });

  router.post(
    "/board-assistant/channel/outbox/:outboxId/ack",
    validate(boardAssistantOutboxAckSchema),
    async (req, res) => {
      const channel = String(req.query.channel ?? "").trim();
      if (!channel) {
        res.status(400).json({ error: "channel is required" });
        return;
      }
      const cfg = await svc.getSettings();
      assertChannelSecret(channel, req.header("x-board-assistant-channel-secret") ?? undefined, cfg.previousSecretGraceWindowMinutes);
      res.json(await svc.ackOutbox(getSingleParam(req.params.outboxId), req.body));
    },
  );

  router.post("/board-assistant/channel/health", async (req, res) => {
    const channel = String(req.query.channel ?? "").trim();
    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }
    const cfg = await svc.getSettings();
    assertChannelSecret(channel, req.header("x-board-assistant-channel-secret") ?? undefined, cfg.previousSecretGraceWindowMinutes);
    res.json({ ok: true, at: new Date().toISOString() });
  });

  return router;
}
