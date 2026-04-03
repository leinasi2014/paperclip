import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { projects } from "@paperclipai/db";
import { deriveProjectUrlKey, type Project } from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";

const SYSTEM_PROJECT_KIND = "execution_governance";
const SYSTEM_PROJECT_NAME = "System Governance";
const SYSTEM_PROJECT_DESCRIPTION =
  "Company-level system governance project for execution incidents, skill gaps, and governance issues.";

function toProject(row: typeof projects.$inferSelect): Project {
  return {
    ...row,
    urlKey: deriveProjectUrlKey(row.name, row.id),
    goalId: row.goalId,
    goalIds: [],
    goals: [],
    workspaces: [],
    primaryWorkspace: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "",
      effectiveLocalFolder: "",
      origin: "managed_checkout",
    },
    executionWorkspacePolicy: null,
    status: row.status as Project["status"],
    pauseReason: row.pauseReason as Project["pauseReason"],
  } as Project;
}

export function systemProjectService(db: Db) {
  async function listCanonicalCandidates(companyId: string) {
    return db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.companyId, companyId),
          eq(projects.isSystemProject, true),
          eq(projects.systemProjectKind, SYSTEM_PROJECT_KIND),
        ),
      )
      .orderBy(asc(projects.createdAt), asc(projects.id));
  }

  return {
    kind: SYSTEM_PROJECT_KIND,

    getCanonical: async (companyId: string) => {
      const row = await listCanonicalCandidates(companyId).then((rows) => rows[0] ?? null);
      return row ? toProject(row) : null;
    },

    isSystemProject: async (projectId: string) => {
      const row = await db
        .select({ isSystemProject: projects.isSystemProject })
        .from(projects)
        .where(eq(projects.id, projectId))
        .then((rows) => rows[0] ?? null);
      return Boolean(row?.isSystemProject);
    },

    assertNotSystemProject: async (projectId: string) => {
      const row = await db
        .select({
          id: projects.id,
          isSystemProject: projects.isSystemProject,
          systemProjectKind: projects.systemProjectKind,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Project not found");
      if (row.isSystemProject) {
        throw conflict("Cannot delete or archive the system governance project");
      }
    },

    ensureCanonical: async (companyId: string) => {
      const existing = await listCanonicalCandidates(companyId).then((rows) => rows[0] ?? null);
      if (existing) return toProject(existing);

      const created = await db
        .insert(projects)
        .values({
          companyId,
          name: SYSTEM_PROJECT_NAME,
          description: SYSTEM_PROJECT_DESCRIPTION,
          status: "planned",
          isSystemProject: true,
          systemProjectKind: SYSTEM_PROJECT_KIND,
        })
        .returning()
        .then((rows) => rows[0] ?? null);
      if (!created) throw notFound("System project not created");
      return toProject(created);
    },

    reconcile: async (companyId: string) =>
      db.transaction(async (tx) => {
        const candidates = await tx
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.companyId, companyId),
              eq(projects.isSystemProject, true),
              eq(projects.systemProjectKind, SYSTEM_PROJECT_KIND),
            ),
          )
          .orderBy(asc(projects.createdAt), asc(projects.id));

        if (candidates.length === 0) {
          const created = await tx
            .insert(projects)
            .values({
              companyId,
              name: SYSTEM_PROJECT_NAME,
              description: SYSTEM_PROJECT_DESCRIPTION,
              status: "planned",
              isSystemProject: true,
              systemProjectKind: SYSTEM_PROJECT_KIND,
            })
            .returning()
            .then((rows) => rows[0] ?? null);
          if (!created) throw notFound("System project not created");
          return toProject(created);
        }

        const canonical = candidates[0]!;
        const duplicateIds = candidates.slice(1).map((project) => project.id);
        if (duplicateIds.length > 0) {
          await tx
            .update(projects)
            .set({
              isSystemProject: false,
              systemProjectKind: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(projects.companyId, companyId),
                inArray(projects.id, duplicateIds),
              ),
            );
        }

        return toProject(canonical);
      }),
  };
}
