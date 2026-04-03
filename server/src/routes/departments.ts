import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  allocateDepartmentBudgetSchema,
  assignDepartmentMinisterSchema,
  createDepartmentSchema,
  freezeDepartmentSchema,
  removeDepartmentMinisterSchema,
  unfreezeDepartmentSchema,
  updateDepartmentSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { companyService, departmentBudgetService, departmentService, logActivity } from "../services/index.js";
import { forbidden } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function departmentRoutes(db: Db) {
  const router = Router();
  const svc = departmentService(db);
  const budgetSvc = departmentBudgetService(db);
  const companiesSvc = companyService(db);

  async function assertBoardOrCeo(req: Request, companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");

    const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(companyId);
    if (!effectiveCeoAgentId || effectiveCeoAgentId !== req.actor.agentId) {
      throw forbidden("Only board users or the company CEO can manage departments");
    }
  }

  router.get("/companies/:companyId/departments", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const departments = await svc.list(companyId);
    res.json(departments);
  });

  router.post("/companies/:companyId/departments", validate(createDepartmentSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertBoardOrCeo(req, companyId);
    const department = await svc.create(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.created",
      entityType: "department",
      entityId: department.id,
      details: {
        name: department.name,
        slug: department.slug,
        ministerAgentId: department.ministerAgentId,
      },
    });
    res.status(201).json(department);
  });

  router.get("/departments/:id", async (req, res) => {
    const id = req.params.id as string;
    const department = await svc.getById(id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    assertCompanyAccess(req, department.companyId);
    res.json(department);
  });

  router.patch("/departments/:id", validate(updateDepartmentSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const department = await svc.update(id, req.body);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.updated",
      entityType: "department",
      entityId: department.id,
      details: req.body,
    });
    res.json(department);
  });

  router.post("/departments/:id/assign-minister", validate(assignDepartmentMinisterSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const department = await svc.assignMinister(id, req.body.agentId);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.minister_assigned",
      entityType: "department",
      entityId: department.id,
      details: { ministerAgentId: department.ministerAgentId },
    });
    res.json(department);
  });

  router.post("/departments/:id/remove-minister", validate(removeDepartmentMinisterSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const department = await svc.removeMinister(id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.minister_removed",
      entityType: "department",
      entityId: department.id,
    });
    res.json(department);
  });

  router.post("/departments/:id/freeze", validate(freezeDepartmentSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const department = await svc.freeze(id, req.body.status);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.frozen",
      entityType: "department",
      entityId: department.id,
      details: { status: department.status },
    });
    res.json(department);
  });

  router.post("/departments/:id/unfreeze", validate(unfreezeDepartmentSchema), async (req, res) => {
    const id = req.params.id as string;
    const existing = await svc.getById(id);
    if (!existing) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, existing.companyId);
    const department = await svc.unfreeze(id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.unfrozen",
      entityType: "department",
      entityId: department.id,
      details: { status: department.status },
    });
    res.json(department);
  });

  router.get("/departments/:id/budget", async (req, res) => {
    const id = req.params.id as string;
    const department = await svc.getById(id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    assertCompanyAccess(req, department.companyId);
    if (req.actor.type !== "board") {
      const effectiveCeoAgentId = await companiesSvc.getEffectiveCeoAgentId(department.companyId);
      const actorAgentId = req.actor.agentId ?? null;
      if (actorAgentId !== effectiveCeoAgentId && actorAgentId !== department.ministerAgentId) {
        throw forbidden("Only board users, the company CEO, or the department minister can read budget");
      }
    }
    const budget = await budgetSvc.getByDepartmentId(id);
    if (!budget) {
      res.status(404).json({ error: "Department budget not found" });
      return;
    }
    res.json(budget);
  });

  router.post("/departments/:id/budget/allocate", validate(allocateDepartmentBudgetSchema), async (req, res) => {
    const id = req.params.id as string;
    const department = await svc.getById(id);
    if (!department) {
      res.status(404).json({ error: "Department not found" });
      return;
    }
    await assertBoardOrCeo(req, department.companyId);
    const budget = await budgetSvc.allocate(id, req.body);
    if (!budget) {
      res.status(404).json({ error: "Department budget not found" });
      return;
    }
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: department.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "department.budget_allocated",
      entityType: "department",
      entityId: department.id,
      details: {
        monthlyLimitCents: budget.monthlyLimitCents,
        status: budget.status,
      },
    });
    res.json(budget);
  });

  return router;
}
