import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { reconcileRequiredSystemPluginsSchema } from "@paperclipai/shared";
import type { PluginLifecycleManager } from "../services/plugin-lifecycle.js";
import type { PluginLoader } from "../services/plugin-loader.js";
import { requiredSystemPluginService } from "../services/required-system-plugins.js";
import { validate } from "../middleware/validate.js";
import { assertBoard } from "./authz.js";
import { forbidden } from "../errors.js";

export function systemPluginRoutes(
  db: Db,
  runtime?: {
    loader?: PluginLoader;
    lifecycle?: PluginLifecycleManager;
  },
) {
  const router = Router();

  router.get("/system-plugins/status", async (req, res) => {
    assertBoard(req);
    const companyId = typeof req.query.companyId === "string" && req.query.companyId.length > 0
      ? req.query.companyId
      : undefined;
    const service = requiredSystemPluginService(db, runtime);
    res.json(await service.listStatus(companyId));
  });

  router.post("/system-plugins/reconcile", validate(reconcileRequiredSystemPluginsSchema), async (req, res) => {
    assertBoard(req);
    if (!(req.actor.source === "local_implicit" || req.actor.isInstanceAdmin)) {
      throw forbidden("Instance admin required");
    }
    const service = requiredSystemPluginService(db, runtime);
    res.json(await service.reconcileAll({ activateRuntime: true }));
  });

  return router;
}
