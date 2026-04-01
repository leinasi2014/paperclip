/**
 * @fileoverview Plugin Manager page — admin UI for discovering,
 * installing, enabling/disabling, and uninstalling plugins.
 *
 * @see PLUGIN_SPEC.md §9 — Plugin Marketplace / Manager
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { PluginRecord, PluginStatus } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { AlertTriangle, FlaskConical, Plus, Power, Puzzle, Settings, Trash } from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

function firstNonEmptyLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const line = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean);
  return line ?? null;
}

function getPluginErrorSummary(plugin: PluginRecord, fallback: string): string {
  return firstNonEmptyLine(plugin.lastError) ?? fallback;
}

/**
 * PluginManager page component.
 *
 * Provides a management UI for the Paperclip plugin system:
 * - Lists all installed plugins with their status, version, and category badges.
 * - Allows installing new plugins by npm package name.
 * - Provides per-plugin actions: enable, disable, navigate to settings.
 * - Uninstall with a two-step confirmation dialog to prevent accidental removal.
 *
 * Data flow:
 * - Reads from `GET /api/plugins` via `pluginsApi.list()`.
 * - Mutations (install / uninstall / enable / disable) invalidate
 *   `queryKeys.plugins.all` so the list refreshes automatically.
 *
 * @see PluginSettings — linked from the Settings icon on each plugin row.
 * @see doc/plugins/PLUGIN_SPEC.md §3 — Plugin Lifecycle for status semantics.
 */
export function PluginManager() {
  const { t } = useTranslation("plugins");
  const { selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [installPackage, setInstallPackage] = useState("");
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [uninstallPluginId, setUninstallPluginId] = useState<string | null>(null);
  const [uninstallPluginName, setUninstallPluginName] = useState<string>("");
  const [errorDetailsPlugin, setErrorDetailsPlugin] = useState<PluginRecord | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("breadcrumbs.company"), href: "/dashboard" },
      { label: t("breadcrumbs.settings"), href: "/instance/settings/heartbeats" },
      { label: t("breadcrumbs.plugins") },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs, t]);

  const { data: plugins, isLoading, error } = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  const examplesQuery = useQuery({
    queryKey: queryKeys.plugins.examples,
    queryFn: () => pluginsApi.listExamples(),
  });

  const invalidatePluginQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.examples });
    queryClient.invalidateQueries({ queryKey: queryKeys.plugins.uiContributions });
  };

  const installMutation = useMutation({
    mutationFn: (params: { packageName: string; version?: string; isLocalPath?: boolean }) =>
      pluginsApi.install(params),
    onSuccess: () => {
      invalidatePluginQueries();
      setInstallDialogOpen(false);
      setInstallPackage("");
      pushToast({ title: t("toasts.installSucceeded"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.installFailed"), body: err.message, tone: "error" });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.uninstall(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: t("toasts.uninstallSucceeded"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.uninstallFailed"), body: err.message, tone: "error" });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.enable(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: t("toasts.enableSucceeded"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.enableFailed"), body: err.message, tone: "error" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (pluginId: string) => pluginsApi.disable(pluginId),
    onSuccess: () => {
      invalidatePluginQueries();
      pushToast({ title: t("toasts.disableSucceeded"), tone: "info" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.disableFailed"), body: err.message, tone: "error" });
    },
  });

  const installedPlugins = plugins ?? [];
  const examples = examplesQuery.data ?? [];
  const installedByPackageName = new Map(installedPlugins.map((plugin) => [plugin.packageName, plugin]));
  const examplePackageNames = new Set(examples.map((example) => example.packageName));
  const pluginStatusLabels: Record<PluginStatus, string> = {
    installed: t("states.installed"),
    ready: t("states.ready"),
    disabled: t("states.disabled"),
    error: t("states.error"),
    upgrade_pending: t("states.upgrade_pending"),
    uninstalled: t("states.uninstalled"),
  };
  const errorSummaryByPluginId = useMemo(
    () =>
      new Map(
        installedPlugins.map((plugin) => [plugin.id, getPluginErrorSummary(plugin, t("dialogs.errorDetails.noErrorSummary"))])
      ),
    [installedPlugins, t]
  );

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>;
  if (error) return <div className="p-4 text-sm text-destructive">{t("error")}</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("title")}</h1>
        </div>
        
        <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {t("actions.installPlugin")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialogs.install.title")}</DialogTitle>
              <DialogDescription>{t("dialogs.install.description")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="packageName">{t("dialogs.install.packageName")}</Label>
                <Input
                  id="packageName"
                  placeholder="@paperclipai/plugin-example"
                  value={installPackage}
                  onChange={(e) => setInstallPackage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>{t("actions.cancel")}</Button>
              <Button
                onClick={() => installMutation.mutate({ packageName: installPackage })}
                disabled={!installPackage || installMutation.isPending}
              >
                {installMutation.isPending ? t("actions.installing") : t("actions.install")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("banner.alphaTitle")}</p>
            <p className="text-muted-foreground">{t("banner.alphaDescription")}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("sections.available")}</h2>
          <Badge variant="outline">{t("states.example")}</Badge>
        </div>

        {examplesQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">{t("states.loadingExamples")}</div>
        ) : examplesQuery.error ? (
          <div className="text-sm text-destructive">{t("states.failedExamples")}</div>
        ) : examples.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {t("states.noExamples")}
          </div>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {examples.map((example) => {
              const installedPlugin = installedByPackageName.get(example.packageName);
              const installPending =
                installMutation.isPending &&
                installMutation.variables?.isLocalPath &&
                installMutation.variables.packageName === example.localPath;

              return (
                <li key={example.packageName}>
                  <div className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{example.displayName}</span>
                        <Badge variant="outline">{t("states.example")}</Badge>
                        {installedPlugin ? (
                        <Badge
                          variant={installedPlugin.status === "ready" ? "default" : "secondary"}
                          className={installedPlugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                            {pluginStatusLabels[installedPlugin.status]}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("states.notInstalled")}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{example.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{example.packageName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                          {installedPlugin ? (
                        <>
                          {installedPlugin.status !== "ready" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={enableMutation.isPending}
                              onClick={() => enableMutation.mutate(installedPlugin.id)}
                            >
                              {t("actions.enable")}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/instance/settings/plugins/${installedPlugin.id}`}>
                              {installedPlugin.status === "ready" ? t("actions.openSettings") : t("actions.review")}
                            </Link>
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={installPending || installMutation.isPending}
                          onClick={() =>
                            installMutation.mutate({
                              packageName: example.localPath,
                              isLocalPath: true,
                            })
                          }
                          >
                          {installPending ? t("actions.installing") : t("actions.installExample")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t("sections.installed")}</h2>
        </div>

        {!installedPlugins.length ? (
          <Card className="bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Puzzle className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">{t("states.noPlugins")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("states.noPluginsDescription")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {installedPlugins.map((plugin) => (
              <li key={plugin.id}>
                <div className="flex items-start gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/instance/settings/plugins/${plugin.id}`}
                        className="font-medium hover:underline truncate block"
                        title={plugin.manifestJson.displayName ?? plugin.packageName}
                      >
                        {plugin.manifestJson.displayName ?? plugin.packageName}
                      </Link>
                      {examplePackageNames.has(plugin.packageName) && (
                        <Badge variant="outline">{t("states.example")}</Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={plugin.packageName}>
                        {plugin.packageName} · v{plugin.manifestJson.version ?? plugin.version}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5" title={plugin.manifestJson.description}>
                      {plugin.manifestJson.description || t("states.noDescription")}
                    </p>
                    {plugin.status === "error" && (
                      <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{t("states.pluginError")}</span>
                            </div>
                            <p
                              className="mt-1 text-sm text-red-700/90 dark:text-red-200/90 break-words"
                              title={plugin.lastError ?? undefined}
                            >
                              {errorSummaryByPluginId.get(plugin.id)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 bg-background/60 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-200 dark:hover:text-red-100"
                            onClick={() => setErrorDetailsPlugin(plugin)}
                          >
                            {t("actions.viewFullError")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 self-center">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            plugin.status === "ready"
                              ? "default"
                              : plugin.status === "error"
                                ? "destructive"
                              : "secondary"
                          }
                          className={cn(
                            "shrink-0",
                            plugin.status === "ready" ? "bg-green-600 hover:bg-green-700" : ""
                          )}
                        >
                          {pluginStatusLabels[plugin.status]}
                        </Badge>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          title={plugin.status === "ready" ? t("actions.disable") : t("actions.enable")}
                          onClick={() => {
                            if (plugin.status === "ready") {
                              disableMutation.mutate(plugin.id);
                            } else {
                              enableMutation.mutate(plugin.id);
                            }
                          }}
                          disabled={enableMutation.isPending || disableMutation.isPending}
                        >
                          <Power className={cn("h-4 w-4", plugin.status === "ready" ? "text-green-600" : "")} />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title={t("actions.uninstall")}
                          onClick={() => {
                            setUninstallPluginId(plugin.id);
                            setUninstallPluginName(plugin.manifestJson.displayName ?? plugin.packageName);
                          }}
                          disabled={uninstallMutation.isPending}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" className="mt-2 h-8" asChild>
                        <Link to={`/instance/settings/plugins/${plugin.id}`}>
                          <Settings className="h-4 w-4" />
                          {t("actions.configure")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={uninstallPluginId !== null}
        onOpenChange={(open) => { if (!open) setUninstallPluginId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.uninstall.title")}</DialogTitle>
            <DialogDescription>{t("dialogs.uninstall.description", { name: uninstallPluginName })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallPluginId(null)}>{t("actions.cancel")}</Button>
            <Button
              variant="destructive"
              disabled={uninstallMutation.isPending}
              onClick={() => {
                if (uninstallPluginId) {
                  uninstallMutation.mutate(uninstallPluginId, {
                    onSettled: () => setUninstallPluginId(null),
                  });
                }
              }}
            >
              {uninstallMutation.isPending ? t("actions.uninstalling") : t("actions.uninstall")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={errorDetailsPlugin !== null}
        onOpenChange={(open) => { if (!open) setErrorDetailsPlugin(null); }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("dialogs.errorDetails.title")}</DialogTitle>
          <DialogDescription>
            {t("dialogs.errorDetails.description", {
              name: errorDetailsPlugin?.manifestJson.displayName ?? errorDetailsPlugin?.packageName ?? t("labels.plugin"),
            })}
          </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-red-700 dark:text-red-300">
                    {t("dialogs.errorDetails.whatErrored")}
                  </p>
                  <p className="text-red-700/90 dark:text-red-200/90 break-words">
                    {errorDetailsPlugin ? getPluginErrorSummary(errorDetailsPlugin, t("dialogs.errorDetails.noErrorSummary")) : t("dialogs.errorDetails.noErrorSummary")}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("dialogs.errorDetails.fullError")}</p>
              <pre className="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-words">
                {errorDetailsPlugin?.lastError ?? t("dialogs.errorDetails.noStoredError")}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorDetailsPlugin(null)}>{t("actions.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
