import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Goal } from "@paperclipai/shared";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalTree } from "../components/GoalTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Target, Plus } from "lucide-react";

export function Goals() {
  const { t } = useTranslation("goals");
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [goalPendingDelete, setGoalPendingDelete] = useState<Goal | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("breadcrumbs.goals", { defaultValue: "Goals" }) }]);
  }, [setBreadcrumbs, t]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteGoal = useMutation({
    mutationFn: (goalId: string) => goalsApi.remove(goalId),
    onSuccess: (_, goalId) => {
      if (selectedCompanyId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.goals.list(selectedCompanyId),
        });
      }
      queryClient.removeQueries({ queryKey: queryKeys.goals.detail(goalId) });
      pushToast({
        title: t("toasts.deleteSuccess", { defaultValue: "Goal deleted" }),
        tone: "success",
      });
      setGoalPendingDelete(null);
    },
    onError: (error) => {
      pushToast({
        title: t("toasts.deleteError", { defaultValue: "Failed to delete goal" }),
        body:
          error instanceof Error
            ? error.message
            : t("toasts.unknownError", { defaultValue: "Unknown error" }),
        tone: "error",
      });
    },
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Target}
        message={t("empty.selectCompany", { defaultValue: "Select a company to view goals." })}
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          message={t("empty.noGoals", { defaultValue: "No goals yet." })}
          action={t("actions.addGoal", { defaultValue: "Add Goal" })}
          onAction={() => openNewGoal()}
        />
      )}

      {goals && goals.length > 0 && (
        <>
          <div className="flex items-center justify-start">
            <Button size="sm" variant="outline" onClick={() => openNewGoal()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("actions.newGoal", { defaultValue: "New Goal" })}
            </Button>
          </div>
          <GoalTree
            goals={goals}
            goalLink={(goal) => `/goals/${goal.id}`}
            onDelete={(goal) => setGoalPendingDelete(goal)}
            deletingGoalId={deleteGoal.isPending ? goalPendingDelete?.id ?? null : null}
          />
        </>
      )}

      <Dialog
        open={goalPendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleteGoal.isPending) {
            setGoalPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("dialogs.deleteGoal.title", { defaultValue: "Delete goal?" })}
            </DialogTitle>
            <DialogDescription>
              {t("dialogs.deleteGoal.description", {
                defaultValue: 'Delete "{{title}}"? This cannot be undone.',
                title: goalPendingDelete?.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGoalPendingDelete(null)}
              disabled={deleteGoal.isPending}
            >
              {t("actions.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!goalPendingDelete) return;
                deleteGoal.mutate(goalPendingDelete.id);
              }}
              disabled={!goalPendingDelete || deleteGoal.isPending}
            >
              {deleteGoal.isPending
                ? t("actions.deletingGoal", { defaultValue: "Deleting..." })
                : t("actions.confirmDeleteGoal", { defaultValue: "Delete Goal" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
