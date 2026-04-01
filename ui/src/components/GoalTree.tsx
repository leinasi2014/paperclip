import type { Goal } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Loader2, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

interface GoalTreeProps {
  goals: Goal[];
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  deletingGoalId?: string | null;
}

interface GoalNodeProps {
  goal: Goal;
  children: Goal[];
  allGoals: Goal[];
  depth: number;
  goalLink?: (goal: Goal) => string;
  onSelect?: (goal: Goal) => void;
  onDelete?: (goal: Goal) => void;
  deletingGoalId?: string | null;
}

function GoalNode({
  goal,
  children,
  allGoals,
  depth,
  goalLink,
  onSelect,
  onDelete,
  deletingGoalId,
}: GoalNodeProps) {
  const { t } = useTranslation("goals");
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const link = goalLink?.(goal);
  const isDeleting = deletingGoalId === goal.id;
  const deleteLabel = t("actions.deleteGoal", { defaultValue: "Delete Goal" });

  const inner = (
    <>
      {hasChildren ? (
        <button
          className="p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span className="w-4" />
      )}
      <span className="text-xs text-muted-foreground capitalize">{goal.level}</span>
      <span className="flex-1 truncate">{goal.title}</span>
      <StatusBadge status={goal.status} />
    </>
  );

  const classes = cn(
    "flex min-w-0 items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer hover:bg-accent/50",
  );

  return (
    <div>
      <div className="group flex items-center gap-1 pr-1">
        {link ? (
          <Link
            to={link}
            className={cn(classes, "flex-1 no-underline text-inherit")}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
          >
            {inner}
          </Link>
        ) : (
          <div
            className={cn(classes, "flex-1")}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => onSelect?.(goal)}
          >
            {inner}
          </div>
        )}
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete(goal);
            }}
            disabled={isDeleting}
            aria-label={deleteLabel}
            title={deleteLabel}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : null}
      </div>
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <GoalNode
              key={child.id}
              goal={child}
              children={allGoals.filter((g) => g.parentId === child.id)}
              allGoals={allGoals}
              depth={depth + 1}
              goalLink={goalLink}
              onSelect={onSelect}
              onDelete={onDelete}
              deletingGoalId={deletingGoalId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalTree({ goals, goalLink, onSelect, onDelete, deletingGoalId }: GoalTreeProps) {
  const { t } = useTranslation("goals");
  const goalIds = new Set(goals.map((g) => g.id));
  const roots = goals.filter((g) => !g.parentId || !goalIds.has(g.parentId));

  if (goals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("empty.noGoals", { defaultValue: "No goals yet." })}
      </p>
    );
  }

  return (
    <div className="border border-border py-1">
      {roots.map((goal) => (
        <GoalNode
          key={goal.id}
          goal={goal}
          children={goals.filter((g) => g.parentId === goal.id)}
          allGoals={goals}
          depth={0}
          goalLink={goalLink}
          onSelect={onSelect}
          onDelete={onDelete}
          deletingGoalId={deletingGoalId}
        />
      ))}
    </div>
  );
}
