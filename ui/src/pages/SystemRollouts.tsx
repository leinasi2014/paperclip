import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch, Puzzle, RotateCcw, ShieldAlert } from "lucide-react";
import { Link } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { systemPluginRolloutsApi } from "@/api/system-plugin-rollouts";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";

import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";

export function SystemRollouts() {
  const { t } = useTranslation("systemRollouts");
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  useEffect(() => {
    setBreadcrumbs([{ label: t("breadcrumbs.rollouts") }]);
  }, [setBreadcrumbs, t]);

  const { data: rollouts, isLoading, error } = useQuery({
    queryKey: queryKeys.systemPluginRollouts.list(),
    queryFn: () => systemPluginRolloutsApi.list(),
  });

  const { data: plugins } = useQuery({
    queryKey: queryKeys.systemPlugins.status(selectedCompanyId ?? undefined),
    queryFn: () => pluginsApi.listRequiredSystemStatus(selectedCompanyId ?? undefined),
  });

  const invalidateRollouts = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.systemPluginRollouts.list() });
    queryClient.invalidateQueries({ queryKey: queryKeys.systemPlugins.status(selectedCompanyId ?? undefined) });
  };

  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) =>
      systemPluginRolloutsApi.recordApproval(id, { decision }),
    onSuccess: (_, variables) => {
      invalidateRollouts();
      pushToast({
        title: variables.decision === "approved" ? t("toasts.approveSucceeded") : t("toasts.rejectSucceeded"),
        tone: variables.decision === "approved" ? "success" : "info",
      });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.approveFailed"), body: err.message, tone: "error" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => systemPluginRolloutsApi.executeRestartPath(id),
    onSuccess: () => {
      invalidateRollouts();
      pushToast({ title: t("toasts.executeSucceeded"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.executeFailed"), body: err.message, tone: "error" });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => systemPluginRolloutsApi.buildRollbackCommand(id),
    onSuccess: () => {
      invalidateRollouts();
      pushToast({ title: t("toasts.rollbackPrepared"), tone: "success" });
    },
    onError: (err: Error) => {
      pushToast({ title: t("toasts.rollbackFailed"), body: err.message, tone: "error" });
    },
  });

  const requiredSystemPlugins = useMemo(
    () => plugins ?? [],
    [plugins],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={GitBranch} message={t("empty.selectCompany")} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const rolloutRows = rollouts ?? [];
  const latestRollouts = rolloutRows.slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              {t("cards.execution.title")}
            </CardTitle>
            <CardDescription>{t("cards.execution.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.execution.controller")}</span>
              <span className="text-right">{t("cards.execution.controllerValue")}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.execution.currentMode")}</span>
              <Badge variant="outline">{t("cards.execution.currentModeValue")}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("cards.execution.note")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Puzzle className="h-4 w-4" />
              {t("cards.plugins.title")}
            </CardTitle>
            <CardDescription>{t("cards.plugins.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.plugins.required")}</span>
              <span className="text-right">{t("cards.plugins.requiredValue")}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.plugins.nextStep")}</span>
              <Link to="/plugins" className="text-primary underline-offset-4 hover:underline">
                {t("cards.plugins.nextStepValue")}
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">{t("cards.plugins.note")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              {t("cards.incidents.title")}
            </CardTitle>
            <CardDescription>{t("cards.incidents.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.incidents.queue")}</span>
              <span className="text-right">{t("cards.incidents.queueValue")}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("cards.incidents.nextStep")}</span>
              <Link to="/system-issues" className="text-primary underline-offset-4 hover:underline">
                {t("cards.incidents.nextStepValue")}
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">{t("cards.incidents.note")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.rollouts")}</CardTitle>
            <CardDescription>{t("sections.rolloutsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestRollouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("states.noRollouts")}</p>
            ) : (
              <div className="space-y-3">
                {latestRollouts.map((rollout) => (
                  <div key={rollout.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{rollout.pluginPackageName}</span>
                          <StatusBadge status={rollout.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {rollout.pluginKey} · {rollout.baseVersion}
                          {rollout.candidateVersion ? ` → ${rollout.candidateVersion}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {rollout.status === "pending_approval" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => approvalMutation.mutate({ id: rollout.id, decision: "approved" })}
                              disabled={approvalMutation.isPending}
                            >
                              {t("actions.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvalMutation.mutate({ id: rollout.id, decision: "rejected" })}
                              disabled={approvalMutation.isPending}
                            >
                              {t("actions.reject")}
                            </Button>
                          </>
                        ) : null}
                        {rollout.status === "approved" ? (
                          <Button
                            size="sm"
                            onClick={() => executeMutation.mutate(rollout.id)}
                            disabled={executeMutation.isPending}
                          >
                            {t("actions.executeRestartPath")}
                          </Button>
                        ) : null}
                        {rollout.status !== "pending_approval" && rollout.status !== "rejected" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rollbackMutation.mutate(rollout.id)}
                            disabled={rollbackMutation.isPending}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {t("actions.prepareRollback")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {rollout.note ? <p className="mt-3 text-sm text-muted-foreground">{rollout.note}</p> : null}
                    {rollout.lastError ? (
                      <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                        {rollout.lastError}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.requiredPlugins")}</CardTitle>
            <CardDescription>{t("sections.requiredPluginsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {requiredSystemPlugins.length === 0 ? (
              <p className="text-muted-foreground">{t("states.noRequiredPlugins")}</p>
            ) : (
              requiredSystemPlugins.map((plugin) => (
                <div key={plugin.pluginKey} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{plugin.displayName}</p>
                      <p className="text-xs text-muted-foreground">{plugin.pluginKey}</p>
                    </div>
                    <StatusBadge status={plugin.runtimeStatus} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {plugin.packageName}
                  </p>
                  {plugin.bootstrapError || plugin.lastError ? (
                    <p className="mt-2 text-xs text-destructive">{plugin.bootstrapError ?? plugin.lastError}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
