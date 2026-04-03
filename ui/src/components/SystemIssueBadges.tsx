import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { SystemIssueSeverity, SystemIssueType, SystemIssueWorkflowState } from "@paperclipai/shared";
import { cn } from "@/lib/utils";

function toneClassName(tone: "critical" | "high" | "medium" | "low" | "neutral") {
  switch (tone) {
    case "critical":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "high":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "low":
      return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export function SystemIssueTypeBadge({ type }: { type: SystemIssueType }) {
  const { t } = useTranslation("systemIssues");
  return <Badge variant="outline">{t(`types.${type}`)}</Badge>;
}

export function SystemIssueSeverityBadge({ severity }: { severity: SystemIssueSeverity }) {
  const { t } = useTranslation("systemIssues");
  const tone =
    severity === "critical"
      ? "critical"
      : severity === "high"
        ? "high"
        : severity === "medium"
          ? "medium"
          : "low";
  return (
    <Badge variant="outline" className={cn(toneClassName(tone))}>
      {t(`severity.${severity}`)}
    </Badge>
  );
}

export function SystemIssueWorkflowBadge({ workflow }: { workflow: SystemIssueWorkflowState }) {
  const { t } = useTranslation("systemIssues");
  return (
    <Badge variant="outline" className={toneClassName("neutral")}>
      {t(`workflow.${workflow}`)}
    </Badge>
  );
}
