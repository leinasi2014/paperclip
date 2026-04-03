import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, pluginCompanySettings } from "@paperclipai/db";
import type { RequiredSystemPluginKey, RequiredSystemPluginStatus } from "@paperclipai/shared";
import { REQUIRED_SYSTEM_PLUGIN_KEYS } from "@paperclipai/shared";
import type { PluginLifecycleManager } from "./plugin-lifecycle.js";
import type { PluginLoader } from "./plugin-loader.js";
import { pluginRegistryService } from "./plugin-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

type RequiredPluginDefinition = {
  pluginKey: RequiredSystemPluginKey;
  packageName: string;
  displayName: string;
  localPath: string;
};

function resolveInstallOptions(definition: RequiredPluginDefinition) {
  const builtManifestCandidates = [
    path.join(definition.localPath, "dist", "manifest.js"),
    path.join(definition.localPath, "dist", "src", "manifest.js"),
  ];
  if (builtManifestCandidates.some((candidate) => existsSync(candidate))) {
    return { packageName: definition.packageName, localPath: definition.localPath };
  }
  return { packageName: definition.packageName };
}

type RequiredSystemPluginRuntimeOptions = {
  loader: PluginLoader;
  lifecycle: PluginLifecycleManager;
};

type BootstrapState = {
  bootstrapError: string | null;
  updatedAt: Date | null;
};

const REQUIRED_PLUGIN_DEFINITIONS: readonly RequiredPluginDefinition[] = [
  {
    pluginKey: "paperclip.execution-improvement",
    packageName: "@paperclipai/plugin-execution-improvement",
    displayName: "Execution Improvement",
    localPath: path.resolve(REPO_ROOT, "packages/plugins/plugin-execution-improvement"),
  },
  {
    pluginKey: "paperclip.skills-system",
    packageName: "@paperclipai/plugin-skills-system",
    displayName: "Skills System",
    localPath: path.resolve(REPO_ROOT, "packages/plugins/plugin-skills-system"),
  },
] as const;

const bootstrapStateByKey = new Map<RequiredSystemPluginKey, BootstrapState>();

function toBootstrapError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function getBootstrapState(pluginKey: RequiredSystemPluginKey): BootstrapState {
  return bootstrapStateByKey.get(pluginKey) ?? { bootstrapError: null, updatedAt: null };
}

function setBootstrapState(pluginKey: RequiredSystemPluginKey, bootstrapError: string | null): void {
  bootstrapStateByKey.set(pluginKey, {
    bootstrapError,
    updatedAt: new Date(),
  });
}

function computeRuntimeStatus(input: {
  installed: boolean;
  pluginStatus: string | null;
  pluginLastError: string | null;
  bootstrapError: string | null;
}): RequiredSystemPluginStatus["runtimeStatus"] {
  if (!input.installed) return "missing";
  if (input.bootstrapError || input.pluginLastError) return "degraded";
  if (input.pluginStatus === "ready") return "ready";
  return "installed";
}

async function ensureCompanySettingRow(db: Db, companyId: string, pluginId: string) {
  const existing = await db
    .select({ id: pluginCompanySettings.id })
    .from(pluginCompanySettings)
    .where(and(eq(pluginCompanySettings.companyId, companyId), eq(pluginCompanySettings.pluginId, pluginId)))
    .then((rows) => rows[0] ?? null);

  if (existing) {
    await db
      .update(pluginCompanySettings)
      .set({
        enabled: true,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(pluginCompanySettings.id, existing.id));
    return;
  }

  await db.insert(pluginCompanySettings).values({
    companyId,
    pluginId,
    enabled: true,
    settingsJson: {},
    lastError: null,
  });
}

export function requiredSystemPluginService(
  db: Db,
  runtime?: Partial<RequiredSystemPluginRuntimeOptions>,
) {
  const registry = pluginRegistryService(db);

  async function ensureInstalled(definition: RequiredPluginDefinition) {
    let plugin = await registry.getByKey(definition.pluginKey);
    if (plugin && plugin.status !== "uninstalled") {
      return plugin;
    }

    if (!runtime?.loader) {
      throw new Error(`Required system plugin ${definition.pluginKey} is missing and no loader is available`);
    }

    await runtime.loader.installPlugin(resolveInstallOptions(definition));
    plugin = await registry.getByKey(definition.pluginKey);
    if (!plugin) {
      throw new Error(`Required system plugin ${definition.pluginKey} did not create a registry row`);
    }
    return plugin;
  }

  async function ensureLifecycleState(pluginId: string, activateRuntime: boolean) {
    if (!activateRuntime || !runtime?.lifecycle) return;
    const plugin = await registry.getById(pluginId);
    if (!plugin || plugin.status === "ready") return;
    await runtime.lifecycle.load(pluginId);
  }

  async function ensureCompanySettingsForAllInstalledRequiredPlugins() {
    const requiredPlugins = await registry.listInstalled()
      .then((rows) => rows.filter((row) => (REQUIRED_SYSTEM_PLUGIN_KEYS as readonly string[]).includes(row.pluginKey)));
    if (requiredPlugins.length === 0) return;

    const allCompanies = await db.select({ id: companies.id }).from(companies);
    for (const company of allCompanies) {
      for (const plugin of requiredPlugins) {
        await ensureCompanySettingRow(db, company.id, plugin.id);
      }
    }
  }

  async function listStatus(companyId?: string): Promise<RequiredSystemPluginStatus[]> {
    const plugins = await registry.list()
      .then((rows) => rows.filter((row) => (REQUIRED_SYSTEM_PLUGIN_KEYS as readonly string[]).includes(row.pluginKey)));
    const pluginByKey = new Map(plugins.map((plugin) => [plugin.pluginKey as RequiredSystemPluginKey, plugin]));
    const pluginIds = plugins.map((plugin) => plugin.id);
    const settingsByPluginId = new Map<string, { enabled: boolean }>();

    if (companyId && pluginIds.length > 0) {
      const settings = await db
        .select({
          pluginId: pluginCompanySettings.pluginId,
          enabled: pluginCompanySettings.enabled,
        })
        .from(pluginCompanySettings)
        .where(and(eq(pluginCompanySettings.companyId, companyId), inArray(pluginCompanySettings.pluginId, pluginIds)));
      for (const setting of settings) {
        settingsByPluginId.set(setting.pluginId, setting);
      }
    }

    return REQUIRED_PLUGIN_DEFINITIONS.map((definition) => {
      const plugin = pluginByKey.get(definition.pluginKey) ?? null;
      const bootstrap = getBootstrapState(definition.pluginKey);
      return {
        pluginKey: definition.pluginKey,
        packageName: definition.packageName,
        displayName: definition.displayName,
        required: true,
        pluginId: plugin?.id ?? null,
        installed: Boolean(plugin && plugin.status !== "uninstalled"),
        runtimeStatus: computeRuntimeStatus({
          installed: Boolean(plugin && plugin.status !== "uninstalled"),
          pluginStatus: plugin?.status ?? null,
          pluginLastError: plugin?.lastError ?? null,
          bootstrapError: bootstrap.bootstrapError,
        }),
        pluginStatus: plugin?.status ?? null,
        companyEnabled: plugin && companyId
          ? (settingsByPluginId.get(plugin.id)?.enabled ?? null)
          : null,
        lastError: plugin?.lastError ?? null,
        bootstrapError: bootstrap.bootstrapError,
        updatedAt: plugin?.updatedAt ?? bootstrap.updatedAt ?? null,
      } satisfies RequiredSystemPluginStatus;
    });
  }

  return {
    definitions: REQUIRED_PLUGIN_DEFINITIONS,

    async ensureCompanySettings(companyId: string) {
      const requiredPlugins = await registry.listInstalled()
        .then((rows) => rows.filter((row) => (REQUIRED_SYSTEM_PLUGIN_KEYS as readonly string[]).includes(row.pluginKey)));
      for (const plugin of requiredPlugins) {
        await ensureCompanySettingRow(db, companyId, plugin.id);
      }
    },

    listStatus,

    async reconcileAll(options?: { activateRuntime?: boolean }) {
      for (const definition of REQUIRED_PLUGIN_DEFINITIONS) {
        try {
          const plugin = await ensureInstalled(definition);
          await ensureLifecycleState(plugin.id, options?.activateRuntime ?? false);
          setBootstrapState(definition.pluginKey, null);
        } catch (error) {
          setBootstrapState(definition.pluginKey, toBootstrapError(error));
        }
      }

      await ensureCompanySettingsForAllInstalledRequiredPlugins();
      return listStatus();
    },
  };
}
