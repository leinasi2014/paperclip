import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  buildSystemPluginRollbackCommandSchema,
  createSystemPluginRolloutSchema,
  executeSystemPluginRestartPathSchema,
  listSystemPluginRolloutsQuerySchema,
  recordSystemPluginRolloutApprovalSchema,
} from "@paperclipai/shared";
import type { PluginLifecycleManager } from "../services/plugin-lifecycle.js";
import { validate } from "../middleware/validate.js";
import { assertInstanceAdmin } from "./authz.js";
import { systemPluginRolloutService } from "../services/system-plugin-rollouts.js";
import { notFound } from "../errors.js";

type RestartLifecycle = Pick<PluginLifecycleManager, "restartWorker">;

function getActorUserId(req: Parameters<typeof assertInstanceAdmin>[0]) {
  return req.actor.userId ?? "instance-admin";
}

export function systemPluginRolloutRoutes(
  db: Db,
  deps?: {
    lifecycle?: RestartLifecycle;
  },
) {
  const router = Router();
  const svc = systemPluginRolloutService(db, deps);

  router.get("/system-plugin-rollouts", async (req, res) => {
    assertInstanceAdmin(req);
    const query = listSystemPluginRolloutsQuerySchema.parse(req.query);
    const rollouts = await svc.list(query);
    res.json(rollouts);
  });

  router.post("/system-plugin-rollouts", validate(createSystemPluginRolloutSchema), async (req, res) => {
    assertInstanceAdmin(req);
    const rollout = await svc.create(req.body, getActorUserId(req));
    res.status(201).json(rollout);
  });

  router.get("/system-plugin-rollouts/:id", async (req, res) => {
    assertInstanceAdmin(req);
    const rollout = await svc.getById(req.params.id as string);
    if (!rollout) {
      throw notFound("System plugin rollout not found");
    }
    res.json(rollout);
  });

  router.post(
    "/system-plugin-rollouts/:id/approvals",
    validate(recordSystemPluginRolloutApprovalSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const rollout = await svc.recordApproval(
        req.params.id as string,
        req.body,
        getActorUserId(req),
      );
      res.json(rollout);
    },
  );

  router.post(
    "/system-plugin-rollouts/:id/restart-path",
    validate(executeSystemPluginRestartPathSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const rollout = await svc.executeRestartPath(req.params.id as string);
      res.json(rollout);
    },
  );

  router.post(
    "/system-plugin-rollouts/:id/rollback-command",
    validate(buildSystemPluginRollbackCommandSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const rollout = await svc.buildRollbackCommand(req.params.id as string);
      res.json(rollout);
    },
  );

  return router;
}
