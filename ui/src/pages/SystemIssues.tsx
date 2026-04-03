import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { systemIssuesApi } from "@/api/system-issues";
import { departmentsApi } from "@/api/departments";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { EntityRow } from "@/components/EntityRow";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  SystemIssueSeverityBadge,
  SystemIssueTypeBadge,
  SystemIssueWorkflowBadge,
} from "@/components/SystemIssueBadges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SystemIssues() {
  const { t } = useTranslation("systemIssues");
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: t("breadcrumbs.title") }]);
  }, [setBreadcrumbs, t]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.systemIssues.list(selectedCompanyId!),
    queryFn: () => systemIssuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: departments } = useQuery({
    queryKey: queryKeys.departments.list(selectedCompanyId!),
    queryFn: () => departmentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const departmentNameById = useMemo(
    () => new Map((departments ?? []).map((department) => [department.id, department.name])),
    [departments],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={ShieldAlert} message={t("empty.selectCompany")} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const rows = issues ?? [];
  const summary = {
    total: rows.length,
    critical: rows.filter((issue) => issue.systemIssueSeverity === "critical").length,
    blocked: rows.filter((issue) => issue.blockRecommended).length,
    ceoIntake: rows.filter((issue) => issue.isInCeoIntake).length,
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {([
          ["total", summary.total],
          ["critical", summary.critical],
          ["blocked", summary.blocked],
          ["ceoIntake", summary.ceoIntake],
        ] as const).map(([key, value]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t(`summary.${key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ShieldAlert} message={t("empty.noIssues")} />
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {rows.map((issue) => {
              const departmentName = issue.owningDepartmentId
                ? departmentNameById.get(issue.owningDepartmentId) ?? issue.owningDepartmentId
                : t("detail.departmentFallback");
              const description = issue.description ?? t("detail.descriptionFallback");
              return (
                <EntityRow
                  key={issue.id}
                  to={`/system-issues/${issue.id}`}
                  identifier={issue.identifier ?? issue.id.slice(0, 8)}
                  title={issue.title}
                  subtitle={`${t("labels.department")}: ${departmentName} · ${description}`}
                  trailing={(
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {issue.isInCeoIntake ? (
                        <Badge variant="outline">{t("labels.ceoIntake")}</Badge>
                      ) : null}
                      {issue.blockRecommended ? (
                        <Badge
                          variant="outline"
                          className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                        >
                          {t("labels.blockRecommended")}
                        </Badge>
                      ) : null}
                      <SystemIssueTypeBadge type={issue.systemIssueType} />
                      <SystemIssueSeverityBadge severity={issue.systemIssueSeverity} />
                      <SystemIssueWorkflowBadge workflow={issue.systemIssueWorkflowState} />
                    </div>
                  )}
                />
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
