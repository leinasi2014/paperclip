import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { Building2, TimerReset } from "lucide-react";
import { departmentsApi } from "@/api/departments";
import { agentsApi } from "@/api/agents";
import { systemIssuesApi } from "@/api/system-issues";
import { temporaryWorkersApi } from "@/api/temporary-workers";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { EntityRow } from "@/components/EntityRow";
import {
  SystemIssueSeverityBadge,
  SystemIssueTypeBadge,
  SystemIssueWorkflowBadge,
} from "@/components/SystemIssueBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/utils";

export function DepartmentDetail() {
  const { t } = useTranslation("departments");
  const { departmentId } = useParams<{ departmentId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const {
    data: department,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.departments.detail(departmentId!),
    queryFn: () => departmentsApi.get(departmentId!),
    enabled: !!departmentId,
  });

  const resolvedCompanyId = department?.companyId ?? selectedCompanyId;

  const { data: budget, error: budgetError } = useQuery({
    queryKey: queryKeys.departments.budget(departmentId!),
    queryFn: () => departmentsApi.getBudget(departmentId!),
    enabled: !!departmentId && !!department,
    retry: false,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

  const { data: systemIssues } = useQuery({
    queryKey: queryKeys.systemIssues.list(resolvedCompanyId!, { owningDepartmentId: departmentId! }),
    queryFn: () => systemIssuesApi.list(resolvedCompanyId!, { owningDepartmentId: departmentId! }),
    enabled: !!resolvedCompanyId && !!departmentId,
  });

  const { data: temporaryWorkers } = useQuery({
    queryKey: queryKeys.departments.temporaryWorkers(departmentId!),
    queryFn: () => temporaryWorkersApi.listByDepartment(departmentId!),
    enabled: !!departmentId,
  });

  useEffect(() => {
    if (!department?.companyId || department.companyId === selectedCompanyId) return;
    setSelectedCompanyId(department.companyId, { source: "route_sync" });
  }, [department?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("breadcrumbs.title"), href: "/departments" },
      { label: department?.name ?? t("errors.notFound") },
    ]);
  }, [department?.name, setBreadcrumbs, t]);

  const agentNameById = useMemo(
    () => new Map((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );

  if (isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!department) {
    return <EmptyState icon={Building2} message={t("errors.notFound")} />;
  }

  const ministerName = department.ministerAgentId
    ? agentNameById.get(department.ministerAgentId) ?? department.ministerAgentId
    : t("detail.ministerFallback");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{department.slug}</p>
            <h1 className="text-xl font-semibold">{department.name}</h1>
          </div>
          <StatusBadge status={department.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {department.mission ?? t("detail.missionFallback")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("fields.minister")}</span>
              <span className="text-right">{ministerName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("fields.maxWorkers")}</span>
              <span>{department.maxConcurrentTemporaryWorkers || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.budget")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {budget ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.monthlyLimit")}</span>
                  <span>{formatCents(budget.monthlyLimitCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.reserved")}</span>
                  <span>{formatCents(budget.reservedCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("fields.spent")}</span>
                  <span>{formatCents(budget.spentCents)}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                {budgetError ? t("detail.budgetNotFound") : t("loading")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("sections.systemIssues")}</h2>
        </div>
        {!systemIssues || systemIssues.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t("empty.noSystemIssues")}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {systemIssues.map((issue) => (
              <EntityRow
                key={issue.id}
                to={`/system-issues/${issue.id}`}
                identifier={issue.identifier ?? issue.id.slice(0, 8)}
                title={issue.title}
                subtitle={issue.description ?? undefined}
                trailing={
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <SystemIssueTypeBadge type={issue.systemIssueType} />
                    <SystemIssueSeverityBadge severity={issue.systemIssueSeverity} />
                    <SystemIssueWorkflowBadge workflow={issue.systemIssueWorkflowState} />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("sections.temporaryWorkers")}</h2>
          <p className="text-sm text-muted-foreground">{t("detail.ttlPolicy", { minutes: department.temporaryWorkerTtlMinutes })}</p>
        </div>
        {!temporaryWorkers || temporaryWorkers.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t("empty.noTemporaryWorkers")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {temporaryWorkers.map((worker) => (
              <Card key={worker.id}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{worker.name}</CardTitle>
                      <p className="font-mono text-xs text-muted-foreground">{worker.id.slice(0, 8)}</p>
                    </div>
                    <StatusBadge status={worker.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("fields.minister")}</span>
                    <span className="text-right">
                      {agentNameById.get(worker.ownerMinisterAgentId) ?? worker.ownerMinisterAgentId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("fields.ttlExpiresAt")}</span>
                    <span className="inline-flex items-center gap-2 text-right">
                      <TimerReset className="h-4 w-4 text-muted-foreground" />
                      {new Date(worker.ttlExpiresAt).toLocaleString()}
                    </span>
                  </div>
                  {worker.statusReason ? (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">{t("fields.reason")}</p>
                      <p>{worker.statusReason}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
