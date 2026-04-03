# 2026-04-02 Skills System Plugin Plan

Status: Proposed
Date: 2026-04-02
Audience: Product and engineering
Related:
- `doc/plans/2026-03-14-skills-ui-product-plan.md`
- `doc/plans/2026-04-02-department-minister-and-subagent-org-model.md`
- `doc/plans/2026-04-02-execution-improvement-plugin.md`
- `doc/plans/2026-04-02-system-self-evolution-and-hot-update.md`
- `doc/plugins/PLUGIN_SPEC.md`
- `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
- `server/src/routes/plugins.ts`
- `server/src/services/plugin-host-services.ts`
- `server/src/services/plugin-event-bus.ts`

## 1. Purpose

This document defines how a company-level `Skills System` should land in Paperclip as a plugin-first subsystem.

The intended product is not only a skill library.
It should support:

- skill registration
- skill provenance and trust tracking
- skill usage telemetry
- skill recommendation
- skill experimentation and refinement
- promotion of candidate skills into production-ready company skills

It should also cooperate cleanly with the company-wide execution improvement workflow rather than trying to own all run diagnostics by itself.

This plan assumes the current organization model discussed in `2026-04-02-department-minister-and-subagent-org-model.md`:

- the formal chain is `Human Board -> CEO -> Ministers`
- ministers own department execution
- temporary workers are execution-only, not formal employees
- departments own responsibility and budget
- skill supply is a company-level shared capability layer, not a business department
- system-level improvement issues flow through the shared company system project under CEO planning authority

## 2. Decision Summary

The `Skills System` should be delivered as:

- a unified company-facing `Skill Registry`
- a plugin-owned `Skill Lab`
- a core-owned `Promotion Gate`
- a system-level first-party plugin that is installed by default at the instance level

In short:

- plugins can discover, evaluate, recommend, and propose skills
- Paperclip core remains the final authority for production enablement, governance, auditing, and budget-sensitive rollout
- the plugin is not optional infrastructure for ordinary companies; it is part of the default system capability set
- production-approved company skills should continue to have one authoritative core source of truth

This is the preferred split because the current plugin system is strong enough for data collection, experimentation, and UI workflow, but it is intentionally not the final owner of core governance invariants.

### 2.1 Installation model

The `Skills System Plugin` should be treated as a system-level first-party plugin.

That means:

- it should be bundled with the product
- it should be installed or enabled by default for the instance
- it should be enabled by default and not be operator-disableable in normal operation
- it should not require each company to install it separately
- it should operate as a shared company-facing subsystem inside each company context

It should still appear in the plugin management UI as a visible system plugin.

Recommended management behavior:

- visible in the plugin list
- marked as `system` and `required`
- not uninstallable in normal operation
- not disableable in normal operation
- allowed to expose a limited configuration surface

Allowed configuration should be limited to runtime tuning, such as:

- recommendation thresholds
- noise suppression thresholds
- experiment sensitivity
- time windows and rollup settings

Configuration must not allow operators to remove or bypass the plugin's core system responsibilities.

This matches the current plugin architecture, where plugins are instance-wide rather than company-local.

That architecture means the plugin must separate:

- instance-level bootstrap and safety defaults, writable only by human operators or instance administrators
- company-scoped telemetry, recommendations, candidate records, and tuning, isolated per company

An ordinary board in company A must not be able to change configuration that affects company B.

If host-enforced per-company configuration and storage isolation do not yet exist, authenticated multi-company deployments should treat writable settings for this plugin as human-operator-only rather than ordinary board-controlled.

Phase-A consequence:

- ordinary company boards must not receive writable system-plugin tuning surfaces in authenticated multi-company deployments
- per-company writable tuning is deferred until host-enforced company isolation exists

## 3. Why Plugin-First Is A Good Fit

The current plugin runtime already supports most of what a first useful `Skills System` needs.

Existing plugin capabilities include:

- plugin worker runtime
- plugin UI pages and settings pages
- plugin data/actions bridge
- plugin agent tools
- plugin event subscriptions
- scheduled jobs
- webhook ingestion
- plugin-scoped state and entity storage
- host service access to companies, projects, issues, goals, agents, comments, issue documents, sessions, metrics, and activity logging

From the current implementation, a plugin can already:

- observe issues, runs, agents, and goals
- keep its own registry records
- keep usage metrics and failure traces
- schedule analysis jobs
- render a company-level skill management UI
- expose tools to CEO, ministers, and temporary workers
- import candidate skills from local or remote sources

Relevant current implementation surfaces:

- [PLUGIN_SPEC.md](/D:/Source/workspace/paperclip/doc/plugins/PLUGIN_SPEC.md)
- [PLUGIN_AUTHORING_GUIDE.md](/D:/Source/workspace/paperclip/doc/plugins/PLUGIN_AUTHORING_GUIDE.md)
- [plugins.ts](/D:/Source/workspace/paperclip/server/src/routes/plugins.ts)
- [plugin-host-services.ts](/D:/Source/workspace/paperclip/server/src/services/plugin-host-services.ts)
- [plugin-event-bus.ts](/D:/Source/workspace/paperclip/server/src/services/plugin-event-bus.ts)

## 4. Boundaries

The `Skills System` must not blur three different concerns:

### 4.1 Skills are not departments

Departments are responsibility boundaries.
Skills are capability assets.

Do not create a new department just because a department lacks a specialized skill.

Use this rule:

- create a department only for long-lived responsibility
- request or improve a skill when responsibility is clear but capability is missing

### 4.2 Skills are not formal roles

System `role` remains small and stable.
Real-world job naming belongs in `title`.

The skills system should not become an alternate role system.

### 4.3 Plugins are not the final governance authority

Plugins may propose, recommend, and analyze.
Plugins must not become the final source of truth for:

- approval gates
- budget hard-stops
- issue checkout semantics
- core auth and actor permissions
- irreversible production rollout of company-managed skills

## 5. Target Architecture

The long-term architecture has three layers.

### 5.1 Skill Registry

This is the company-facing production library.

Responsibilities:

- register known skills
- track source and provenance
- track trust level
- track compatibility and packaging state
- show who uses a skill
- show which departments or agents prefer a skill
- expose production-approved skills to ministers and agents

For MVP, this registry should be presented as a unified view:

- production-approved skills read through from core company skill records
- plugin-owned candidate, telemetry, and recommendation overlays

The plugin should not create a second independent production truth for approved skills.

### 5.2 Skill Lab

This is the experimentation layer.

Responsibilities:

- collect usage telemetry
- identify failure patterns
- detect missing capabilities
- generate candidate improvements
- compare skill variants
- import external skills for evaluation
- produce recommendations and promotion requests

This is where the `autoresearch` inspiration fits best:

- bounded experiments
- measurable outcomes
- keep/discard loop
- iterative refinement

### 5.3 Promotion Gate

This is the governance boundary between experiment and production.

Responsibilities:

- approve or reject promotion requests
- move a candidate skill into company-approved production state
- roll back a promoted skill if needed
- keep audit history of decisions

The gate should stay in Paperclip core, not in the plugin.

### 5.4 Relationship to the Execution Improvement Plugin

The `Skills System` should not be the first observer of all execution failures.

Preferred split:

- the `Execution Improvement Plugin` diagnoses run-level and workflow-level problems
- the `Skills System Plugin` handles capability supply when the diagnosed problem is skill-related

That means the `Skills System` is a downstream capability service for many problems, not the universal intake point for all failures and optimization work.

## 6. Plugin MVP Scope

The first plugin MVP should deliver only what can be done safely on top of the current plugin runtime without changing core governance semantics.

Because this is a system-level plugin, the MVP should assume:

- the plugin is present by default in supported deployments
- the product may safely render system-facing entry points that depend on it
- missing-plugin fallback should still exist for resilience, but not as the primary operating assumption

### 6.1 MVP goals

- company-level skill registry UI
- read-through view of core-approved company skills
- plugin-owned candidate and telemetry records
- usage telemetry collection
- recommendation engine
- import pipeline for external skills
- candidate skill version tracking
- manual promotion request creation

### 6.2 MVP non-goals

- core-managed production skill enablement
- company-wide enforced skill rollout
- direct mutation of Paperclip’s existing company skill library as the source of truth
- automatic budget charging decisions for skill rollout
- direct override of agent prompt policy from the plugin alone

### 6.3 MVP plugin pages

The plugin should expose at least:

- a company page for the registry
- a settings page for plugin configuration
- optional detail tabs on agents and issues for skill recommendations and skill usage context

Suggested company page route:

- `/:companyPrefix/plugins/<skill-system-plugin-slug>`

Suggested UI sections:

- `Registry`
- `Recommendations`
- `Candidates`
- `Usage`
- `Lab Runs`
- `Promotion Requests`

These plugin pages are discovery and recommendation surfaces.
They must not become the sole approval surface for:

- production promotion
- rollback
- company-wide enablement
- final closure of top-level system issues

Those governance actions belong on core-rendered or otherwise core-validated surfaces.

## 7. Plugin Data Model

The MVP should keep its own records in plugin-owned storage first.

Important scope rule:

- plugin-owned records are for candidates, telemetry, experiments, recommendations, and promotion requests
- plugin-owned records are not the authoritative source of truth for production-approved company skills

Use:

- `plugin_entities` for structured records
- `plugin_state` for smaller scoped state and checkpoints

Suggested `entity_type` values:

- `skill_record`
- `skill_candidate`
- `skill_source`
- `skill_usage_rollup`
- `skill_promotion_request`
- `skill_import_job`
- `skill_experiment_run`

Suggested skill record fields:

- logical skill key
- display name
- source kind
- source location
- version or revision
- trust level
- compatibility state
- owning plugin metadata
- summary and tags
- related departments
- usage counts

Suggested candidate fields:

- parent skill key
- candidate revision
- experiment status
- evaluation result
- promotion readiness

## 8. Plugin Event And Job Model

The plugin should be mostly event-driven with scheduled consolidation jobs.

### 8.1 Event inputs

Useful existing host events include:

- issue lifecycle events
- agent run lifecycle events
- goal and project changes where relevant
- plugin-emitted telemetry events

The plugin should subscribe narrowly and remain idempotent.

The preferred inter-plugin handshake with the `Execution Improvement Plugin` is asynchronous and event-driven.

Recommended contract:

- `Execution Improvement Plugin` emits `skill_support_requested`
- `Skills System Plugin` consumes that event asynchronously
- `Skills System Plugin` emits or records `skill_support_analyzed`
- both events point back to the same parent system issue and company scope

The skills plugin should not require synchronous request-response coupling with the execution plugin.

### 8.2 Scheduled jobs

Suggested jobs:

- usage rollup job
- recommendation refresh job
- candidate cleanup job
- external source refresh job
- experiment evaluation job

Recommended operational guardrails:

- bounded retention for raw telemetry
- rollup jobs for long-lived usage and experiment summaries
- explicit idempotency keys for import jobs, recommendation refreshes, and issue-linked evidence
- degraded-mode behavior when event delivery or plugin storage falls behind

### 8.3 Agent tools

The plugin may expose tools such as:

- `skills.search`
- `skills.recommend`
- `skills.request`
- `skills.list-for-department`
- `skills.describe`

These tools should help CEO, ministers, and temporary workers find or request skills.

They should not directly self-promote a skill into production.

Temporary-worker use of these tools must remain advisory:

- a temporary worker may search, inspect, or draft a request
- a temporary worker must not unilaterally bind the department to a new skill decision
- any `skills.request` originating from a temporary worker requires owning-minister ratification before it becomes departmental action
- if temporary workers remain runtime-only subagents in V1, these tool interactions should execute through the owning minister's scoped context rather than through a general company-agent surface

## 9. How It Fits The Minister Model

Within the organization model already discussed, the intended flow is:

1. A human-created issue enters `CEO intake`, or the CEO creates an issue with a target department.
2. The CEO routes the issue to a department.
3. The minister reviews the issue and chooses `accept`, `reject`, or `needs_clarification`.
4. If the department is responsible but lacks capability, the minister requests skill support.
5. The `Skills System` plugin responds with one of:
   - an existing production-approved skill
   - an existing candidate skill
   - a recommendation to import or build a new skill
6. The minister decides which temporary worker should use the skill.
7. If the skill proves useful, the plugin may open or refresh a promotion request.

This keeps:

- responsibility with departments
- capability supply with the shared skill system
- final governance with core

### 9.1 Shared system project interaction

Skill-related system issues should live in the shared company system project rather than in a private CEO-only project.

Recommended pattern:

- a `skill`-typed system issue exists in the shared system project
- the issue defaults into `CEO intake` with no assignee until CEO triage
- the CEO remains the planning authority for the parent issue
- the `Skills System` plugin attaches evidence, recommendations, and candidate skill information
- any follow-up execution work can still be split into child issues or department work items

These issues should follow the same shared system-project rules as other system issues:

- severity-first ordering
- review before closure
- CEO-primary final closure for the parent issue, with human board override retained
- canonical `type`, workflow state, and `severity` as defined in the department model

If the skills plugin is unavailable or unhealthy when skill support is requested:

- the parent system issue must remain open
- the missing analysis should be recorded explicitly
- CEO triage and other governance flow must continue
- the system must not silently pretend the capability question was resolved

## 10. What The Plugin Can Own Directly

The plugin can directly own:

- registry records
- candidate records
- recommendation logic
- telemetry collection
- experiment orchestration
- external imports
- comparison reports
- request workflows
- plugin UI
- plugin tools
- evidence and recommendation updates on shared system issues

Even in this MVP, company-scoped overlays must stay isolated from one another.
The plugin must not assume that instance-level installation implies cross-company writable shared state.

The plugin can also write activity log entries for its own actions through the host services already available.

## 11. What Must Remain In Core

The following should remain core-owned:

- approval policy for production promotion
- budget policy for major skill rollout or expensive experimentation
- final production skill enablement state
- company-wide attachment or enforcement policy
- actor permissions for who can approve or roll back a skill
- audit truth for promotion and rollback decisions
- final closure of top-level system issues

This means the plugin should raise requests and recommendations, but the final accepted production state must be committed through core APIs or core services.

## 12. What Can Ship Now Without Core Changes

The following can be shipped now as a constrained plugin-first MVP on top of the current runtime:

- a unified registry view that reads production-approved skills from core and augments them with plugin-owned candidate and telemetry records
- plugin-owned candidate skill tracking
- plugin-owned recommendation engine
- plugin-owned telemetry collection
- plugin-owned external import workflow
- plugin-owned experiment scheduling
- plugin pages and settings pages
- plugin tools for searching, requesting, and recommending skills

Scope guardrail:

- this Phase-A scope is acceptable only for trusted single-company deployments or for operator-controlled multi-company deployments where boards do not get writable system-plugin tuning surfaces
- it must not be presented as a generally safe board-writable multi-company control surface until host-enforced company isolation exists

Important correction:

- this is not a claim that a broadly shippable Phase A requires zero core changes
- it is only true for a constrained advisory MVP in trusted or operator-controlled deployments

Minimum core prerequisites for a broadly shippable Phase A are:

- a first-class department model and routing contract
- a canonical shared system-project marker or equivalent core-owned identification path
- company-scoped system-plugin settings and entity/state isolation if multi-company deployment is in scope

The existing plugin system is already sufficient only for that constrained scope.

Operational note:

- sufficient for MVP does not mean unbounded
- the MVP still needs explicit retention, rollup, idempotency, and degraded-mode policy for telemetry-heavy companies

## 13. What Requires Core Changes

The moment the system wants to become the authoritative production skill layer, core changes are required.

These should be explicit, not hidden inside the plugin.

Before ordinary board-writable multi-company deployment is considered safe, core must also provide:

- company-scoped system-plugin settings as the authoritative writable path
- host-enforced company availability checks for required system plugins
- company-scoped entity and state query enforcement rather than best-effort plugin conventions

### 13.1 Required new core concepts

Core should eventually add first-class concepts for:

- production-approved company skills
- promotion request records
- promotion decisions
- rollback records
- optional department-level skill policy

### 13.2 Required core APIs

Core will eventually need APIs for:

- listing production-approved company skills
- approving a candidate skill promotion
- rejecting a promotion request
- rolling back a promoted skill
- attaching an approved skill to a department, minister, or agent
- linking approved-skill decisions to company system issues

### 13.3 Likely code areas to change

If the project wants the skills plugin to graduate from plugin-only registry into core-integrated production governance, the following host areas are likely to need changes.

#### A. Plugin host SDK surface

Current plugin host services do not expose a dedicated `skills` client.

Likely changes:

- [plugin-host-services.ts](/D:/Source/workspace/paperclip/server/src/services/plugin-host-services.ts)
- `packages/plugins/sdk/src/*`

Potential addition:

- `ctx.skills`
- company-scoped plugin settings and availability helpers that do not rely on instance-global writable config

This would let the plugin read or request mutation of core-owned skill records through a typed host API instead of inventing ad hoc plugin-only state.

#### B. Shared types and validators

Core-owned promotion requests and approved-skill records should have shared contracts.

Likely changes:

- `packages/shared/src/*`
- `packages/shared/src/validators/*`

#### C. Core routes and services

Production skill governance should not live under generic plugin bridge calls forever.

Likely additions:

- new core service for company skill governance
- new route surface for promotion gate and approved-skill lifecycle

Likely change areas:

- `server/src/routes/*`
- `server/src/services/*`

#### D. Core UI

If approved skills become first-class company assets, the main app will need core UI surfaces in addition to the plugin UI.

Likely change areas:

- `ui/src/pages/*`
- `ui/src/components/*`
- `ui/src/api/*`

#### E. Activity and audit model

Promotion and rollback decisions should have strong audit semantics in core.

Likely change areas:

- `server/src/services/activity-log.ts`
- related services and UI activity views

#### F. System issue model

If the shared company system project becomes the canonical governance surface for skill gaps and promotions, core may also need:

- explicit system issue typing
- CEO-primary final closure rules with human board override
- review-passed versus done workflow support

Likely change areas:

- `server/src/routes/issues.ts`
- `server/src/services/issues.ts`
- related UI issue views and issue policy code

## 14. Recommended Delivery Phases

### Phase A: Plugin-only MVP

Deliver:

- registry
- telemetry
- recommendations
- import
- candidates
- promotion request drafting

Acceptance criteria:

- `skill_support_requested` hand-offs can be consumed asynchronously without blocking parent issue creation
- recommendations and candidate records remain company-scoped and de-duplicated
- raw telemetry retention and rollup behavior are explicit and testable
- plugin degradation does not cause duplicate promotion requests or duplicate issue evidence
- temporary-worker-originated requests remain advisory until ratified by the owning minister
- authenticated multi-company deployments do not rely on ordinary board-writable instance-global settings

No core changes required.

### Phase B: Core-backed promotion gate

Deliver:

- production-approved skill records
- promotion approval and rejection
- rollback
- audit trail

Acceptance criteria:

- core-backed approved-skill records become the authoritative production source of truth
- promotion approval and rollback decisions are auditable in core, not only in plugin state
- plugin recommendations can be accepted or rejected without hidden side effects in plugin-owned storage

This phase requires core routes, services, shared types, and likely SDK additions.

### Phase C: Department and runtime integration

Deliver:

- department-level preferred skill policy
- minister workflow integration
- issue-context skill recommendations
- temporary worker assignment guidance
- clean interaction with execution-improvement-created `skill` issues

Acceptance criteria:

- ministers can see skill recommendations in department execution flow without bypassing department intake
- skill-related parent system issues can drive department child work without losing CEO governance
- skills-plugin outage is visible and degrades gracefully rather than blocking all department execution

### Phase D: Advanced skill lab

Deliver:

- richer experiments
- automatic candidate evaluation loops
- stronger version comparisons
- optional policy-driven auto-promotion proposals

Acceptance criteria:

- experiment results are comparable over bounded windows
- candidate-skill recommendations can be ranked and retired without leaking stale production truth
- auto-promotion remains proposal-only unless core governance explicitly authorizes stronger automation

## 15. Risks

### 15.1 Governance leakage

If the plugin becomes the final authority for production rollout, Paperclip core governance will become fragmented.

### 15.2 UI trust model

Plugin UI is currently same-origin trusted JavaScript.
That is acceptable for first-party or trusted plugins, but it is not a strong security boundary for arbitrary third-party governance-critical logic.

### 15.3 Plugin-only truth drift

If the plugin stores the production truth forever in plugin-owned entities, core and plugin will drift.

That is why plugin-only state is acceptable for MVP experimentation, but not as the final source of truth for approved production skills.

### 15.4 Overloading the first release

Trying to ship `registry + lab + promotion gate + department policy + automatic rollout` in one release will make the system too large and too hard to verify.

## 16. Recommendation

The best delivery strategy is:

1. ship the `Skills System` as a plugin-owned `Registry + Lab` first
2. keep `Promotion Gate` in core from the start as a design rule, even if the first version is manual
3. add core APIs only when the plugin needs to become the authoritative production skill layer
4. treat department integration as a later phase after the registry and promotion model are stable

This approach uses the current plugin system where it is already strong, and avoids pushing core governance into a runtime extension boundary that was never meant to own it.
