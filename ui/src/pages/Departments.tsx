import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { Building2 } from "lucide-react";
import { departmentsApi } from "@/api/departments";
import { agentsApi } from "@/api/agents";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

export function Departments() {
  const { t } = useTranslation("departments");
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: t("breadcrumbs.title") }]);
  }, [setBreadcrumbs, t]);

  const { data: departments, isLoading, error } = useQuery({
    queryKey: queryKeys.departments.list(selectedCompanyId!),
    queryFn: () => departmentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentNameById = useMemo(
    () =>
      new Map(
        (agents ?? []).map((agent) => [agent.id, agent.name]),
      ),
    [agents],
  );

  if (!selectedCompanyId) {
    return <EmptyState icon={Building2} message={t("empty.selectCompany")} />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const rows = departments ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      {rows.length === 0 ? (
        <EmptyState icon={Building2} message={t("empty.noDepartments")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((department) => (
            <Link key={department.id} to={`/departments/${department.id}`} className="block">
              <Card className="h-full transition-colors hover:border-foreground/20 hover:bg-accent/20">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{department.name}</CardTitle>
                      <CardDescription>{department.slug}</CardDescription>
                    </div>
                    <StatusBadge status={department.status} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {department.mission ?? t("detail.missionFallback")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("fields.minister")}</span>
                    <span className="truncate text-right">
                      {department.ministerAgentId
                        ? agentNameById.get(department.ministerAgentId) ?? department.ministerAgentId
                        : t("detail.ministerFallback")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{t("fields.maxWorkers")}</span>
                    <span>{department.maxConcurrentTemporaryWorkers || "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
