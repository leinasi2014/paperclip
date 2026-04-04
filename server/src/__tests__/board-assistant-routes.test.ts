import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { boardAssistantRoutes } from "../routes/board-assistant.js";

const mockBoardAssistantService = vi.hoisted(() => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  createBindingSession: vi.fn(),
  getLatestBindingSession: vi.fn(),
  getBindingSession: vi.fn(),
  confirmBindingSession: vi.fn(),
  revokeBinding: vi.fn(),
  getActiveBinding: vi.fn(),
  listRequests: vi.fn(),
  getRequestById: vi.fn(),
  confirmRequest: vi.fn(),
  rejectRequest: vi.fn(),
  rewakeRequestTarget: vi.fn(),
  cancelRequestTarget: vi.fn(),
  listMemories: vi.fn(),
  listMemoryProposals: vi.fn(),
  approveMemoryProposal: vi.fn(),
  rejectMemoryProposal: vi.fn(),
  suppressMemory: vi.fn(),
  deleteMemory: vi.fn(),
  listThreads: vi.fn(),
  listThreadMessages: vi.fn(),
  postThreadMessage: vi.fn(),
  updateThreadMode: vi.fn(),
  ingest: vi.fn(),
  listOutbox: vi.fn(),
  ackOutbox: vi.fn(),
  health: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  boardAssistantService: () => mockBoardAssistantService,
}));

function createApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", boardAssistantRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("board assistant routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBoardAssistantService.getSettings.mockResolvedValue({ enabled: false });
    mockBoardAssistantService.getBindingSession.mockResolvedValue({ id: "session-1", status: "pending_web_confirm" });
    mockBoardAssistantService.getLatestBindingSession.mockResolvedValue({ id: "session-1", status: "pending_web_confirm" });
    mockBoardAssistantService.listRequests.mockResolvedValue([]);
    mockBoardAssistantService.confirmRequest.mockResolvedValue({ id: "request-1", status: "done" });
    mockBoardAssistantService.rewakeRequestTarget.mockResolvedValue({ id: "target-1", status: "routed" });
    mockBoardAssistantService.cancelRequestTarget.mockResolvedValue({ id: "target-1", status: "cancelled" });
    mockBoardAssistantService.ingest.mockResolvedValue({ request: { id: "request-1" }, duplicate: false });
    mockBoardAssistantService.listOutbox.mockResolvedValue([{ id: "outbox-1" }]);
    mockBoardAssistantService.ackOutbox.mockResolvedValue({ id: "outbox-1", status: "sent" });
    process.env.BOARD_ASSISTANT_CHANNEL_SECRET_WECHAT = "secret-1";
  });

  afterEach(() => {
    delete process.env.BOARD_ASSISTANT_CHANNEL_SECRET_WECHAT;
    delete process.env.BOARD_ASSISTANT_CHANNEL_PREVIOUS_SECRET_WECHAT;
  });

  it("allows instance admins to read settings", async () => {
    const app = createApp({
      type: "board",
      userId: "local-board",
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).get("/api/board-assistant/settings");

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.getSettings).toHaveBeenCalled();
  });

  it("rejects non-admin board users", async () => {
    const app = createApp({
      type: "board",
      userId: "user-1",
      source: "session",
      isInstanceAdmin: false,
      companyIds: ["company-1"],
    });

    const res = await request(app).get("/api/board-assistant/settings");

    expect(res.status).toBe(403);
    expect(mockBoardAssistantService.getSettings).not.toHaveBeenCalled();
  });

  it("passes request confirm through with the board actor id", async () => {
    const app = createApp({
      type: "board",
      userId: "founder-1",
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app)
      .post("/api/board-assistant/requests/request-1/confirm")
      .send({ notes: "执行" });

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.confirmRequest).toHaveBeenCalledWith(
      "request-1",
      { notes: "执行" },
      "founder-1",
    );
  });

  it("allows instance admins to poll a binding session", async () => {
    const app = createApp({
      type: "board",
      userId: "local-board",
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).get("/api/board-assistant/bindings/sessions/session-1");

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.getBindingSession).toHaveBeenCalledWith("session-1");
  });

  it("allows instance admins to read the latest binding session by channel", async () => {
    const app = createApp({
      type: "board",
      userId: "local-board",
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).get("/api/board-assistant/bindings/sessions/latest?channel=wechat");

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.getLatestBindingSession).toHaveBeenCalledWith("wechat");
  });

  it("allows channel ingress without board actor checks", async () => {
    const app = createApp({
      type: "none",
      source: "anonymous",
    });

    const res = await request(app)
      .post("/api/board-assistant/channel/ingress")
      .send({
        channel: "wechat",
        externalUserId: "wx-user",
        externalThreadId: "wx-thread",
        externalMessageId: "msg-1",
        timestamp: new Date().toISOString(),
        messageText: "hello",
        normalizedPayload: {},
        ingressSignature: "sig",
      });

    expect(res.status).toBe(202);
    expect(mockBoardAssistantService.ingest).toHaveBeenCalled();
  });

  it("requires a valid channel secret for outbox polling", async () => {
    const app = createApp({
      type: "none",
      source: "anonymous",
    });

    await request(app)
      .get("/api/board-assistant/channel/outbox?channel=wechat")
      .expect(403);

    const res = await request(app)
      .get("/api/board-assistant/channel/outbox?channel=wechat")
      .set("x-board-assistant-channel-secret", "secret-1");

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.listOutbox).toHaveBeenCalledWith("wechat");
  });

  it("passes target rewake through with the board actor id", async () => {
    const app = createApp({
      type: "board",
      userId: "founder-1",
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const res = await request(app).post("/api/board-assistant/request-targets/target-1/rewake");

    expect(res.status).toBe(200);
    expect(mockBoardAssistantService.rewakeRequestTarget).toHaveBeenCalledWith("target-1", "founder-1");
  });
});
