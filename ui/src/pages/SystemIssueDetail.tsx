import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { systemIssuesApi } from "@/api/system-issues";
import { departmentsApi } from "@/api/departments";
import { agentsApi } from "@/api/agents";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  SystemIssueSeverityBadge,
  SystemIssueTypeBadge,
  SystemIssueWorkflowBadge,
} from "@/components/SystemIssueBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntityRow } from "@/components/EntityRow";
import { formatCents } from "@/lib/utils";

export function SystemIssueDetail() {
  const { t } = useTranslation("systemIssues");
  const { issueId } = useParams<{ issueId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  const {
    data: issue,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.systemIssues.detail(issueId!),
    queryFn: () => systemIssuesApi.get(issueId!),
    enabled: !!issueId,
  });

  const resolvedCompanyId = issue?.companyId ?? selectedCompanyId;

  const { data: department } = useQuery({
    queryKey: queryKeys.departments.detail(issue?.owningDepartmentId ?? "__none__"),
    queryFn: () => departmentsApi.get(issue!.owningDepartmentId!),
    enabled: !!issue?.owningDepartmentId,
  });

  const { data: budget } = useQuery({
    queryKey: queryKeys.departments.budget(issue?.owningDepartmentId ?? "__none__"),
    queryFn: () => departmentsApi.getBudget(issue!.owningDepartmentId!),
    enabled: !!issue?.owningDepartmentId,
    retry: false,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
  });

  const { data: relatedIssues } = useQuery({
    queryKey: queryKeys.systemIssues.list(resolvedCompanyId!, { owningDepartmentId: issue?.owningDepartmentId ?? undefined }),
    queryFn: () =>
      systemIssuesApi.list(resolvedCompanyId!, { owningDepartmentId: issue?.owningDepartmentId ?? undefined }),
    enabled: !!resolvedCompanyId && !!issue?.owningDepartmentId,
  });

  useEffect(() => {
    if (!issue?.companyId || issue.companyId === selectedCompanyId) return;
    setSelectedCompanyId(issue.companyId, { source: "route_sync" });
  }, [issue?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("breadcrumbs.title"), href: "/system-issues" },
      { label: issue?.identifier ?? issue?.title ?? t("detail.titleFallback") },
    ]);
  }, [issue?.identifier, issue?.title, setBreadcrumbs, t]);

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

  if (!issue) {
    return <EmptyState icon={ShieldAlert} message={t("errors.notFound")} />;
  }

  const ministerDecision =
    issue.ministerDecisionResponse ? t(`intake.${issue.ministerDecisionResponse}`) : t("detail.decisionFallback");
  const ministerName = issue.ministerDecisionByAgentId
    ? agentNameById.get(issue.ministerDecisionByAgentId) ?? issue.ministerDecisionByAgentId
    : t("detail.ministerFallback");
  const relatedRows = (relatedIssues ?? []).filter((row) => row.id !== issue.id).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {issue.identifier ?? issue.id.slice(0, 8)}
          </span>
          {issue.isInCeoIntake ? <Badge variant="outline">{t("labels.ceoIntake")}</Badge> : null}
          {issue.blockRecommended ? (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300">
              {t("labels.blockRecommended")}
            </Badge>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold">{issue.title || t("detail.titleFallback")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <SystemIssueTypeBadge type={issue.systemIssueType} />
          <SystemIssueSeverityBadge severity={issue.systemIssueSeverity} />
          <SystemIssueWorkflowBadge workflow={issue.systemIssueWorkflowState} />
        </div>
        <p className="text-sm text-muted-foreground">
          {issue.description ?? t("detail.descriptionFallback")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("labels.department")}</span>
              {department ? (
                <Link to={`/departments/${department.id}`} className="hover:underline">
                  {department.name}
                </Link>
              ) : (
                <span>{t("detail.departmentFallback")}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("labels.sourceIssue")}</span>
              <Link to={`/issues/${issue.identifier ?? issue.id}`} className="hover:underline">
                {t("detail.viewIssue")}
              </Link>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("labels.ministerDecision")}</span>
              <span className="text-right">{ministerDecision}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("labels.minister")}</span>
              <span className="text-right">{ministerName}</span>
            </div>
            {issue.ministerDecisionReason ? (
              <div className="space-y-1">
                <p className="text-muted-foreground">{t("labels.ministerDecision")}</p>
                <p>{issue.ministerDecisionReason}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.budgetTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {budget ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail.monthlyLimit")}</span>
                  <span>{formatCents(budget.monthlyLimitCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail.reserved")}</span>
                  <span>{formatCents(budget.reservedCents)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t("detail.spent")}</span>
                  <span>{formatCents(budget.spentCents)}</span>
                </div>
                {department ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("detail.maxWorkers")}</span>
                    <span>{department.maxConcurrentTemporaryWorkers || "—"}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">{t("detail.budgetNotFound")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">{t("sections.relatedIssues")}</h2>
        {relatedRows.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t("empty.noIssues")}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {relatedRows.map((row) => (
              <EntityRow
                key={row.id}
                to={`/system-issues/${row.id}`}
                identifier={row.identifier ?? row.id.slice(0, 8)}
                title={row.title}
                subtitle={row.description ?? undefined}
                trailing={
                  <div className="flex flex-wrap items-center gap-2">
                    <SystemIssueSeverityBadge severity={row.systemIssueSeverity} />
                    <SystemIssueWorkflowBadge workflow={row.systemIssueWorkflowState} />
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
