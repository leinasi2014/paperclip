import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { departments, issues } from "@paperclipai/db";
import type { MinisterIntakeResponse } from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";
import { queueTemporaryWorkersForIssueRoutingChange } from "./temporary-workers.js";

type RoutingActor =
  | { actorType: "user"; actorId: string; agentId?: null }
  | { actorType: "agent"; actorId: string; agentId: string };

const CEO_INTAKE_STATUSES = new Set(["ceo_intake", "rejected", "needs_clarification"]);
const MINISTER_RETURN_TO_CEO = new Set<MinisterIntakeResponse>(["reject", "needs_clarification"]);
const CLOSED_ISSUE_STATUSES = new Set(["done", "cancelled"]);

function buildRoutingAuditPatch(actor: RoutingActor, at: Date) {
  return {
    routedAt: at,
    routedByAgentId: actor.actorType === "agent" ? actor.agentId : null,
    routedByUserId: actor.actorType === "user" ? actor.actorId : null,
  };
}

export function isIssueInCeoIntake(issue: {
  departmentIntakeStatus?: string | null;
  owningDepartmentId?: string | null;
}) {
  if (issue.departmentIntakeStatus && CEO_INTAKE_STATUSES.has(issue.departmentIntakeStatus)) {
    return true;
  }
  return !issue.departmentIntakeStatus && issue.owningDepartmentId == null;
}

export function issueRoutingService(db: Db) {
  const issueSvc = issueService(db);

  async function getRoutableIssue(id: string) {
    const issue = await issueSvc.getById(id);
    if (!issue) throw notFound("Issue not found");
    if (CLOSED_ISSUE_STATUSES.has(issue.status)) {
      throw conflict("Closed issues cannot be routed or intake-reviewed");
    }
    return issue;
  }

  async function getDepartmentForRouting(issueCompanyId: string, departmentId: string) {
    const department = await db
      .select()
      .from(departments)
      .where(eq(departments.id, departmentId))
      .then((rows) => rows[0] ?? null);
    if (!department) throw notFound("Department not found");
    if (department.companyId !== issueCompanyId) {
      throw unprocessable("Department must belong to the same company");
    }
    if (department.status !== "active") {
      throw unprocessable("Department must be active before an issue can be routed to it");
    }
    if (!department.ministerAgentId) {
      throw unprocessable("Department must have an active minister before it can accept routed work");
    }
    return department;
  }

  return {
    route: async (issueId: string, owningDepartmentId: string | null, actor: RoutingActor) => {
      const issue = await getRoutableIssue(issueId);
      const now = new Date();
      if (owningDepartmentId) {
        await getDepartmentForRouting(issue.companyId, owningDepartmentId);
      }
      const updated = await issueSvc.update(issueId, {
        owningDepartmentId,
        departmentIntakeStatus: owningDepartmentId ? "routed" : "ceo_intake",
        ...buildRoutingAuditPatch(actor, now),
        ministerDecisionResponse: null,
        ministerDecisionByAgentId: null,
        ministerDecisionAt: null,
        ministerDecisionReason: null,
      });
      if (!updated) throw notFound("Issue not found");
      if (issue.owningDepartmentId !== owningDepartmentId) {
        await queueTemporaryWorkersForIssueRoutingChange(db, issueId);
      }
      return {
        ...updated,
        isInCeoIntake: isIssueInCeoIntake(updated),
      };
    },

    ministerIntake: async (
      issueId: string,
      ministerAgentId: string,
      response: MinisterIntakeResponse,
      reason?: string | null,
    ) => {
      const issue = await getRoutableIssue(issueId);
      if (!issue.owningDepartmentId) {
        throw conflict("Issue must be routed to a department before minister intake");
      }
      if (issue.departmentIntakeStatus !== "routed") {
        throw conflict("Only routed issues can receive a minister intake decision");
      }

      const department = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, issue.owningDepartmentId), eq(departments.companyId, issue.companyId)))
        .then((rows) => rows[0] ?? null);
      if (!department) throw notFound("Department not found");
      if (department.status !== "active") {
        throw unprocessable("Department must be active before minister intake");
      }
      if (department.ministerAgentId !== ministerAgentId) {
        throw conflict("Only the current department minister can submit an intake decision");
      }

      const now = new Date();
      const patch = {
        owningDepartmentId: MINISTER_RETURN_TO_CEO.has(response) ? null : issue.owningDepartmentId,
        departmentIntakeStatus:
          response === "accept"
            ? "accepted"
            : response === "reject"
              ? "rejected"
              : "needs_clarification",
        ministerDecisionResponse: response,
        ministerDecisionByAgentId: ministerAgentId,
        ministerDecisionAt: now,
        ministerDecisionReason: reason?.trim() || null,
      } satisfies Partial<typeof issues.$inferInsert>;
      const updated = await issueSvc.update(issueId, patch);
      if (!updated) throw notFound("Issue not found");
      if (MINISTER_RETURN_TO_CEO.has(response)) {
        await queueTemporaryWorkersForIssueRoutingChange(db, issueId, "minister_returned_issue_to_ceo");
      }
      return {
        ...updated,
        isInCeoIntake: isIssueInCeoIntake(updated),
      };
    },
  };
}
