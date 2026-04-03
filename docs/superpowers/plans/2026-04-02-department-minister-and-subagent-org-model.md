# Department-Minister and Subagent Organization Model

Status: Proposed
Date: 2026-04-02
Owner: Product + Server + UI + Runtime
Related:
- `doc/plans/2026-04-02-skills-system-plugin.md`
- `doc/plans/2026-04-02-execution-improvement-plugin.md`
- `doc/plans/2026-04-02-system-self-evolution-and-hot-update.md`

## 1. Goal

Define a stricter organization model for Paperclip that separates:

- formal company structure
- department ownership
- department budget responsibility
- issue intake and routing
- temporary execution workers
- shared capability supply
- shared system-governance work

The immediate goal is to support a company structure where:

- the CEO manages departments
- each department has exactly one formal long-lived leader
- that leader can spawn temporary workers to execute department work
- temporary workers only report to their department leader
- cross-department collaboration happens leader-to-leader, not worker-to-worker

## 2. Core Organization Rules

### 2.1 Formal chain of command

The formal long-lived organization has three concepts:

- `CEO`
- `Department`
- `Department Minister`

The formal chain of command is fixed as:

- `Human Board -> CEO -> Ministers`

Hard rules:

- the CEO has no agent superior
- ministers must report directly to the CEO
- ministers must not report to other ministers
- ministers must not report to non-CEO formal employees
- the CEO must not report to another agent

This keeps the formal org intentionally shallow.
Execution depth belongs in the temporary worker layer, not in the formal employee hierarchy.

The CEO is the default agent-level governance authority.
Human board operators retain top-level override authority for critical governance actions.

If the CEO is unavailable, governance does not fall through to another agent.
The only backup authority is the human board layer.

### 2.2 Minister role

A minister is still a formal employee or agent, not a separate employment class.

A minister:

- appears in the org chart
- reports directly to the CEO
- owns department execution and budget use
- is the only formal long-lived seat for that department in this model

### 2.3 Temporary worker role

Temporary workers:

- are not formal employees
- do not occupy org-chart seats
- do not independently report to the CEO
- do not directly own department budgets

They exist only to execute department work under minister control.

Temporary workers must not ship as ordinary long-lived company-visible `agent` principals if doing so would inherit the current same-company visibility and auth contract.

Preferred V1 rule:

- a temporary worker is a minister-owned execution identity or subagent runtime, not a general company agent
- it may reuse agent-adjacent runtime machinery internally only if that reuse is hidden behind a stricter temporary-worker principal boundary
- it must not receive the default visibility, API key scope, or org-discovery behavior of ordinary company agents

Required V1 boundary:

- temporary workers are visible by default only to:
  - their owning minister
  - the CEO
  - human board operators
  - directly related issue or child-issue contexts that the minister explicitly exposes
- temporary workers are not broadly discoverable in:
  - company-wide people pickers
  - formal org-chart views
  - shared system-project governance views
  - unrelated department or agent surfaces
- temporary workers do not receive general-purpose company agent API keys
- temporary workers do not inherit the default same-company full-visibility contract of ordinary agents

If the current host runtime cannot enforce a dedicated temporary-worker principal with those guarantees, V1 must keep temporary workers as minister-owned runtime subagents rather than exposing them as first-class agents.

## 3. Department Model

Each department is a governance unit, not just a label.

### 3.1 Department responsibilities

A department owns:

- a mission or function
- one minister seat
- a budget envelope
- an issue-based work view
- a temporary worker pool

A department is the primary responsibility, budget, and execution boundary below company level.

### 3.2 Recommended entity shape

Suggested department fields:

- `id`
- `companyId`
- `name`
- `slug`
- `mission`
- `status`
- `ministerAgentId`

Invariants:

- every department belongs to exactly one company
- every department has at most one active minister
- the minister must belong to the same company
- in the first version, a minister may own at most one department

### 3.3 Department work surface

The department task entry should initially be modeled as an `issue`-based filtered view, not as a new first-class queue object.

The preferred first implementation is:

- department ownership is an explicit routing fact, not an inference from participation alone
- the department view shows the minister plus that minister's temporary workers
- the department view includes all issues currently owned or being executed by that department

This should include:

- issues assigned to the minister
- issues assigned to temporary workers owned by that minister
- issues where the minister or those temporary workers are participants

Recommended V1 rule:

- each issue has at most one active owning department at a time
- participant and assignee filters are read-model aids, not the source of truth for ownership
- the source of truth should be an explicit `owningDepartmentId` or equivalent department-routing record
- if a human board override changes `owningDepartmentId` or otherwise re-routes an already-routed issue:
  - the previous department's formal ownership ends immediately
  - previous department budget reservations must be released or explicitly transferred through reconciliation
  - previous department temporary workers must move to a paused reconciliation state unless explicitly reassigned
  - previous department temporary-worker credentials, active sessions, and in-flight execution authority must be revoked or cancelled as part of reconciliation
  - previous department child issues, pending reviews, and `ready_to_resume` states must be marked superseded, cancelled, or explicitly rebound so that the old responsibility line cannot continue in parallel
  - the new department still requires minister `accept / reject / needs_clarification` before normal execution resumes unless the issue is deliberately held in `CEO intake` or a human-operated emergency path

The product should not introduce a second independent queue model before the issue-centered workflow is proven stable.

### 3.4 Empty and frozen departments

Departments may exist before a minister is appointed.

This is the preferred model because it lets the CEO establish:

- long-lived responsibility boundaries
- organization shape
- budget envelopes
- staffing plans

before a minister is hired.

Rules:

- a department without a minister is allowed to exist
- a department without a minister is automatically `frozen_unstaffed`
- a frozen unstaffed department must not formally accept new issues
- a frozen unstaffed department must not spawn temporary workers
- a frozen unstaffed department must not consume execution budget

Minister availability should be treated as an explicit governance signal, not a vague operational guess.

Recommended first-version availability signals:

- explicit human or CEO suspension or removal
- explicit vacancy of the minister seat
- bounded heartbeat or activity timeout that marks the minister as unavailable pending CEO confirmation

The system should treat heartbeat-derived unavailability as a freeze trigger, not as permission to auto-reassign authority.

If a minister leaves, is removed, or becomes unavailable:

- the department automatically becomes frozen
- the CEO must not appoint a temporary acting minister
- unfinished issues should return to `CEO intake`
- those issues should carry `suggestedDepartmentId = originalDepartmentId`
- those issues should be marked as requiring reassignment or renewed department acceptance
- department-owned temporary workers should be paused, not terminated immediately
- paused temporary workers should move to `paused_pending_ceo_resume`
- paused temporary-worker credentials, active sessions, and in-flight execution authority must be revoked or cancelled as part of the freeze transition

When a new minister is appointed:

- paused temporary workers in that department may become eligible for recovery
- issues that were returned to `CEO intake` due to department freeze must remain in `CEO intake` until the CEO explicitly re-routes them
- the original department may be suggested as the default routing target, but routing is not restored automatically
- the new minister must still explicitly `accept`, `reject`, or `needs_clarification` those returned issues after CEO re-routing
- paused temporary workers must not resume execution until the CEO explicitly authorizes resume through the relevant governance path

This preserves department continuity without creating a side door around `CEO intake` or CEO-primary resume authority.

## 4. Budget Model

The budget model should be:

- company total budget
- department budget envelopes
- execution-time reservation
- post-run settlement

This is a target governance model, not a claim that the current core budget schema already has every required object.

In practice, department budget envelopes, reservation ledger behavior, and department-level blocking will require new first-class core support beyond today's company/agent/project-only budget scope.

### 4.1 Company budget

The company has a hard monthly budget ceiling.
This remains the top-level spending limit and cannot be exceeded by department allocations.

### 4.2 Department budget envelope

Each department receives a budget envelope from the company budget.

Suggested fields:

- `monthlyLimit`
- `reserved`
- `spent`

The department envelope is a child allocation of the company budget, not an independent pool.

Departments may receive a budget envelope before a minister is appointed.

In that case the budget should exist as a reserved envelope, not as spendable execution authority.

Suggested state distinction:

- `allocated`
- `reserved_only`
- `active`

Rules:

- a department without a minister may hold an allocated budget envelope
- that envelope is `reserved_only` while the department is frozen and unstaffed
- `reserved_only` budget may not fund execution, temporary-worker spawning, or runtime spend
- when a minister is appointed, the reserved envelope should automatically become `active`

### 4.3 Reservation and settlement

The preferred execution model is:

1. reserve estimated cost before execution
2. run work
3. settle actual cost after execution
4. release unused reserved amount

This is preferred over pure prepaid accounting or pure post-hoc deduction because it balances control and flexibility.

Automatic budget activation after minister appointment does not bypass execution controls.

Even after activation, department spend must still follow:

- company hard ceiling checks
- department envelope checks
- execution-time reservation
- post-run settlement

### 4.4 Temporary worker budget ownership

Temporary workers do not hold their own budget accounts.

Instead:

- spend is reserved against the department envelope
- actual spend is settled against the department envelope
- the minister remains the accountable budget owner

### 4.5 Cross-department budget default

By default, the requesting department pays unless explicit transfer rules are introduced later.

## 5. Issue Intake And Routing

This organization model depends on a strict issue intake flow.

### 5.1 Human-created issues

Human-created issues may begin without a department.

Default rule:

- they enter `CEO intake`
- they stay in `CEO intake` until the CEO explicitly routes them
- they do not auto-route to a department

### 5.2 CEO-created issues

When the CEO creates an issue, the issue should already be routed to a target department.

That means:

- CEO-created issues should not begin in an unowned state
- they should carry department intent from creation time

### 5.3 Department first, assignee second

All issues must enter a department before they are delegated to execution workers.

This means:

- the CEO may route an issue to a department
- the CEO may not directly assign the issue to a temporary worker
- humans may not directly assign work to temporary workers
- the department minister decides how execution is staffed after department intake

The intended responsibility chain is:

- `Human -> CEO intake -> Department -> Minister -> Temporary Worker`

### 5.4 Minister acceptance

Routing an issue to a department does not mean the department has accepted it.

A minister must explicitly review and respond.

Allowed intake outcomes:

- `accept`
- `reject`
- `needs_clarification`

The minister evaluates:

- whether the issue truly belongs to the department
- whether the department currently has the capability to complete it

Only after `accept` may the issue proceed into department execution and temporary-worker assignment.

### 5.5 Meaning of rejection

If a minister rejects an issue:

- the issue returns to CEO-level triage
- the department is not considered responsible
- the CEO must decide whether to reroute, clarify, or handle the matter differently

### 5.6 Meaning of needs_clarification

If a minister responds with `needs_clarification`:

- the issue remains unresolved at intake
- the CEO must provide more information, narrow the ask, or reconsider the routing decision

## 6. Shared System Project

The company should also have a shared system-governance project.

This project is intended for:

- execution incidents
- optimization requests
- skill gaps
- governance issues

It should not be treated as a private CEO project.
It is a company-level system-governed project container with CEO-led planning authority and human-board override.

### 6.1 Creation model

The preferred model is:

- create it automatically during company initialization
- keep it as a normal project in the data model
- mark it with system-reserved semantics

Recommended flags:

- `isSystemProject = true`
- `systemProjectKind = execution_governance`

This is preferred over a hard-coded built-in project type because it preserves:

- normal project portability
- normal issue, activity, and routing behavior
- simpler UI and export/import behavior

while still letting the product apply system-specific rules.

This document is the canonical source for:

- system project semantics
- system issue `type`
- system issue workflow state
- system issue `severity`

Related design documents should reference these definitions rather than redefining them independently.

Migration path:

- new companies should receive the system project during initialization
- existing companies should receive it through a migration or backfill path
- if a company already has likely candidate governance projects, migration should either:
  - mark one canonical system project explicitly
  - or require a human-guided reconciliation step

### 6.2 Ownership model

This system project belongs to the company, not to the CEO as a private workspace.
The CEO remains the planning authority for its top-level system issues.

### 6.3 System issue categories

System issues in this project should be categorized by `type`, not by board column.

Recommended first categories:

- `execution`
- `skill`
- `governance`

These are problem classes, not workflow states.

### 6.4 System issue workflow states

Recommended top-level workflow states:

- `open`
- `triaging`
- `in_progress`
- `pending_review`
- `review_passed`
- `ready_to_resume`
- `done`

Where:

- `pending_review` means a responsible department claims the fix or improvement is ready for review
- `review_passed` means review has succeeded and the issue is waiting for CEO confirmation
- `ready_to_resume` means a previously blocked path is technically ready to resume but still requires CEO approval
- `done` means final closure by CEO

This is the target canonical workflow model.

In a plugin-only MVP, some of these semantics may initially be represented as conventions layered on existing issue objects until core-backed system-issue workflow support lands.

`CEO intake` is not a separate canonical workflow state.
It is a routing and governance queue that sits orthogonally to workflow state.

That means, for example:

- a system issue may be `open` while still in `CEO intake`
- a system issue may move from `CEO intake` to department-owned execution without changing its top-level workflow state yet
- workflow state answers "what stage is this work in"
- `CEO intake` answers "who currently owns the next routing or governance decision"

### 6.5 Assignee model

System issues should default to:

- the shared system project
- `CEO intake`
- no direct assignee until the CEO performs initial triage

This keeps responsibility centralized with CEO intake while keeping execution assignment explicit.

If a human board override changes routing or ownership after review has already begun:

- old child issues become non-authoritative unless explicitly rebound
- old review requests and review-passed states become non-authoritative unless explicitly rebound
- old resume-ready states do not survive the override by default
- the new department becomes the only valid path for fresh acceptance and execution

### 6.6 Default sorting

System issues should default to:

1. `severity`
2. `frequency`

Recommended severity levels:

- `critical`
- `high`
- `medium`
- `low`

This means:

- higher-risk work rises first
- repeated lower-severity issues can still bubble up through frequency

## 7. System Issue Review And Closure

System issues should follow a stricter closure path than ordinary execution work.

### 7.1 Closure authority

The final `done` state for system issues should normally be set by the CEO.

Human board operators retain emergency override authority.

Plugins must not directly close system issues.
Ministers must not directly close system issues.
Reviewers must not directly close system issues.

### 7.2 Review flow

Recommended flow:

1. A plugin or CEO creates a system issue in the shared system project.
2. The issue enters `CEO intake`.
3. The CEO performs triage and assigns follow-up work.
4. A responsible department or system owner performs the fix or optimization work.
5. The responsible side marks the issue `pending_review`.
6. A reviewer checks evidence and outcome.
7. If review succeeds, the issue becomes `review_passed`.
8. If the issue had blocked execution, it moves to `ready_to_resume`.
9. The CEO confirms final closure or resume decision unless a human board override is used.

### 7.3 Review responsibility

Review should initially be modeled as a review function, not a fully separate formal review department.

The preferred first design is:

- `execution` system issues are reviewed by an execution review minister
- `skill` system issues are reviewed by a skill review minister
- `governance` system issues are reviewed by a governance review minister

The recommended staffing model is:

- V1: review is a dual-hatted responsibility, but it must remain independent from the responsible execution line
- V2: dedicated review ministers are introduced only if review volume and complexity justify a separate formal function

Hard independence rules:

- the minister or department responsible for the fix must not review the same parent system issue
- two ministers from the same responsible department must not satisfy both the implementation and review roles for the same parent system issue
- if no eligible cross-line reviewer exists, review must escalate to a human operator

This means V1 may still use ministers as reviewers, but not the same ministerial responsibility line that performed the fix.

Signals that may justify a later upgrade:

- review becomes a sustained bottleneck
- system issue volume remains consistently high
- review work becomes standardized enough to be its own operating function
- CEO needs stronger company-wide quality gating than dual-hatted reviewers can provide

### 7.4 Visibility

The full system issue should remain primarily visible to:

- humans
- CEO

Other departments should primarily see:

- the follow-up work assigned to them
- the evidence they must produce
- the review outcome relevant to their assigned work

Temporary workers should not need direct access to the full governance issue by default.

## 8. Temporary Worker Model

### 8.1 Default runtime shape

Temporary workers should start as short-lived `subagents`, not long-lived teammate-style peers.

This is the preferred first implementation because it is:

- cheaper
- easier to audit
- easier to recover
- better aligned with Paperclip's issue-centered workflow

Temporary workers should be subordinate only to their owning minister.
They may collaborate with other temporary workers in the same department, but must not bypass the minister boundary for cross-department work.

In V1, "subagent" here means a minister-scoped execution identity, not an ordinary company-agent session with the default same-company visibility contract.

### 8.2 Required ownership fields

Suggested temporary worker metadata:

- `ownerMinisterAgentId`
- `sourceIssueId`
- `sourceProjectId` nullable
- `ttl`
- `scope`
- `status`

Invariants:

- every temporary worker has exactly one owning minister
- every temporary worker is scoped to a company through that minister
- every temporary worker is tied to a concrete execution purpose

### 8.3 Temporary worker permissions

Temporary workers should not be allowed to:

- hire formal employees
- create other temporary workers by default
- cross department boundaries directly
- mutate department budget policies
- act as independent cross-company or cross-department authorities
- browse or operate on the full shared system-project governance surface by default
- inspect unrelated company agent rosters or unrelated department execution state by default
- continue authenticated execution after department freeze, reroute, or supersession without fresh minister and CEO authorization

Their work is delegated execution, not governance.

Any temporary-worker-triggered request for shared capability support should remain advisory until ratified by the owning minister.

### 8.4 Lifecycle

Temporary workers should be:

- spawned for a bounded purpose
- cancellable by the minister
- reclaimable after TTL expiry
- excluded from the formal org chart

Recommended first-version TTL policy:

- each temporary worker should inherit a default TTL from department policy unless a shorter task-specific TTL is supplied
- idle workers that reach TTL expiry may be terminated automatically
- workers that reach TTL expiry while blocked or mid-execution should move to `ttl_expired_pending_minister`
- TTL expiry should not silently continue execution
- TTL extension should require minister action and must still respect department budget controls

If the owning minister is unavailable when a worker enters `ttl_expired_pending_minister`:

- the worker should move to `ttl_expired_pending_ceo_or_board`
- no automatic TTL extension is allowed
- no automatic execution resume is allowed
- the worker remains suspended until one of these happens:
  - the minister returns and explicitly handles the worker
  - the CEO routes or terminates the worker through the normal governance path
  - the human board overrides because the CEO is unavailable

This prevents deadlock between TTL expiry and minister outage while preserving the rule that temporary workers do not self-govern.

### 8.5 Temporary worker concurrency policy

By default, a minister may decide how many temporary workers to keep active within the department's active budget envelope.

This authority is still constrained by:

- company hard budget ceilings
- department reservation and settlement rules
- department freeze state
- critical blocking rules that suspend further scaling

The recommended department-level setting is:

- `maxConcurrentTemporaryWorkers`

Rules:

- this setting controls active concurrent temporary workers, not lifetime cumulative count
- if unset, there is no explicit worker-count hard cap and the minister decides within budget
- if set, the minister must not exceed the configured active concurrency cap
- departments in a frozen state must not spawn new temporary workers
- a critically blocked department should not scale out new temporary workers until the blocking condition is cleared
- this limit should be configurable by the CEO or human operators, not by the minister

### 8.6 Collaboration rule

Allowed:

- minister to temporary worker
- temporary worker to minister
- temporary worker to temporary worker within the same minister-owned department boundary

Disallowed:

- temporary worker to another department's temporary worker as a cross-department control path
- CEO direct assignment to temporary workers
- human direct assignment to temporary workers

Cross-department work must be requested minister-to-minister.

### 8.7 Cross-department execution in V1

The first version should not treat one issue as simultaneously owned by multiple departments.

Recommended V1 pattern:

- keep one parent issue at the CEO or primary-governance level
- create department-specific child issues for each participating department
- each child issue follows the normal `CEO intake -> department routing -> minister accept/reject/needs_clarification` flow

This keeps department responsibility explicit and avoids ambiguous multi-department ownership on one issue.

## 9. Capability And Skill Supply Boundary

Department responsibility and capability supply must remain separate.

### 9.1 Skills are not departments

Do not create a new department simply because a department lacks a specialized capability.

Use this rule:

- create a department only for long-lived responsibility
- acquire or improve a skill when responsibility is clear but capability is missing

### 9.2 Skill supply path

If a minister determines that an issue belongs to the department but the department lacks capability:

- the minister should request skill support
- the skill system should recommend an existing skill, candidate skill, or new skill work
- the minister remains the responsible owner of execution
- the minister chooses which temporary worker uses the skill

This keeps:

- responsibility with the department
- capability supply with the shared skill system
- final execution ownership with the minister

### 9.3 Skill system ownership

The skill system should be modeled as a company-level shared subsystem, not as a business department.

It should not sit inside any one department's formal hierarchy.

Its role is:

- collect skill usage data
- analyze failures and gaps
- recommend reusable skills
- refine candidate skills
- support promotion workflows for skills

## 10. System Plugins

The current preferred delivery model is:

- `Execution Improvement Plugin` is a system-level first-party plugin installed by default at the instance level
- `Skills System Plugin` is a system-level first-party plugin installed by default at the instance level
- both plugins are default-enabled and should not be operator-disableable in normal operation

They are not per-company optional installs.
They are shared system capabilities whose data and outputs remain company-scoped inside each company context.

They should still appear in the plugin management surface as visible system plugins.

Recommended management rules:

- visible for health, logs, version, and configuration
- marked as required system plugins
- not removable in normal operation
- not disableable in normal operation
- allowed to expose limited runtime tuning configuration only when that configuration is company-scoped and host-enforced

These plugins may be configurable, but they must not allow operators to bypass:

- CEO intake
- shared system project behavior
- CEO final closure of top-level system issues
- the plugins' default system responsibilities

On the current host model, this means:

- company boards may see status and company-scoped outputs
- instance-level plugin bootstrap, shared thresholds, and code-rollout controls belong to human operators, not ordinary company boards
- board-writable configuration is not acceptable for instance-global settings in authenticated multi-company deployments

## 11. Future Workcell Model

This design intentionally leaves room for a future `workcell` layer.

A `workcell` is not a formal department and not a long-lived formal team.
It is a temporary intra-department collaboration unit created by a minister for a bounded piece of work.

Potential `workcell` capabilities:

- shared short-term memory
- shared subtask board
- intra-cell worker messaging
- shared execution context within a department boundary

Constraints:

- the workcell still belongs to one minister
- the workcell does not appear as a formal org node
- the workcell cannot directly create cross-department communication paths

## 12. Suggested Permission Boundaries

### 12.1 CEO

CEO authority should include:

- create and remove departments
- appoint and replace ministers
- allocate and adjust department budgets
- approve formal long-lived hires
- approve or deny expanded department authority
- route work from CEO intake into departments
- perform final closure of system issues
- approve resume for blocked critical flows

Human board operators retain override authority over these governance actions.

### 12.2 Minister

Minister authority should include:

- manage department execution
- accept, reject, or request clarification on department task intake
- spawn temporary workers
- stop or reclaim temporary workers
- reserve and consume department budget within department limits
- request cross-department collaboration from other ministers
- submit system issue work for review, but not close the parent issue
- continue blocked work only after explicit CEO resume instruction

### 12.3 Temporary worker

Temporary worker authority should include only the minimum execution powers needed for its delegated task.

It should not include open-ended organizational control.

## 13. UI And Product Implications

If this model is implemented, the UI should eventually show:

- departments as first-class company objects
- exactly one minister per department
- department budget envelope status
- department issue view
- temporary workers under a department execution panel, not in the main org tree
- CEO intake as a distinct triage surface
- department intake status before execution begins
- a shared system project with typed system issues
- explicit review state before system issue closure

The default board-level mental model becomes:

- company budget
- CEO intake
- department ministers
- department execution
- shared system governance project
- temporary worker activity

## 14. Open Questions For Next Revision

This draft intentionally leaves these as follow-up decisions:

1. Should temporary workers always be spawned from issues, or may they also be spawned directly from goals or projects?
2. What exact state model should represent `CEO intake`, department routing, and minister acceptance in the database and UI?
3. Should heartbeat-derived minister unavailability require one timeout policy for all departments, or department-specific policy bands?
4. How should temporary-worker TTL policy interact with long-running workcells if workcells are introduced later?

## 15. Recommended Near-Term Direction

For the next implementation pass, the recommended order is:

1. introduce a first-class `departments` model
2. enforce one-minister-per-department
3. introduce department budget envelopes under the company budget
4. implement `CEO intake -> department routing -> minister accept/reject/needs_clarification`
5. introduce the shared system project and top-level system issue flow
6. add a dedicated temporary-worker principal boundary or keep them as runtime-only subagents until that boundary exists
7. introduce minister-owned temporary subagents only after the visibility/auth boundary is enforceable
8. keep temporary workers out of the formal org chart and broad company agent discovery surfaces
9. connect department execution to the shared skills system only after intake and department ownership are stable
10. defer full `workcell` collaboration until the basic governance path is stable

Minimum core prerequisites for a real Phase A are:

- a first-class `departments` model with one-minister-per-department enforcement
- a canonical system-project marker or equivalent core-owned way to identify the shared company system project
- explicit issue routing fields such as `owningDepartmentId` or equivalent
- core-backed handling for `CEO intake` as a routing/governance queue, even if the full workflow state model remains lightweight at first

Without those minimum core pieces, a plugin-only Phase A remains documentation and convention, not a trustworthy product behavior.

This keeps the system aligned with Paperclip's core identity:

- company-scoped
- governable
- auditable
- budget-aware
- organization-first
