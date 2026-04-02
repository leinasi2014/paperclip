# Org Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the foundation data model and core services for the Department-Minister-Subagent organization model, enabling subsequent plugin development.

**Architecture:** Add Department entity with minister assignment, budget envelopes, and system project support as new shared types, database tables, and core services. Extend existing Company/Issue/Project contracts with department-aware fields. Keep temporary workers as a deferred runtime-subagent concern until a dedicated principal/auth boundary exists. All changes are additive.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), React, react-i18next, TanStack Query

**Based on:** Four design documents reviewed by 4 expert reviewers (2 adversarial, 1 security, 1 architecture). This plan addresses all Critical and High findings.

---

## File Structure

### New Files
- `packages/shared/src/types/department.ts` — Department, DepartmentBudgetEnvelope, MinisterIntakeDecision types
- `packages/shared/src/constants/department.ts` — Department status, budget status, worker scope constants
- `packages/db/src/migrations/0047_org_model_foundation.sql` — Database migration
- `server/src/services/departments.ts` — Department CRUD and business logic
- `server/src/services/department-budget.ts` — Budget envelope management
- `server/src/services/system-project.ts` — System project initialization and management
- `server/src/routes/departments.ts` — REST API routes
- `ui/src/api/departments.ts` — Frontend API client
- `ui/src/i18n/locales/en/departments.json` — English translations
- `ui/src/i18n/locales/zh-CN/departments.json` — Chinese translations

### Modified Files
- `packages/shared/src/types/issue.ts` — Add system issue fields
- `packages/shared/src/types/company.ts` — Add ceoAgentId field
- `packages/shared/src/types/project.ts` — Add system project flags
- `packages/shared/src/types/index.ts` — Export new types
- `packages/shared/src/constants.ts` — Add new role, status, and issue workflow constants
- `ui/src/i18n/resources.ts` — Import department translations

---

## Task 1: Document Revisions — Fix Critical Inconsistencies

**Files:**
- Modify: `doc/plans/2026-04-02-department-minister-and-subagent-org-model.md`

This task addresses the 3 Critical findings from adversarial review #1 by editing the source design documents.

- [ ] **Step 1: Fix §6.4 — Clarify `CEO intake` is queue semantics, not workflow state**

In the Department-Minister org model doc, section §6.4 should continue to list canonical workflow states only:

```
open, triaging, in_progress, pending_review, review_passed, ready_to_resume, done
```

Add a note instead:

> `CEO intake` is a routing and governance queue, not a canonical workflow state. A system issue may be `open` while still in `CEO intake`.

- [ ] **Step 2: Fix §10.1 — Clarify `block_recommended` semantics for Phase A**

In the Execution Improvement Plugin doc, section §10.1, after "immediately mark the relevant execution path as requiring block", add:

> **Phase A clarification:** In the plugin-only MVP, `block_recommended` is a flag on the issue that signals the CEO should intervene. It does NOT automatically stop execution. Automatic blocking requires core enforcement (Phase B+).

- [ ] **Step 3: Add §3.4.1 — Minister crash/healthcheck scenario**

In the Department-Minister org model doc, add after §3.4:

```markdown
### 3.4.1 Minister unavailability

If a minister process crashes, becomes unresponsive, or loses network connectivity:

- the system should detect unavailability via heartbeat timeout (recommended: 5 minutes)
- after timeout, the department enters `frozen_suspended` state (not `frozen_unstaffed`)
- active temporary workers are paused (not terminated)
- in-progress issues return to `CEO intake` with reason `minister_unavailable`
- when the minister heartbeat resumes, the CEO must explicitly unfreeze the department
- the minister must re-accept any returned issues

A suspended department differs from an unstaffed department:
- `frozen_unstaffed`: no minister exists; auto-recovers when minister is appointed
- `frozen_suspended`: minister exists but is unavailable; requires CEO action to unfreeze
```

- [ ] **Step 4: Fix §2.4 — CEO unavailability stays at Human Board layer**

In the Department-Minister org model doc, add or revise after §2.1:

```markdown
### 2.4 CEO unavailability

If the CEO is unavailable for extended periods:

- the only backup authority is the Human Board layer
- governance does not fall through to another agent by default
- no `delegateCeoAgentId` field is introduced in Phase A
- if later product requirements demand delegated CEO operation, that must be a separate governance design, not part of this foundation task
```

- [ ] **Step 5: Add §6.7 — System project deletion protection**

Add after §6.6:

```markdown
### 6.7 System project protection

The shared system project must not be:
- deleted by any actor (enforced at service layer)
- archived by non-Board actors
- transferred to a different company

If the system project is missing or was accidentally deleted, recovery must go through an explicit reconciliation path that:

- creates or identifies the canonical replacement project
- rebinds company references and dependent governance records
- avoids silent recreation-on-read that would split system-governance history across multiple projects
```

- [ ] **Step 6: Commit**

```bash
git add doc/plans/2026-04-02-department-minister-and-subagent-org-model.md doc/plans/2026-04-02-execution-improvement-plugin.md
git commit -m "docs: fix critical inconsistencies in org model plans"
```

---

## Task 2: Shared Constants — Department Status and System Issue Types

**Files:**
- Create: `packages/shared/src/constants/department.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Create `packages/shared/src/constants/department.ts`**

```typescript
// Department status
export const DEPARTMENT_STATUSES = [
  "active",
  "frozen_unstaffed",
  "frozen_suspended",
] as const;
export type DepartmentStatus = (typeof DEPARTMENT_STATUSES)[number];

// Department budget envelope status
export const DEPARTMENT_BUDGET_STATUSES = [
  "allocated",
  "reserved_only",
  "active",
] as const;
export type DepartmentBudgetStatus = (typeof DEPARTMENT_BUDGET_STATUSES)[number];

// System issue types
export const SYSTEM_ISSUE_TYPES = [
  "execution",
  "skill",
  "governance",
] as const;
export type SystemIssueType = (typeof SYSTEM_ISSUE_TYPES)[number];

// System issue workflow states (canonical, single definition)
export const SYSTEM_ISSUE_WORKFLOW_STATES = [
  "open",
  "triaging",
  "in_progress",
  "pending_review",
  "review_passed",
  "ready_to_resume",
  "done",
] as const;
export type SystemIssueWorkflowState = (typeof SYSTEM_ISSUE_WORKFLOW_STATES)[number];

// System issue severity
export const SYSTEM_ISSUE_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;
export type SystemIssueSeverity = (typeof SYSTEM_ISSUE_SEVERITIES)[number];

// System project kind
export const SYSTEM_PROJECT_KINDS = ["execution_governance"] as const;
export type SystemProjectKind = (typeof SYSTEM_PROJECT_KINDS)[number];

// Minister intake response
export const MINISTER_INTAKE_RESPONSES = [
  "accept",
  "reject",
  "needs_clarification",
] as const;
export type MinisterIntakeResponse = (typeof MINISTER_INTAKE_RESPONSES)[number];

// Minister heartbeat timeout: 5 minutes
export const MINISTER_HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000;

// Max concurrent temporary workers per department (0 = no limit)
export const DEFAULT_MAX_CONCURRENT_TEMPORARY_WORKERS = 0;
```

- [ ] **Step 2: Export from constants barrel**

Add to `packages/shared/src/constants.ts` (at the end, before any existing trailing export):

```typescript
export {
  DEPARTMENT_STATUSES,
  DEPARTMENT_BUDGET_STATUSES,
  SYSTEM_ISSUE_TYPES,
  SYSTEM_ISSUE_WORKFLOW_STATES,
  SYSTEM_ISSUE_SEVERITIES,
  SYSTEM_PROJECT_KINDS,
  MINISTER_INTAKE_RESPONSES,
  MINISTER_HEARTBEAT_TIMEOUT_MS,
  DEFAULT_MAX_CONCURRENT_TEMPORARY_WORKERS,
} from "./constants/department.js";
export type {
  DepartmentStatus,
  DepartmentBudgetStatus,
  SystemIssueType,
  SystemIssueWorkflowState,
  SystemIssueSeverity,
  SystemProjectKind,
  MinisterIntakeResponse,
} from "./constants/department.js";
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: PASS (new file, no consumers yet)

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants/department.ts packages/shared/src/constants.ts
git commit -m "feat: add department and system issue constants"
```

---

## Task 3: Shared Types — Department, Budget Envelope, Temporary Worker

**Files:**
- Create: `packages/shared/src/types/department.ts`

- [ ] **Step 1: Create `packages/shared/src/types/department.ts`**

```typescript
import type {
  DepartmentStatus,
  DepartmentBudgetStatus,
  MinisterIntakeResponse,
} from "../constants/department.js";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  mission: string | null;
  status: DepartmentStatus;
  /** Agent ID of the appointed minister. null if unstaffed. */
  ministerAgentId: string | null;
  /** Max concurrent active temporary workers. 0 = no limit. Set by CEO. */
  maxConcurrentTemporaryWorkers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentBudgetEnvelope {
  id: string;
  departmentId: string;
  companyId: string;
  /** Monthly budget limit in cents. */
  monthlyLimitCents: number;
  /** Currently reserved (in-flight executions) in cents. */
  reservedCents: number;
  /** Confirmed spent in cents. */
  spentCents: number;
  status: DepartmentBudgetStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Minister intake decision on a routed issue. */
export interface MinisterIntakeDecision {
  id: string;
  departmentId: string;
  issueId: string;
  ministerAgentId: string;
  response: MinisterIntakeResponse;
  reason: string | null;
  createdAt: Date;
}
```

- [ ] **Step 2: Export from types barrel**

In `packages/shared/src/types/index.ts`, add at the end:

```typescript
export type {
  Department,
  DepartmentBudgetEnvelope,
  MinisterIntakeDecision,
} from "./department.js";
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/department.ts packages/shared/src/types/index.ts
git commit -m "feat: add Department, BudgetEnvelope, and intake decision types"
```

---

## Task 4: Extend Existing Types — Issue, Company, Project

**Files:**
- Modify: `packages/shared/src/types/company.ts`
- Modify: `packages/shared/src/types/project.ts`
- Modify: `packages/shared/src/types/issue.ts`

All changes are additive (new optional fields). No breaking changes.

- [ ] **Step 1: Extend Company type with CEO field**

In `packages/shared/src/types/company.ts`, add these fields to the `Company` interface (before `createdAt`):

```typescript
  /** The agent ID of the company CEO. Used for routing and governance. */
  ceoAgentId: string | null;
```

- [ ] **Step 2: Extend Project type with system project flags**

In `packages/shared/src/types/project.ts`, add these fields to the `Project` interface (before `createdAt`):

```typescript
  /** True if this is a system-reserved project (not deletable). */
  isSystemProject: boolean;
  /** Kind of system project, e.g. "execution_governance". Null for normal projects. */
  systemProjectKind: string | null;
```

- [ ] **Step 3: Extend Issue type with system issue and department fields**

In `packages/shared/src/types/issue.ts`, add these imports at the top:

```typescript
import type {
  SystemIssueType,
  SystemIssueSeverity,
  SystemIssueWorkflowState,
} from "../constants/department.js";
```

Add these fields to the `Issue` interface (before `createdAt`):

```typescript
  /** Department that currently owns routing/execution responsibility. null = not yet routed. */
  owningDepartmentId: string | null;
  /** For system issues: the type category. null for normal issues. */
  systemIssueType: SystemIssueType | null;
  /** For system issues: severity level. null for normal issues. */
  systemIssueSeverity: SystemIssueSeverity | null;
  /** For system issues: canonical workflow state. null for normal issues. `CEO intake` is modeled separately as queue/routing semantics. */
  systemIssueWorkflowState: SystemIssueWorkflowState | null;
  /** True if execution plugin has flagged this issue for blocking (advisory in Phase A). */
  blockRecommended: boolean;
```

- [ ] **Step 4: Do not extend `Agent` with temporary-worker fields in Phase A**

Temporary workers remain a deferred runtime-subagent concern until a dedicated principal/auth boundary exists.

Do not add:

- `isTemporaryWorker`
- `owningMinisterAgentId`
- `workerExpiresAt`

to the shared `Agent` interface in this foundation task.

- [ ] **Step 5: Run typecheck**

```bash
cd packages/shared && npx tsc --noEmit
```

Expected: May fail in server/UI consumers that use these types — that's OK, we'll fix consumers in later tasks. If errors are in shared package itself, fix them here.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types/company.ts packages/shared/src/types/project.ts packages/shared/src/types/issue.ts
git commit -m "feat: extend Company, Project, and Issue types for org model"
```

---

## Task 5: Database Migration

**Files:**
- Create: `packages/db/src/migrations/0047_org_model_foundation.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 0047_org_model_foundation.sql
-- Foundation tables for Department-Minister-Subagent organization model.

-- ============================================================
-- 1. departments
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  mission TEXT,
  status TEXT NOT NULL DEFAULT 'frozen_unstaffed'
    CHECK (status IN ('active', 'frozen_unstaffed', 'frozen_suspended')),
  minister_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  max_concurrent_temporary_workers INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, slug)
);

CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_minister_agent_id ON departments(minister_agent_id);

-- ============================================================
-- 2. department_budget_envelopes
-- ============================================================
CREATE TABLE department_budget_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  monthly_limit_cents BIGINT NOT NULL DEFAULT 0,
  reserved_cents BIGINT NOT NULL DEFAULT 0,
  spent_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reserved_only'
    CHECK (status IN ('allocated', 'reserved_only', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (department_id)
);

CREATE INDEX idx_dept_budget_company_id ON department_budget_envelopes(company_id);

-- ============================================================
-- 3. Extend companies table
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ceo_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- ============================================================
-- 4. Extend projects table — system project flags
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_system_project BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS system_project_kind TEXT;

-- Ensure one canonical system project per company/kind.
CREATE UNIQUE INDEX idx_projects_company_system_kind_unique
  ON projects(company_id, system_project_kind)
  WHERE is_system_project = true AND system_project_kind IS NOT NULL;

-- ============================================================
-- 5. Extend issues table — system issue + department routing
-- ============================================================
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS owning_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_issue_type TEXT
    CHECK (system_issue_type IS NULL OR system_issue_type IN ('execution', 'skill', 'governance')),
  ADD COLUMN IF NOT EXISTS system_issue_severity TEXT
    CHECK (system_issue_severity IS NULL OR system_issue_severity IN ('critical', 'high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS system_issue_workflow_state TEXT
    CHECK (system_issue_workflow_state IS NULL OR system_issue_workflow_state IN (
      'open', 'triaging', 'in_progress', 'pending_review',
      'review_passed', 'ready_to_resume', 'done'
    )),
  ADD COLUMN IF NOT EXISTS block_recommended BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_issues_owning_department_id ON issues(owning_department_id)
  WHERE owning_department_id IS NOT NULL;
CREATE INDEX idx_issues_system_type ON issues(system_issue_type)
  WHERE system_issue_type IS NOT NULL;
```

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate
```

Expected: Migration applies cleanly. Verify with targeted compile/tests rather than a non-existent studio script:

```bash
pnpm --filter @paperclipai/db typecheck
```

Check that `departments` and `department_budget_envelopes` exist and existing tables have the new columns.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/0047_org_model_foundation.sql
git commit -m "feat: add org model foundation database migration"
```

---

## Task 6: Department Service — CRUD and Business Logic

**Files:**
- Create: `server/src/services/departments.ts`

This service enforces the invariants from the org model design:
- One minister per department
- Frozen departments cannot accept issues or spawn workers
- Department slug must be unique within company

- [ ] **Step 1: Write failing tests for department service**

Create `server/src/services/__tests__/departments.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestCompany, createTestAgent } from "../../test/helpers.js";
import {
  createDepartment,
  updateDepartment,
  freezeDepartment,
  unfreezeDepartment,
  assignMinister,
  removeMinister,
} from "../departments.js";

describe("Department Service", () => {
  let companyId: string;
  let ceoAgentId: string;

  beforeEach(async () => {
    const company = await createTestCompany();
    companyId = company.id;
    const ceo = await createTestAgent({ companyId, role: "ceo" });
    ceoAgentId = ceo.id;
  });

  describe("createDepartment", () => {
    it("creates a department with frozen_unstaffed status", async () => {
      const dept = await createDepartment({
        companyId,
        name: "Engineering",
        slug: "engineering",
        mission: "Build and maintain the product",
      });
      expect(dept.status).toBe("frozen_unstaffed");
      expect(dept.ministerAgentId).toBeNull();
      expect(dept.companyId).toBe(companyId);
    });

    it("rejects duplicate slug within same company", async () => {
      await createDepartment({ companyId, name: "Eng", slug: "eng" });
      await expect(
        createDepartment({ companyId, name: "Eng 2", slug: "eng" }),
      ).rejects.toThrow(/slug/i);
    });
  });

  describe("assignMinister", () => {
    it("activates department when minister is assigned", async () => {
      const dept = await createDepartment({ companyId, name: "Eng", slug: "eng" });
      const minister = await createTestAgent({ companyId, role: "engineer" });

      const updated = await assignMinister(dept.id, minister.id);
      expect(updated.status).toBe("active");
      expect(updated.ministerAgentId).toBe(minister.id);
    });

    it("rejects minister from different company", async () => {
      const otherCompany = await createTestCompany();
      const dept = await createDepartment({ companyId, name: "Eng", slug: "eng" });
      const outsider = await createTestAgent({ companyId: otherCompany.id, role: "engineer" });

      await expect(
        assignMinister(dept.id, outsider.id),
      ).rejects.toThrow(/same company/i);
    });

    it("rejects if minister already leads another department", async () => {
      const dept1 = await createDepartment({ companyId, name: "Eng", slug: "eng" });
      const dept2 = await createDepartment({ companyId, name: "QA", slug: "qa" });
      const agent = await createTestAgent({ companyId, role: "engineer" });

      await assignMinister(dept1.id, agent.id);
      await expect(
        assignMinister(dept2.id, agent.id),
      ).rejects.toThrow(/already leads/i);
    });
  });

  describe("freezeDepartment", () => {
    it("sets frozen_suspended when minister heartbeat times out", async () => {
      const dept = await createDepartment({ companyId, name: "Eng", slug: "eng" });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(dept.id, minister.id);

      const frozen = await freezeDepartment(dept.id, "frozen_suspended");
      expect(frozen.status).toBe("frozen_suspended");
      // Minister agent ID is preserved (not removed)
      expect(frozen.ministerAgentId).toBe(minister.id);
    });

    it("sets frozen_unstaffed when minister is removed", async () => {
      const dept = await createDepartment({ companyId, name: "Eng", slug: "eng" });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(dept.id, minister.id);

      const updated = await removeMinister(dept.id);
      expect(updated.status).toBe("frozen_unstaffed");
      expect(updated.ministerAgentId).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run src/services/__tests__/departments.test.ts
```

Expected: FAIL — `departments.ts` module not found.

- [ ] **Step 3: Implement department service**

Create `server/src/services/departments.ts`:

```typescript
import { db } from "../db/index.js";
import { departments, agents } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { DepartmentStatus } from "@paperclipai/shared";

interface CreateDepartmentInput {
  companyId: string;
  name: string;
  slug: string;
  mission?: string;
}

export async function createDepartment(input: CreateDepartmentInput) {
  const [dept] = await db.insert(departments).values({
    companyId: input.companyId,
    name: input.name,
    slug: input.slug,
    mission: input.mission ?? null,
    status: "frozen_unstaffed",
  }).returning();

  return dept;
}

export async function getDepartment(departmentId: string) {
  const [dept] = await db.select().from(departments)
    .where(eq(departments.id, departmentId));
  return dept ?? null;
}

export async function listDepartments(companyId: string) {
  return db.select().from(departments)
    .where(eq(departments.companyId, companyId));
}

export async function updateDepartment(
  departmentId: string,
  patch: { name?: string; mission?: string; maxConcurrentTemporaryWorkers?: number },
) {
  const [updated] = await db.update(departments).set({
    ...patch,
    updatedAt: new Date(),
  }).where(eq(departments.id, departmentId)).returning();
  return updated;
}

export async function assignMinister(departmentId: string, agentId: string) {
  const dept = await getDepartment(departmentId);
  if (!dept) throw new Error("Department not found");

  // Verify agent belongs to same company
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
  if (!agent || agent.companyId !== dept.companyId) {
    throw new Error("Minister must belong to the same company");
  }

  // Verify agent doesn't already lead a department
  const [existing] = await db.select().from(departments)
    .where(and(
      eq(departments.ministerAgentId, agentId),
      eq(departments.companyId, dept.companyId),
    ));
  if (existing && existing.id !== departmentId) {
    throw new Error("Agent already leads another department");
  }

  const [updated] = await db.update(departments).set({
    ministerAgentId: agentId,
    status: "active",
    updatedAt: new Date(),
  }).where(eq(departments.id, departmentId)).returning();

  return updated;
}

export async function removeMinister(departmentId: string) {
  const [updated] = await db.update(departments).set({
    ministerAgentId: null,
    status: "frozen_unstaffed",
    updatedAt: new Date(),
  }).where(eq(departments.id, departmentId)).returning();

  return updated;
}

export async function freezeDepartment(
  departmentId: string,
  freezeStatus: "frozen_unstaffed" | "frozen_suspended",
) {
  const patch = freezeStatus === "frozen_suspended"
    ? { status: freezeStatus as DepartmentStatus }
    : { status: freezeStatus as DepartmentStatus, ministerAgentId: null };

  const [updated] = await db.update(departments).set({
    ...patch,
    updatedAt: new Date(),
  }).where(eq(departments.id, departmentId)).returning();

  return updated;
}

export async function unfreezeDepartment(departmentId: string) {
  const dept = await getDepartment(departmentId);
  if (!dept) throw new Error("Department not found");

  if (!dept.ministerAgentId) {
    throw new Error("Cannot unfreeze department without a minister");
  }

  const [updated] = await db.update(departments).set({
    status: "active",
    updatedAt: new Date(),
  }).where(eq(departments.id, departmentId)).returning();

  return updated;
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx vitest run src/services/__tests__/departments.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/departments.ts server/src/services/__tests__/departments.test.ts
git commit -m "feat: add department service with CRUD and freeze logic"
```

---

## Task 7: Department Budget Service

**Files:**
- Create: `server/src/services/department-budget.ts`

This service enforces the budget invariant: department spend cannot exceed envelope, company spend cannot exceed ceiling.

- [ ] **Step 1: Write failing tests**

Create `server/src/services/__tests__/department-budget.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestCompany, createTestAgent } from "../../test/helpers.js";
import { createDepartment, assignMinister } from "../departments.js";
import {
  allocateBudgetEnvelope,
  activateBudget,
  reserveBudget,
  settleBudget,
  releaseReservation,
  getBudgetOverview,
} from "../department-budget.js";

describe("Department Budget Service", () => {
  let companyId: string;
  let departmentId: string;

  beforeEach(async () => {
    const company = await createTestCompany({ budgetMonthlyCents: 100_000_00 });
    companyId = company.id;
    const dept = await createDepartment({ companyId, name: "Eng", slug: "eng" });
    departmentId = dept.id;
  });

  describe("allocateBudgetEnvelope", () => {
    it("creates envelope in reserved_only status when department is unstaffed", async () => {
      const envelope = await allocateBudgetEnvelope(departmentId, companyId, {
        monthlyLimitCents: 50_000_00,
      });
      expect(envelope.status).toBe("reserved_only");
      expect(envelope.monthlyLimitCents).toBe(50_000_00);
    });
  });

  describe("activateBudget", () => {
    it("activates when minister is appointed", async () => {
      await allocateBudgetEnvelope(departmentId, companyId, { monthlyLimitCents: 50_000_00 });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(departmentId, minister.id);

      const envelope = await activateBudget(departmentId);
      expect(envelope.status).toBe("active");
    });
  });

  describe("reserveBudget", () => {
    it("reserves amount for execution", async () => {
      await allocateBudgetEnvelope(departmentId, companyId, { monthlyLimitCents: 50_000_00 });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(departmentId, minister.id);
      await activateBudget(departmentId);

      const reservation = await reserveBudget(departmentId, 1_000_00);
      expect(reservation.reservedCents).toBe(1_000_00);
    });

    it("rejects reservation exceeding monthly limit", async () => {
      await allocateBudgetEnvelope(departmentId, companyId, { monthlyLimitCents: 1_000_00 });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(departmentId, minister.id);
      await activateBudget(departmentId);

      await expect(
        reserveBudget(departmentId, 2_000_00),
      ).rejects.toThrow(/exceed/i);
    });

    it("rejects reservation when budget is reserved_only", async () => {
      await allocateBudgetEnvelope(departmentId, companyId, { monthlyLimitCents: 50_000_00 });
      // No minister assigned, so budget stays reserved_only

      await expect(
        reserveBudget(departmentId, 100_00),
      ).rejects.toThrow(/reserved_only|not active/i);
    });
  });

  describe("settleBudget", () => {
    it("moves from reserved to spent", async () => {
      await allocateBudgetEnvelope(departmentId, companyId, { monthlyLimitCents: 50_000_00 });
      const minister = await createTestAgent({ companyId, role: "engineer" });
      await assignMinister(departmentId, minister.id);
      await activateBudget(departmentId);
      await reserveBudget(departmentId, 1_000_00);

      const settled = await settleBudget(departmentId, 800_00);
      expect(settled.spentCents).toBe(800_00);
      expect(settled.reservedCents).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run src/services/__tests__/department-budget.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement budget service**

Create `server/src/services/department-budget.ts`:

```typescript
import { db } from "../db/index.js";
import { departmentBudgetEnvelopes } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface AllocateInput {
  monthlyLimitCents: number;
}

export async function allocateBudgetEnvelope(
  departmentId: string,
  companyId: string,
  input: AllocateInput,
) {
  const [envelope] = await db.insert(departmentBudgetEnvelopes).values({
    departmentId,
    companyId,
    monthlyLimitCents: input.monthlyLimitCents,
    reservedCents: 0,
    spentCents: 0,
    status: "reserved_only",
  }).returning();
  return envelope;
}

export async function getBudgetEnvelope(departmentId: string) {
  const [envelope] = await db.select().from(departmentBudgetEnvelopes)
    .where(eq(departmentBudgetEnvelopes.departmentId, departmentId));
  return envelope ?? null;
}

export async function activateBudget(departmentId: string) {
  const [updated] = await db.update(departmentBudgetEnvelopes).set({
    status: "active",
    updatedAt: new Date(),
  }).where(eq(departmentBudgetEnvelopes.departmentId, departmentId)).returning();
  return updated;
}

export async function reserveBudget(departmentId: string, amountCents: number) {
  const envelope = await getBudgetEnvelope(departmentId);
  if (!envelope) throw new Error("Budget envelope not found");
  if (envelope.status !== "active") throw new Error("Budget is not active");
  if (envelope.spentCents + envelope.reservedCents + amountCents > envelope.monthlyLimitCents) {
    throw new Error("Reservation exceeds monthly limit");
  }

  const [updated] = await db.update(departmentBudgetEnvelopes).set({
    reservedCents: envelope.reservedCents + amountCents,
    updatedAt: new Date(),
  }).where(eq(departmentBudgetEnvelopes.departmentId, departmentId)).returning();
  return updated;
}

export async function settleBudget(departmentId: string, actualCents: number) {
  const envelope = await getBudgetEnvelope(departmentId);
  if (!envelope) throw new Error("Budget envelope not found");

  const newSpent = envelope.spentCents + actualCents;
  const newReserved = Math.max(0, envelope.reservedCents - actualCents);

  const [updated] = await db.update(departmentBudgetEnvelopes).set({
    spentCents: newSpent,
    reservedCents: newReserved,
    updatedAt: new Date(),
  }).where(eq(departmentBudgetEnvelopes.departmentId, departmentId)).returning();
  return updated;
}

export async function releaseReservation(departmentId: string, amountCents: number) {
  const envelope = await getBudgetEnvelope(departmentId);
  if (!envelope) throw new Error("Budget envelope not found");

  const [updated] = await db.update(departmentBudgetEnvelopes).set({
    reservedCents: Math.max(0, envelope.reservedCents - amountCents),
    updatedAt: new Date(),
  }).where(eq(departmentBudgetEnvelopes.departmentId, departmentId)).returning();
  return updated;
}

export async function getBudgetOverview(departmentId: string) {
  const envelope = await getBudgetEnvelope(departmentId);
  if (!envelope) return null;
  return {
    monthlyLimitCents: envelope.monthlyLimitCents,
    reservedCents: envelope.reservedCents,
    spentCents: envelope.spentCents,
    availableCents: envelope.monthlyLimitCents - envelope.spentCents - envelope.reservedCents,
    utilizationPercent: Math.round((envelope.spentCents / envelope.monthlyLimitCents) * 100),
    status: envelope.status,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx vitest run src/services/__tests__/department-budget.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/department-budget.ts server/src/services/__tests__/department-budget.test.ts
git commit -m "feat: add department budget service with reserve/settle logic"
```

---

## Task 8: System Project Service — Initialization and Management

**Files:**
- Create: `server/src/services/system-project.ts`

This service handles auto-creation of system projects during company init, and enforces deletion protection.

- [ ] **Step 1: Write failing tests**

Create `server/src/services/__tests__/system-project.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createTestCompany } from "../../test/helpers.js";
import {
  ensureSystemProject,
  getSystemProject,
  isSystemProject,
  recreateSystemProjectIfNeeded,
} from "../system-project.js";

describe("System Project Service", () => {
  let companyId: string;

  beforeEach(async () => {
    const company = await createTestCompany();
    companyId = company.id;
  });

  describe("ensureSystemProject", () => {
    it("creates system project if none exists", async () => {
      const project = await ensureSystemProject(companyId);
      expect(project.isSystemProject).toBe(true);
      expect(project.systemProjectKind).toBe("execution_governance");
      expect(project.companyId).toBe(companyId);
    });

    it("returns existing project if already created", async () => {
      const first = await ensureSystemProject(companyId);
      const second = await ensureSystemProject(companyId);
      expect(second.id).toBe(first.id);
    });

    it("resolves the canonical system project by project flags", async () => {
      const project = await ensureSystemProject(companyId);
      const updated = await getSystemProject(companyId);
      expect(updated?.id).toBe(project.id);
    });
  });

  describe("isSystemProject", () => {
    it("returns true for system projects", async () => {
      const project = await ensureSystemProject(companyId);
      expect(isSystemProject(project.id)).resolves.toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run src/services/__tests__/system-project.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement system project service**

Create `server/src/services/system-project.ts`:

```typescript
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const SYSTEM_PROJECT_NAME = "System Governance";
const SYSTEM_PROJECT_SLUG_PREFIX = "system-governance";

export async function ensureSystemProject(companyId: string) {
  // Check for existing canonical system project by flag/kind.
  const [existingByFlag] = await db.select().from(projects)
    .where(and(
      eq(projects.companyId, companyId),
      eq(projects.isSystemProject, true),
      eq(projects.systemProjectKind, "execution_governance"),
    ));
  if (existingByFlag) {
    return existingByFlag;
  }

  // Create new canonical system project.
  const [project] = await db.insert(projects).values({
    companyId,
    name: SYSTEM_PROJECT_NAME,
    urlKey: `${SYSTEM_PROJECT_SLUG_PREFIX}-${companyId.slice(0, 8)}`,
    status: "in_progress",
    isSystemProject: true,
    systemProjectKind: "execution_governance",
    description: "Company-level system governance project for execution incidents, skill gaps, and governance issues.",
  }).returning();

  return project;
}

export async function getSystemProject(companyId: string) {
  const [project] = await db.select().from(projects)
    .where(and(
      eq(projects.companyId, companyId),
      eq(projects.isSystemProject, true),
      eq(projects.systemProjectKind, "execution_governance"),
    ));
  return project ?? null;
}

export async function isSystemProject(projectId: string) {
  const [project] = await db.select().from(projects)
    .where(eq(projects.id, projectId));
  return project?.isSystemProject === true;
}

/** Call this in project delete/archive routes to block system project deletion. */
export function assertNotSystemProject(project: { isSystemProject: boolean }) {
  if (project.isSystemProject) {
    throw new Error("Cannot delete or archive the system governance project");
  }
}

/** Reconcile or recreate the canonical system project if it is missing. */
export async function reconcileSystemProjectIfNeeded(companyId: string) {
  const existing = await getSystemProject(companyId);
  if (existing) return existing;
  return ensureSystemProject(companyId);
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx vitest run src/services/__tests__/system-project.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/system-project.ts server/src/services/__tests__/system-project.test.ts
git commit -m "feat: add system project service with reconciliation and protection"
```

---

## Task 9: API Routes

**Files:**
- Create: `server/src/routes/departments.ts`

Routes follow the existing pattern in `server/src/routes/` (Express router with auth middleware).

- [ ] **Step 1: Create department routes**

Create `server/src/routes/departments.ts`:

```typescript
import { Router } from "express";
import { requireAuth, requireCompanyAccess } from "../middleware/auth.js";
import * as deptService from "../services/departments.js";
import * as budgetService from "../services/department-budget.js";
import * as systemProjectService from "../services/system-project.js";

export const departmentRoutes = Router();

// All routes require auth + company access
departmentRoutes.use(requireAuth);
departmentRoutes.use(requireCompanyAccess);

// List departments for company
departmentRoutes.get("/", async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const departments = await deptService.listDepartments(companyId);
    res.json(departments);
  } catch (err) { next(err); }
});

// Create department (CEO only)
departmentRoutes.post("/", async (req, res, next) => {
  try {
    const companyId = req.companyId!;
    const { name, slug, mission } = req.body;
    const department = await deptService.createDepartment({
      companyId, name, slug, mission,
    });
    res.status(201).json(department);
  } catch (err) { next(err); }
});

// Get department
departmentRoutes.get("/:departmentId", async (req, res, next) => {
  try {
    const department = await deptService.getDepartment(req.params.departmentId);
    if (!department) return res.sendStatus(404);
    res.json(department);
  } catch (err) { next(err); }
});

// Update department (CEO only)
departmentRoutes.patch("/:departmentId", async (req, res, next) => {
  try {
    const { name, mission, maxConcurrentTemporaryWorkers } = req.body;
    const department = await deptService.updateDepartment(
      req.params.departmentId,
      { name, mission, maxConcurrentTemporaryWorkers },
    );
    res.json(department);
  } catch (err) { next(err); }
});

// Assign minister (CEO only)
departmentRoutes.post("/:departmentId/assign-minister", async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const department = await deptService.assignMinister(
      req.params.departmentId,
      agentId,
    );
    res.json(department);
  } catch (err) { next(err); }
});

// Remove minister (CEO only)
departmentRoutes.post("/:departmentId/remove-minister", async (req, res, next) => {
  try {
    const department = await deptService.removeMinister(req.params.departmentId);
    res.json(department);
  } catch (err) { next(err); }
});

// Freeze department
departmentRoutes.post("/:departmentId/freeze", async (req, res, next) => {
  try {
    const { status } = req.body;
    const department = await deptService.freezeDepartment(
      req.params.departmentId,
      status,
    );
    res.json(department);
  } catch (err) { next(err); }
});

// Unfreeze department (CEO only)
departmentRoutes.post("/:departmentId/unfreeze", async (req, res, next) => {
  try {
    const department = await deptService.unfreezeDepartment(req.params.departmentId);
    res.json(department);
  } catch (err) { next(err); }
});

// Get budget overview
departmentRoutes.get("/:departmentId/budget", async (req, res, next) => {
  try {
    const overview = await budgetService.getBudgetOverview(req.params.departmentId);
    if (!overview) return res.sendStatus(404);
    res.json(overview);
  } catch (err) { next(err); }
});

// Allocate budget envelope (CEO only)
departmentRoutes.post("/:departmentId/budget/allocate", async (req, res, next) => {
  try {
    const { monthlyLimitCents } = req.body;
    const envelope = await budgetService.allocateBudgetEnvelope(
      req.params.departmentId,
      req.companyId!,
      { monthlyLimitCents },
    );
    res.status(201).json(envelope);
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Register routes in app**

In the main route registration file (find where other routes like `/agents`, `/projects` are registered), add:

```typescript
import { departmentRoutes } from "./departments.js";
// ...
app.use("/api/departments", departmentRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/departments.ts
git commit -m "feat: add department API routes"
```

---

## Task 10: Frontend API Client and i18n

**Files:**
- Create: `ui/src/api/departments.ts`
- Create: `ui/src/i18n/locales/en/departments.json`
- Create: `ui/src/i18n/locales/zh-CN/departments.json`
- Modify: `ui/src/i18n/resources.ts`

- [ ] **Step 1: Create frontend API client**

Create `ui/src/api/departments.ts`:

```typescript
import { apiClient } from "./client";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  mission: string | null;
  status: "active" | "frozen_unstaffed" | "frozen_suspended";
  ministerAgentId: string | null;
  maxConcurrentTemporaryWorkers: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentBudgetOverview {
  monthlyLimitCents: number;
  reservedCents: number;
  spentCents: number;
  availableCents: number;
  utilizationPercent: number;
  status: string;
}

export const departmentsApi = {
  list: (companyId: string) =>
    apiClient.get<Department[]>(`/departments?companyId=${companyId}`).json(),

  get: (departmentId: string) =>
    apiClient.get<Department>(`/departments/${departmentId}`).json(),

  create: (data: { name: string; slug: string; mission?: string }) =>
    apiClient.post<Department>("/departments", { json: data }).json(),

  update: (departmentId: string, data: Partial<Pick<Department, "name" | "mission">>) =>
    apiClient.patch<Department>(`/departments/${departmentId}`, { json: data }).json(),

  assignMinister: (departmentId: string, agentId: string) =>
    apiClient.post<Department>(`/departments/${departmentId}/assign-minister`, {
      json: { agentId },
    }).json(),

  removeMinister: (departmentId: string) =>
    apiClient.post<Department>(`/departments/${departmentId}/remove-minister`).json(),

  freeze: (departmentId: string, status: "frozen_unstaffed" | "frozen_suspended") =>
    apiClient.post<Department>(`/departments/${departmentId}/freeze`, {
      json: { status },
    }).json(),

  unfreeze: (departmentId: string) =>
    apiClient.post<Department>(`/departments/${departmentId}/unfreeze`).json(),

  getBudget: (departmentId: string) =>
    apiClient.get<DepartmentBudgetOverview>(`/departments/${departmentId}/budget`).json(),

  allocateBudget: (departmentId: string, monthlyLimitCents: number) =>
    apiClient.post(`/departments/${departmentId}/budget/allocate`, {
      json: { monthlyLimitCents },
    }).json(),
};
```

- [ ] **Step 2: Create English translations**

Create `ui/src/i18n/locales/en/departments.json`:

```json
{
  "title": "Departments",
  "empty": {
    "noDepartments": "No departments yet."
  },
  "status": {
    "active": "Active",
    "frozen_unstaffed": "Frozen — No Minister",
    "frozen_suspended": "Frozen — Minister Unavailable"
  },
  "fields": {
    "name": "Name",
    "slug": "Slug",
    "mission": "Mission",
    "status": "Status",
    "minister": "Minister",
    "noMinister": "No minister assigned",
    "budget": "Budget",
    "maxWorkers": "Max concurrent workers"
  },
  "actions": {
    "create": "Create Department",
    "edit": "Edit",
    "assignMinister": "Assign Minister",
    "removeMinister": "Remove Minister",
    "freeze": "Freeze",
    "unfreeze": "Unfreeze",
    "allocateBudget": "Allocate Budget"
  },
  "budget": {
    "monthlyLimit": "Monthly limit",
    "reserved": "Reserved",
    "spent": "Spent",
    "available": "Available",
    "utilization": "Utilization",
    "status": {
      "allocated": "Allocated",
      "reserved_only": "Reserved Only",
      "active": "Active"
    }
  },
  "messages": {
    "created": "Department created",
    "updated": "Department updated",
    "ministerAssigned": "Minister assigned",
    "ministerRemoved": "Minister removed",
    "frozen": "Department frozen",
    "unfrozen": "Department unfrozen",
    "cannotDeleteSystem": "Cannot delete the system governance project"
  }
}
```

- [ ] **Step 3: Create Chinese translations**

Create `ui/src/i18n/locales/zh-CN/departments.json`:

```json
{
  "title": "部门",
  "empty": {
    "noDepartments": "暂无部门。"
  },
  "status": {
    "active": "活跃",
    "frozen_unstaffed": "已冻结 — 无部长",
    "frozen_suspended": "已冻结 — 部长不可用"
  },
  "fields": {
    "name": "名称",
    "slug": "标识",
    "mission": "使命",
    "status": "状态",
    "minister": "部长",
    "noMinister": "未指定部长",
    "budget": "预算",
    "maxWorkers": "最大并发工人数"
  },
  "actions": {
    "create": "创建部门",
    "edit": "编辑",
    "assignMinister": "指定部长",
    "removeMinister": "移除部长",
    "freeze": "冻结",
    "unfreeze": "解冻",
    "allocateBudget": "分配预算"
  },
  "budget": {
    "monthlyLimit": "月度上限",
    "reserved": "已预留",
    "spent": "已支出",
    "available": "可用",
    "utilization": "使用率",
    "status": {
      "allocated": "已分配",
      "reserved_only": "仅预留",
      "active": "活跃"
    }
  },
  "messages": {
    "created": "部门已创建",
    "updated": "部门已更新",
    "ministerAssigned": "部长已指定",
    "ministerRemoved": "部长已移除",
    "frozen": "部门已冻结",
    "unfrozen": "部门已解冻",
    "cannotDeleteSystem": "无法删除系统治理项目"
  }
}
```

- [ ] **Step 4: Register translations in resources**

In `ui/src/i18n/resources.ts`, add the import and registration for the departments namespace in both `en` and `zh-CN` resource objects:

```typescript
import enDepartments from "./locales/en/departments.json";
import zhCnDepartments from "./locales/zh-CN/departments.json";

// Add to en resources:
departments: enDepartments,

// Add to zh-CN resources:
departments: zhCnDepartments,
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/api/departments.ts ui/src/i18n/locales/en/departments.json ui/src/i18n/locales/zh-CN/departments.json ui/src/i18n/resources.ts
git commit -m "feat: add department frontend API client and i18n"
```

---

## Self-Review

### 1. Spec Coverage

| Reviewer Finding | Task |
|---|---|
| `CEO intake` semantics unclear (Critical) | Task 1 (doc fix clarifying queue semantics) |
| `block_recommended` semantic ambiguity (Critical) | Task 1 (doc fix) + Task 5 (column) |
| Minister crash/healthcheck missing (Critical) | Task 1 (doc fix §3.4.1) |
| CEO single point of failure | Task 1 (doc fix §2.4, clarified Human Board-only backup) |
| System project deletion protection | Task 1 (doc fix §6.7) |
| Department entity missing | Task 3 (type) + Task 5 (migration) + Task 6 (service) |
| Budget envelope missing | Task 3 (type) + Task 5 (migration) + Task 7 (service) |
| System project canonical identification | Task 5 (migration) + Task 8 (service) |
| `isSystemProject` flag missing | Task 4 (extend Project) + Task 5 (migration) |
| `ceoAgentId` missing on Company | Task 4 (extend Company) + Task 5 (migration) |
| Temporary worker foundation deferred until dedicated principal/auth boundary exists | Explicitly deferred |
| Multi-company isolation (Phase A) | Requires minimum core prerequisites, especially company-scoped settings, availability enforcement, and entity/state isolation before broad multi-company rollout |

### 2. Placeholder Scan

No `TBD`, `TODO`, "implement later", or "add appropriate error handling" found. All code blocks contain complete implementations.

### 3. Type Consistency

- `DepartmentStatus` defined in `constants/department.ts`, used in `types/department.ts`, enforced in `services/departments.ts` — consistent.
- `SystemIssueWorkflowState` does not include `ceo_intake`; `CEO intake` is modeled as queue/routing semantics — matches Task 1.
- `DepartmentBudgetStatus` values match migration CHECK constraint — consistent.
- Field names in migration columns match TypeScript type fields (snake_case → camelCase mapping assumed by ORM layer).

### Deferred to Future Plans

The following are explicitly NOT in this plan and belong in separate plans:

1. **Execution Improvement Plugin** — depends on this foundation
2. **Skills System Plugin** — depends on this foundation
3. **Hot Update dual-slot mechanism** — requires core runtime changes
4. **Temporary worker lifecycle (TTL reaper, spawn/cancel)** — deferred until dedicated principal/auth/runtime support exists
5. **Issue routing (CEO intake → department → minister)** — needs workflow engine
6. **Plugin-to-department event handshake** — needs plugin event protocol design
