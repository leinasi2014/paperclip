import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { departments, issues } from "@paperclipai/db";
import type { Issue, ListSystemIssuesQuery, SystemIssue } from "@paperclipai/shared";
import { conflict, forbidden, notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";
import { issueRoutingService, isIssueInCeoIntake } from "./issue-routing.js";
import { systemProjectService } from "./system-project.js";

export function systemIssueService(db: Db) {
  const issueSvc = issueService(db);
  const issueRouting = issueRoutingService(db);
  const systemProjects = systemProjectService(db);
  type IssueServiceIssue = Awaited<ReturnType<typeof issueSvc.getById>>;
  type HydratedSystemIssueRow = NonNullable<IssueServiceIssue> & {
    systemIssueType: NonNullable<NonNullable<IssueServiceIssue>["systemIssueType"]>;
    systemIssueSeverity: NonNullable<NonNullable<IssueServiceIssue>["systemIssueSeverity"]>;
    systemIssueWorkflowState: NonNullable<NonNullable<IssueServiceIssue>["systemIssueWorkflowState"]>;
  };
  type CreateSystemIssueInput = {
    title: string;
    description?: string | null;
    priority?: Issue["priority"];
    systemIssueType: SystemIssue["systemIssueType"];
    systemIssueSeverity: SystemIssue["systemIssueSeverity"];
    blockRecommended?: boolean;
  };
  type UpdateSystemIssueInput = {
    title?: string;
    description?: string | null;
    priority?: Issue["priority"];
    systemIssueType?: SystemIssue["systemIssueType"];
    systemIssueSeverity?: SystemIssue["systemIssueSeverity"];
  };

  function hasSystemIssueMetadata(issue: IssueServiceIssue): issue is HydratedSystemIssueRow {
    return Boolean(issue?.systemIssueType && issue?.systemIssueSeverity && issue?.systemIssueWorkflowState);
  }

  function toSystemIssueFromRow(issue: HydratedSystemIssueRow): SystemIssue {
    return {
      ...(issue as Issue),
      systemIssueType: issue.systemIssueType as SystemIssue["systemIssueType"],
      systemIssueSeverity: issue.systemIssueSeverity as SystemIssue["systemIssueSeverity"],
      systemIssueWorkflowState: issue.systemIssueWorkflowState as SystemIssue["systemIssueWorkflowState"],
      blockRecommended: Boolean(issue.blockRecommended),
      isInCeoIntake: isIssueInCeoIntake(issue),
    };
  }

  async function assertDepartmentScope(companyId: string, owningDepartmentId: string | null) {
    if (!owningDepartmentId) return null;
    const department = await db
      .select({ id: departments.id, companyId: departments.companyId })
      .from(departments)
      .where(eq(departments.id, owningDepartmentId))
      .then((rows) => rows[0] ?? null);
    if (!department || department.companyId !== companyId) {
      throw unprocessable("System issue department must belong to the same company");
    }
    return department;
  }

  async function getSystemIssueOrThrow(id: string) {
    const issue = await issueSvc.getById(id);
    if (!issue) throw notFound("System issue not found");
    if (!hasSystemIssueMetadata(issue)) {
      throw unprocessable("Issue is not a system issue");
    }
    const canonical = await systemProjects.getCanonical(issue.companyId);
    if (!canonical || issue.projectId !== canonical.id) {
      throw unprocessable("System issue must belong to the canonical system project");
    }
    return toSystemIssueFromRow(issue);
  }

  async function getDepartmentForIssue(issue: SystemIssue) {
    if (!issue.owningDepartmentId) return null;
    return db
      .select({
        id: departments.id,
        companyId: departments.companyId,
        ministerAgentId: departments.ministerAgentId,
        status: departments.status,
      })
      .from(departments)
      .where(eq(departments.id, issue.owningDepartmentId))
      .then((rows) => rows[0] ?? null);
  }

  async function assertCurrentOwningMinister(issue: SystemIssue, ministerAgentId: string) {
    if (!issue.owningDepartmentId) {
      throw conflict("System issue is not currently routed to a department");
    }
    const department = await getDepartmentForIssue(issue);
    if (!department || department.companyId !== issue.companyId) {
      throw conflict("Owning department not found");
    }
    if (department.status !== "active") {
      throw conflict("Owning department is not active");
    }
    if (!department.ministerAgentId || department.ministerAgentId !== ministerAgentId) {
      throw forbidden("Only the current owning department minister may perform this action");
    }
    return department;
  }

  async function assertEligibleReviewer(issue: SystemIssue, reviewerAgentId: string) {
    const reviewerDepartment = await db
      .select({
        id: departments.id,
        companyId: departments.companyId,
        ministerAgentId: departments.ministerAgentId,
        status: departments.status,
      })
      .from(departments)
      .where(eq(departments.ministerAgentId, reviewerAgentId))
      .then((rows) => rows[0] ?? null);
    if (!reviewerDepartment || reviewerDepartment.companyId !== issue.companyId || reviewerDepartment.status !== "active") {
      throw forbidden("Only an active minister outside the responsible department may review this system issue");
    }
    if (issue.owningDepartmentId && reviewerDepartment.id === issue.owningDepartmentId) {
      throw forbidden("The responsible department cannot review its own system issue");
    }
    return reviewerDepartment;
  }

  return {
    list: async (companyId: string, filters: ListSystemIssuesQuery = {}) => {
      const canonical = await systemProjects.getCanonical(companyId);
      if (!canonical) return [] as SystemIssue[];

      const conditions = [
        eq(issues.companyId, companyId),
        eq(issues.projectId, canonical.id),
        isNotNull(issues.systemIssueType),
      ];
      if (filters.type) conditions.push(eq(issues.systemIssueType, filters.type));
      if (filters.severity) conditions.push(eq(issues.systemIssueSeverity, filters.severity));
      if (filters.workflowState) conditions.push(eq(issues.systemIssueWorkflowState, filters.workflowState));
      if (filters.owningDepartmentId) conditions.push(eq(issues.owningDepartmentId, filters.owningDepartmentId));
      if (filters.inCeoIntake === true) {
        conditions.push(
          and(
            isNull(issues.owningDepartmentId),
            sql`${issues.departmentIntakeStatus} in ('ceo_intake', 'rejected', 'needs_clarification')`,
          )!,
        );
      }
      if (filters.inCeoIntake === false) {
        conditions.push(
          and(
            isNotNull(issues.owningDepartmentId),
            sql`${issues.departmentIntakeStatus} in ('routed', 'accepted')`,
          )!,
        );
      }
      if (filters.blockRecommended !== undefined) {
        conditions.push(eq(issues.blockRecommended, filters.blockRecommended));
      }

      const rows = await db
        .select({ id: issues.id })
        .from(issues)
        .where(and(...conditions))
        .orderBy(desc(issues.updatedAt), desc(issues.createdAt));

      const enriched = await Promise.all(rows.map((row) => issueSvc.getById(row.id)));
      return enriched
        .filter((issue): issue is HydratedSystemIssueRow => hasSystemIssueMetadata(issue))
        .map((issue) => toSystemIssueFromRow(issue));
    },

    getById: async (id: string) => {
      const issue = await issueSvc.getById(id);
      if (!hasSystemIssueMetadata(issue)) {
        return null;
      }
      const canonical = await systemProjects.getCanonical(issue.companyId);
      if (!canonical || issue.projectId !== canonical.id) {
        return null;
      }
      return toSystemIssueFromRow(issue);
    },

    create: async (companyId: string, data: CreateSystemIssueInput) => {
      const canonical = await systemProjects.ensureCanonical(companyId);
      const created = await issueSvc.create(companyId, {
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? "medium",
        status: "backlog",
        projectId: canonical.id,
        owningDepartmentId: null,
        departmentIntakeStatus: "ceo_intake",
        systemIssueType: data.systemIssueType,
        systemIssueSeverity: data.systemIssueSeverity,
        systemIssueWorkflowState: "open",
        blockRecommended: data.blockRecommended ?? false,
      });
      return toSystemIssueFromRow(created as HydratedSystemIssueRow);
    },

    update: async (id: string, patch: UpdateSystemIssueInput) => {
      const existing = await getSystemIssueOrThrow(id);
      const updated = await issueSvc.update(id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.systemIssueType !== undefined ? { systemIssueType: patch.systemIssueType } : {}),
        ...(patch.systemIssueSeverity !== undefined ? { systemIssueSeverity: patch.systemIssueSeverity } : {}),
      });
      if (!updated) throw notFound("System issue not found");
      if (!hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    route: async (
      id: string,
      owningDepartmentId: string | null,
      actor: { actorType: "user"; actorId: string; agentId?: null } | { actorType: "agent"; actorId: string; agentId: string },
    ) => {
      const existing = await getSystemIssueOrThrow(id);
      await assertDepartmentScope(existing.companyId, owningDepartmentId);
      const updated = await issueRouting.route(id, owningDepartmentId, actor);
      if (!hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    setBlockRecommendation: async (id: string, blockRecommended: boolean) => {
      await getSystemIssueOrThrow(id);
      const updated = await issueSvc.update(id, { blockRecommended });
      if (!updated) throw notFound("System issue not found");
      if (!hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    startTriage: async (id: string) => {
      const existing = await getSystemIssueOrThrow(id);
      if (existing.systemIssueWorkflowState !== "open") {
        throw conflict("Only open system issues can enter triage");
      }
      const updated = await issueSvc.update(id, { systemIssueWorkflowState: "triaging" });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    requestReview: async (
      id: string,
      actor: { actorType: "user"; actorId: string; agentId?: null } | { actorType: "agent"; actorId: string; agentId: string },
    ) => {
      const existing = await getSystemIssueOrThrow(id);
      if (!["triaging", "in_progress"].includes(existing.systemIssueWorkflowState)) {
        throw conflict("System issue must be in progress before review can be requested");
      }
      if (actor.actorType !== "agent") {
        throw forbidden("Only the current owning department minister may request review");
      }
      await assertCurrentOwningMinister(existing, actor.agentId);
      const updated = await issueSvc.update(id, { systemIssueWorkflowState: "pending_review" });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    review: async (
      id: string,
      actor: { actorType: "user"; actorId: string; agentId?: null } | { actorType: "agent"; actorId: string; agentId: string },
      approved: boolean,
    ) => {
      const existing = await getSystemIssueOrThrow(id);
      if (existing.systemIssueWorkflowState !== "pending_review") {
        throw conflict("Only pending review system issues can be reviewed");
      }
      if (actor.actorType === "agent") {
        await assertEligibleReviewer(existing, actor.agentId);
      }
      const nextWorkflowState = approved
        ? (existing.blockRecommended ? "ready_to_resume" : "review_passed")
        : "in_progress";
      const updated = await issueSvc.update(id, { systemIssueWorkflowState: nextWorkflowState });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    requestResume: async (
      id: string,
      actor: { actorType: "user"; actorId: string; agentId?: null } | { actorType: "agent"; actorId: string; agentId: string },
    ) => {
      const existing = await getSystemIssueOrThrow(id);
      if (!existing.blockRecommended) {
        throw conflict("System issue is not currently recommending a block");
      }
      if (!["review_passed", "ready_to_resume"].includes(existing.systemIssueWorkflowState)) {
        throw conflict("System issue must be review passed before resume can be requested");
      }
      if (actor.actorType === "agent") {
        await assertCurrentOwningMinister(existing, actor.agentId);
      }
      const updated = await issueSvc.update(id, { systemIssueWorkflowState: "ready_to_resume" });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    approveResume: async (id: string) => {
      const existing = await getSystemIssueOrThrow(id);
      if (existing.systemIssueWorkflowState !== "ready_to_resume") {
        throw conflict("Only ready-to-resume system issues can be resumed");
      }
      const updated = await issueSvc.update(id, {
        systemIssueWorkflowState: "in_progress",
        blockRecommended: false,
      });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },

    close: async (id: string) => {
      const existing = await getSystemIssueOrThrow(id);
      if (!["review_passed", "ready_to_resume"].includes(existing.systemIssueWorkflowState)) {
        throw conflict("System issue is not in a closable state");
      }
      const updated = await issueSvc.update(id, {
        systemIssueWorkflowState: "done",
        blockRecommended: false,
        status: "done",
      });
      if (!updated || !hasSystemIssueMetadata(updated)) throw unprocessable("Issue is not a system issue");
      return toSystemIssueFromRow(updated);
    },
  };
}
