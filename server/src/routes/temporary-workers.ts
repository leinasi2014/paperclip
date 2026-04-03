import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  approveTemporaryWorkerResumeSchema,
  createTemporaryWorkerSchema,
  extendTemporaryWorkerTtlSchema,
  reconcileTemporaryWorkerTtlSchema,
  requestTemporaryWorkerResumeSchema,
  updateTemporaryWorkerPauseSchema,
  terminateTemporaryWorkerSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import {
  companyService,
  departmentService,
  logActivity,
  temporaryWorkerService,
} from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function temporaryWorkerRoutes(db: Db) {
  const router = Router();
  const workers = temporaryWorkerService(db);
  const departmentsSvc = departmentService(db);
  const companiesSvc = companyService(db);

  async function assertBoardOrCeo(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(companyId);
    if (!effectiveCeoAgentId || effectiveCeoAgentId !== req.actor.agentId) {
      throw forbidden("Only board users or the company CEO can perform this action");
    }
  }

  async function assertCurrentMinister(req: Request, departmentId: string) {
    const department = await departmentsSvc.getById(departmentId);
    if (!department) {
      return null;
    }
    assertCompanyAccess(req, department.companyId);
    if (!req.actor.agentId || req.actor.agentId !== department.ministerAgentId) {
      throw forbidden("Only the current department minister can manage temporary workers");
    }
    return department;
  }

  router.get("/departments/:id/temporary-workers", async (req, res) => {
    const departmentId = req.params.id as string;
    const department = await departmentsSvc.getById(departmentId);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    assertCompanyAccess(req, department.companyId);
    if (req.actor.type !== "board") {
      const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(department.companyId);
      const actorAgentId = req.actor.agentId ?? null;
      if (actorAgentId !== effectiveCeoAgentId && actorAgentId !== department.ministerAgentId) {
        throw forbidden("Only board users, the company CEO, or the department minister can read temporary workers");
      }
    }
    res.json(await workers.listByDepartment(department.id));
  });

  router.post("/departments/:id/temporary-workers", validate(createTemporaryWorkerSchema), async (req, res) => {
    const departmentId = req.params.id as string;
    const department = await assertCurrentMinister(req, departmentId);
    if (!department || !req.actor.agentId) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const worker = await workers.spawn(department.id, req.actor.agentId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.created",
      entityType: "temporary_worker",
      entityId: worker!.id,
      details: {
        departmentId: department.id,
        sourceIssueId: worker!.sourceIssueId,
        status: worker!.status,
      },
    });
    res.status(201).json(worker);
  });

  router.get("/temporary-workers/:id", async (req, res) => {
    const workerId = req.params.id as string;
    const worker = await workers.getById(workerId);
    if (!worker) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    assertCompanyAccess(req, worker.companyId);
    if (req.actor.type !== "board") {
      const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(worker.companyId);
      const actorAgentId = req.actor.agentId ?? null;
      if (actorAgentId !== effectiveCeoAgentId && actorAgentId !== worker.ownerMinisterAgentId) {
        throw forbidden("Only board users, the company CEO, or the owning minister can read this temporary worker");
      }
    }
    res.json(worker);
  });

  router.post("/temporary-workers/:id/pause", validate(updateTemporaryWorkerPauseSchema), async (req, res) => {
    const workerId = req.params.id as string;
    const existing = await workers.getById(workerId);
    if (!existing) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    await assertCurrentMinister(req, existing.departmentId);
    const worker = await workers.requestPause(existing.id, req.actor.agentId!, req.body.reason);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.pause_requested",
      entityType: "temporary_worker",
      entityId: existing.id,
      details: {
        status: worker?.status,
        reason: req.body.reason ?? null,
      },
    });
    res.json(worker);
  });

  router.post("/temporary-workers/:id/request-resume", validate(requestTemporaryWorkerResumeSchema), async (req, res) => {
    const workerId = req.params.id as string;
    const existing = await workers.getById(workerId);
    if (!existing) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    await assertCurrentMinister(req, existing.departmentId);
    const worker = await workers.requestResume(existing.id, req.actor.agentId!, req.body.reason);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.resume_requested",
      entityType: "temporary_worker",
      entityId: existing.id,
      details: {
        status: worker?.status,
        reason: req.body.reason ?? null,
      },
    });
    res.json(worker);
  });

  router.post("/temporary-workers/:id/approve-resume", validate(approveTemporaryWorkerResumeSchema), async (req, res) => {
    const workerId = req.params.id as string;
    const existing = await workers.getById(workerId);
    if (!existing) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const worker = await workers.approveResume(existing.id);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.resume_approved",
      entityType: "temporary_worker",
      entityId: existing.id,
      details: {
        status: worker?.status,
      },
    });
    res.json(worker);
  });

  router.post("/temporary-workers/:id/extend-ttl", validate(extendTemporaryWorkerTtlSchema), async (req, res) => {
    const workerId = req.params.id as string;
    const existing = await workers.getById(workerId);
    if (!existing) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    await assertCurrentMinister(req, existing.departmentId);
    const worker = await workers.extendTtl(existing.id, req.body.ttlMinutes);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.ttl_extended",
      entityType: "temporary_worker",
      entityId: existing.id,
      details: {
        ttlExpiresAt: worker?.ttlExpiresAt ?? null,
      },
    });
    res.json(worker);
  });

  router.post("/temporary-workers/:id/terminate", validate(terminateTemporaryWorkerSchema), async (req, res) => {
    const workerId = req.params.id as string;
    const existing = await workers.getById(workerId);
    if (!existing) {
      res.status(404).json({ error: "Temporary worker not found" });
      return;
    }
    await assertCurrentMinister(req, existing.departmentId);
    const worker = await workers.terminate(existing.id, req.body.reason);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.terminated",
      entityType: "temporary_worker",
      entityId: existing.id,
      details: {
        reason: req.body.reason ?? null,
      },
    });
    res.json(worker);
  });

  router.post("/companies/:companyId/temporary-workers/reconcile-ttl", validate(reconcileTemporaryWorkerTtlSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertBoardOrCeo(req, companyId);
    const reconciled = await workers.reconcileExpired(companyId, req.body.asOf);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "temporary_worker.ttl_reconciled",
      entityType: "company",
      entityId: companyId,
      details: {
        reconciledCount: reconciled.length,
      },
    });
    res.json({ reconciled });
  });

  return router;
}
