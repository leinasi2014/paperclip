import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  approveSystemIssueResumeSchema,
  closeSystemIssueSchema,
  createSystemIssueSchema,
  listSystemIssuesQuerySchema,
  requestSystemIssueResumeSchema,
  requestSystemIssueReviewSchema,
  routeSystemIssueSchema,
  setSystemIssueBlockRecommendationSchema,
  reviewSystemIssueSchema,
  startSystemIssueTriageSchema,
  updateSystemIssueSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { companyService, logActivity, systemIssueService } from "../services/index.js";
import { forbidden, notFound } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function systemIssueRoutes(db: Db) {
  const router = Router();
  const svc = systemIssueService(db);
  const companiesSvc = companyService(db);

  async function assertBoardOrCeo(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");

    const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(companyId);
    if (!effectiveCeoAgentId || effectiveCeoAgentId !== req.actor.agentId) {
      throw forbidden("Only board users or the company CEO can manage system issues");
    }
  }

  router.get("/companies/:companyId/system-issues", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const query = listSystemIssuesQuerySchema.parse(req.query);
    const systemIssues = await svc.list(companyId, query);
    res.json(systemIssues);
  });

  router.post("/companies/:companyId/system-issues", validate(createSystemIssueSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertBoardOrCeo(req, companyId);
    const issue = await svc.create(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: {
        identifier: issue.identifier,
        title: issue.title,
        systemIssueType: issue.systemIssueType,
        systemIssueSeverity: issue.systemIssueSeverity,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
        owningDepartmentId: issue.owningDepartmentId,
        blockRecommended: issue.blockRecommended,
      },
    });
    res.status(201).json(issue);
  });

  router.get("/system-issues/:id", async (req, res) => {
    const id = req.params.id as string;
    const issue = await svc.getById(id);
    if (!issue) {
      res.status(404).json({ error: "System issue not found" });
      return;
    }
    assertCompanyAccess(req, issue.companyId);
    res.json(issue);
  });

  router.patch("/system-issues/:id", validate(updateSystemIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    await assertBoardOrCeo(req, existing.companyId);
    const issue = await svc.update(id, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.updated",
      entityType: "issue",
      entityId: issue.id,
      details: req.body,
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/route", validate(routeSystemIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    await assertBoardOrCeo(req, existing.companyId);
    const actor = getActorInfo(req);
    const routingActor =
      actor.actorType === "agent"
        ? { actorType: "agent" as const, actorId: actor.actorId, agentId: actor.actorId }
        : { actorType: "user" as const, actorId: actor.actorId };
    const issue = await svc.route(id, req.body.owningDepartmentId, routingActor);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.routed",
      entityType: "issue",
      entityId: issue.id,
      details: {
        owningDepartmentId: issue.owningDepartmentId,
        isInCeoIntake: issue.isInCeoIntake,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/start-triage", validate(startSystemIssueTriageSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    await assertBoardOrCeo(req, existing.companyId);
    const issue = await svc.startTriage(id);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.triage_started",
      entityType: "issue",
      entityId: issue.id,
      details: {
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/request-review", validate(requestSystemIssueReviewSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    assertCompanyAccess(req, existing.companyId);
    if (req.actor.type !== "agent") {
      throw forbidden("Only the current owning department minister may request review");
    }
    const actor = getActorInfo(req);
    const routingActor =
      { actorType: "agent" as const, actorId: actor.actorId, agentId: actor.actorId };
    const issue = await svc.requestReview(id, routingActor);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.review_requested",
      entityType: "issue",
      entityId: issue.id,
      details: {
        notes: req.body.notes ?? null,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/review", validate(reviewSystemIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);
    const reviewActor =
      actor.actorType === "agent"
        ? { actorType: "agent" as const, actorId: actor.actorId, agentId: actor.actorId }
        : { actorType: "user" as const, actorId: actor.actorId };
    const issue = await svc.review(id, reviewActor, req.body.approved);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.review_recorded",
      entityType: "issue",
      entityId: issue.id,
      details: {
        approved: req.body.approved,
        notes: req.body.notes ?? null,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/request-resume", validate(requestSystemIssueResumeSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    assertCompanyAccess(req, existing.companyId);
    const actor = getActorInfo(req);
    const resumeActor =
      actor.actorType === "agent"
        ? { actorType: "agent" as const, actorId: actor.actorId, agentId: actor.actorId }
        : { actorType: "user" as const, actorId: actor.actorId };
    const issue = await svc.requestResume(id, resumeActor);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.resume_requested",
      entityType: "issue",
      entityId: issue.id,
      details: {
        notes: req.body.notes ?? null,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/approve-resume", validate(approveSystemIssueResumeSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    await assertBoardOrCeo(req, existing.companyId);
    const issue = await svc.approveResume(id);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.resume_approved",
      entityType: "issue",
      entityId: issue.id,
      details: {
        notes: req.body.notes ?? null,
        blockRecommended: issue.blockRecommended,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
      },
    });
    res.json(issue);
  });

  router.post("/system-issues/:id/close", validate(closeSystemIssueSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      throw notFound("System issue not found");
    }
    await assertBoardOrCeo(req, existing.companyId);
    const issue = await svc.close(id);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "system_issue.closed",
      entityType: "issue",
      entityId: issue.id,
      details: {
        notes: req.body.notes ?? null,
        systemIssueWorkflowState: issue.systemIssueWorkflowState,
        status: issue.status,
      },
    });
    res.json(issue);
  });

  router.post(
    "/system-issues/:id/block-recommendation",
    validate(setSystemIssueBlockRecommendationSchema),
    async (req, res) => {
      const id = req.params.id as string;
      const existing = await svc.getById(id);
      if (!existing) {
        throw notFound("System issue not found");
      }
      await assertBoardOrCeo(req, existing.companyId);
      const issue = await svc.setBlockRecommendation(id, req.body.blockRecommended);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: issue.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "system_issue.block_recommendation_updated",
        entityType: "issue",
        entityId: issue.id,
        details: {
          blockRecommended: issue.blockRecommended,
        },
      });
      res.json(issue);
    },
  );

  return router;
}
