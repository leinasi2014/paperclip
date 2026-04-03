# 2026-04-02 System Self-Evolution and Hot Update Plan

Status: Proposed
Date: 2026-04-02
Audience: Product and engineering
Related:
- `doc/plans/2026-04-02-department-minister-and-subagent-org-model.md`
- `doc/plans/2026-04-02-execution-improvement-plugin.md`
- `doc/plans/2026-04-02-skills-system-plugin.md`
- `doc/plugins/PLUGIN_SPEC.md`
- `server/src/routes/plugins.ts`
- `server/src/services/plugin-host-services.ts`

## 1. Purpose

This document defines how Paperclip should support:

- self-repair
- self-optimization
- self-evolution
- hot update

without interrupting normal system operation.

The key design goal is:

- allow the system to improve itself
- without allowing it to silently rewrite or destabilize the live control plane

## 2. Core Principle

Self-evolution must be split into two layers:

- governance and approval
- mechanical rollout

The correct rule is:

- the `Execution Improvement Plugin` detects and recommends
- a responsible department implements and validates the fix
- reviewers verify it
- the `CEO` decides whether rollout or resume is allowed
- a core-owned controlled hot-update mechanism performs the switch

This is not:

- “the CEO manually edits and deploys everything”
- or “the plugin directly patches live and takes over”

It is a governed pipeline.

## 3. Who Does What

### 3.1 Execution Improvement Plugin

The `Execution Improvement Plugin` is responsible for:

- detecting fatal and non-fatal execution problems
- classifying the problem
- creating or updating the top-level system issue
- collecting evidence
- proposing likely remediation paths
- monitoring canary and post-rollout health

It is not responsible for:

- directly deploying fixes to live
- directly closing the parent system issue
- directly resuming a blocked critical chain

### 3.2 CEO

The `CEO` is responsible for:

- triaging the parent system issue
- choosing the responsible department
- deciding whether the issue should block a larger scope
- deciding whether a previously blocked chain may resume
- performing final closure of the parent system issue

The CEO is the governance authority, not the manual deploy operator.

Human board operators retain override authority for critical governance actions such as rollout approval, resume, and final closure.

Important scope split:

- company CEOs govern company-scoped routing, remediation ownership, resume, and closure
- instance-level rollout of shared required system-plugin code or worker logic is not a company-local decision
- rollout approval for instance-scoped shared plugin code belongs to human operators or instance administrators

### 3.3 Responsible technical department

The assigned technical department is responsible for:

- diagnosing the concrete implementation problem
- preparing the candidate change
- validating the candidate with bounded tests
- producing rollout evidence
- requesting review

### 3.4 Reviewer

The reviewer is responsible for:

- checking that the fix actually addresses the issue
- checking that the fix did not merely hide the symptom
- checking for obvious regressions
- determining whether the candidate is ready for canary or live promotion

The reviewer does not have final resume or closure authority.

### 3.5 Hot-update controller

The system also needs a dedicated execution layer for rollout.

This should live in core, not in a normal plugin.

Its job is purely operational:

- start candidate version
- health-check candidate
- route new traffic
- drain old traffic
- roll back if needed

It must not independently decide whether rollout is approved.

Why this must be core-owned:

- it needs host-level lifecycle control
- it must keep working even when a system plugin is unhealthy
- it may need to roll forward or roll back the very plugins being updated
- it must not depend on a self-updating plugin to update itself

Plugins may still provide:

- rollout proposals
- candidate health analysis
- canary observations
- recommendation dashboards

But the hot-switch execution path itself should remain a host capability.

## 4. What May Self-Evolve

The first version should allow self-evolution only in layers that are safe to hot-swap.

### 4.1 Allowed hot-evolution targets

- `Execution Improvement Plugin`
- `Skills System Plugin`
- skill packages
- prompts
- classification rules
- thresholds
- recommendation logic
- plugin worker logic

### 4.2 Not allowed for autonomous hot-evolution

The system must not autonomously hot-evolve:

- core backend services
- database schema
- core permission model
- approval model
- budget hard-stop model
- core issue invariants
- same-origin plugin UI bundles or approval surfaces on the current host model

If a fix requires those layers, it must go through a normal controlled release path rather than a self-evolution hot-update path.

## 5. Hot Update Safety Rules

To avoid interrupting the system, hot updates must follow these rules.

These rules describe the target productized model.
They should not be read as a claim that the current host runtime already provides full dual-slot rollout semantics today.

### 5.1 No in-place overwrite

The system must never overwrite the live implementation in place.

It must always work with:

- `live`
- `candidate`

### 5.2 Dual-slot runtime

The preferred mechanism is slot-based rollout:

- `slot A` = current live version
- `slot B` = candidate version

Candidate startup happens before cutover.

### 5.3 In-flight work does not migrate

Already-running work should not be force-migrated.

Rule:

- old runs finish on the old version
- new runs enter the new version after cutover

This avoids state corruption and half-upgraded run behavior.

### 5.4 State must remain compatible

Plugin and rule evolution must use:

- versioned state
- additive changes where possible
- lazy migration where necessary

The system must avoid stop-the-world migration as part of normal hot rollout.

### 5.5 Automatic rollback is mandatory

If a candidate version shows regression signals, the system must revert traffic to the previous live version.

Rollback triggers may include:

- error rate spikes
- timeout spikes
- token cost spikes
- false blocker spikes
- notification storms
- repeated canary failures

## 6. Rollout Modes

The system should not go straight from fix to full production.

Recommended rollout ladder:

1. `shadow`
2. `canary`
3. `full`

### 6.1 Shadow

The candidate runs in observation mode only.
It does not become the active decision-maker yet.

### 6.2 Canary

The candidate handles a small amount of new work.
The old live version remains the main path.

Canary should be governed by an explicit policy rather than by intuition.

Recommended first-version canary policy fields:

- `minDuration`
- `minSampleSize`
- `maxErrorRateDelta`
- `maxTokenCostDelta`
- `maxFalseBlockRate`
- optional bounded latency and timeout thresholds

Role split:

- the hot-update controller measures candidate behavior against the canary policy
- the plugins summarize and interpret the results
- the reviewer recommends whether the evidence is strong enough
- the final approver depends on rollout scope:
  - company-scoped candidates are normally CEO-authorized unless a human board override is used
  - instance-scoped shared system-plugin code or worker logic is authorized by a human operator or instance administrator

### 6.3 Full

The candidate becomes the new live version after the canary is judged healthy.

## 7. Fatal System Issue End-to-End Flow

This section defines the concrete flow the user asked about.

### 7.1 Fatal issue is detected

1. A fatal system problem is detected by the `Execution Improvement Plugin`.
2. The plugin classifies it, attaches evidence, and creates or updates a top-level system issue in the shared system project.
3. If rule criteria indicate a true `critical` condition, the plugin marks the relevant issue chain as `block_recommended` immediately.
4. The plugin emails the CEO and copies the human operator.

In a plugin-only MVP, read step 3 as:

- the plugin records and escalates a hard `block_recommended` condition
- actual host-enforced stopping remains dependent on existing core controls or explicit human/CEO intervention

At this point:

- the plugin has diagnosed and escalated a block recommendation
- it has not fixed
- it has not resumed

### 7.2 CEO triage

5. The system issue enters `CEO intake`.
6. The CEO reviews the issue and assigns it to the relevant technical department if that department has an active minister and is not frozen.
7. If the intended technical department is vacant or frozen, the issue must leave the autonomous hot-update path and enter a `manual_emergency_path`.
8. In `manual_emergency_path`, the CEO must choose among:
   - human-operated emergency remediation
   - staffing or replacing the required minister before technical execution resumes
   - a normal controlled release path instead of hot-update

At this point:

- the CEO owns planning
- either the technical department owns implementation
- or the issue has escalated into a manual emergency path because no lawful department owner exists

### 7.3 Technical department implements fix

9. If the issue remains on the autonomous hot-update path, the technical department prepares a candidate fix.
10. The candidate fix is implemented in an allowed hot-evolution layer only:
   - system plugin logic
   - skill
   - prompt
   - rule
   - threshold
11. The department runs bounded validation.
12. The department attaches evidence to the parent system issue and requests review.

If the fix requires core code or schema changes instead, the issue leaves the hot-update path and enters the normal release path.

If the issue is already in `manual_emergency_path`, this autonomous technical-department sequence does not apply until a lawful department owner exists again.

### 7.4 Review

13. A reviewer checks:
   - whether the real root cause was addressed
   - whether the candidate produces the expected behavior
   - whether obvious regressions are absent
14. If review fails, the issue returns to the responsible department.
15. If review passes, the issue is marked ready for rollout.

### 7.5 Canary approval

16. The correct approver depends on rollout scope:

- company-scoped candidate data, prompts, rules, or skill variants may be approved for canary by the CEO unless a human board override is used
- instance-scoped shared system-plugin code or worker-logic rollout must be approved by a human operator or instance administrator

Important:

- the plugin may recommend canary
- the reviewer may recommend canary
- company-scoped canary is normally CEO-authorized unless a human board override is used
- instance-scoped shared-plugin canary is never solely a company-CEO decision

### 7.6 Controlled hot switch

17. The hot-update controller starts the candidate version in the inactive slot.
18. The candidate passes startup and health checks.
19. The controller routes a small amount of new work to the candidate.
20. In-flight work on the old slot is left alone.
21. The controller measures canary behavior against the configured canary policy.
22. The plugin continues to monitor canary results and summarize evidence.

### 7.7 Canary outcome

If canary fails:

23. The controller routes traffic back to the old live version.
24. The parent system issue remains open.
25. Evidence is appended.
26. The technical department continues work.

If canary succeeds:

23. The plugin and reviewer attach positive evidence.
24. The issue becomes eligible for full rollout.

Canary success should require:

- the minimum duration and sample size have been met
- regression thresholds remain within the approved canary policy
- the reviewer recommends promotion
- the correct scope owner approves promotion

### 7.8 Full live cutover approval

25. The correct approver depends on rollout scope:

- company-scoped candidate data, prompts, rules, or skill variants may become live by CEO approval unless a human board override is used
- instance-scoped shared system-plugin code or worker logic may become live only by human-operator or instance-admin approval
26. If approved, the hot-update controller switches new traffic to the candidate slot.
27. The old live slot is drained and retired after in-flight work finishes.

### 7.9 Resume and closure

28. If the original fatal issue had blocked work, the issue moves to `ready_to_resume`.
29. If the CEO does not act promptly, the system sends reminder emails to the CEO and copies the human operator.
30. The CEO decides whether the blocked chain may resume unless a human board override is used.
31. Only after explicit CEO approval or human board override may ministers continue the blocked work.
32. Once the governance issue is fully resolved, the CEO closes the parent system issue unless a human board override is used.

## 8. Resume And Reminder Model

### 8.1 Resume authority

For blocked critical issues:

- review does not auto-resume
- canary success does not auto-resume
- full rollout does not auto-resume

Only the CEO may authorize resume unless a human board override is used.

### 8.2 Reminder behavior

If a blocked issue reaches `ready_to_resume` and the CEO does not act:

- the block remains in place
- reminder emails are sent to the CEO
- the human operator is copied
- the issue keeps its audit trail

### 8.3 Reminder cadence

The preferred first version uses escalating reminder intervals rather than fixed intervals.

### 8.4 Reminder email structure

Default email body order should be:

1. recent same-pattern summary
2. latest key failure
3. current blocking scope
4. review conclusion
5. recommended CEO action
6. relevant issue and run links

Email subject lines should emphasize:

1. blocking scope
2. severity

## 9. Interaction With The Skills System

When the problem is skill-related:

- the `Execution Improvement Plugin` remains the first diagnostic layer
- the `Skills System Plugin` becomes the capability support layer

The intended interaction is:

1. execution plugin identifies a likely skill gap
2. the parent issue is typed or updated as `skill`
3. the skills plugin contributes analysis and candidate remediation
4. the same governance and rollout path still applies

This keeps:

- diagnostics separate from capability supply
- rollout authority separate from recommendation authority

## 10. What Can Ship Now Without Core Changes

The following can ship as a constrained plugin-first MVP now:

- telemetry collection
- failure-pattern registry
- self-heal and blocker analysis
- recommendation dashboards
- system issue creation through existing issue and project APIs
- evidence updates on shared system issues
- candidate-versus-live analysis and shadow-style comparison for plugin, rule, prompt, and skill layers

Important limitation:

- this phase does not yet promise a true dual-slot, no-interruption hot switch
- it can support governed candidate evaluation and recommendation
- trustworthy live/candidate cutover, canary routing, and rollback require later core lifecycle support
- likewise, plugin-emitted blocking, `ready_to_resume`, and rollout states are governance signals first; they become hard runtime gates only once the corresponding core support exists
- governance approvals such as reroute, canary approval, resume, and closure must remain on core-rendered or otherwise core-validated surfaces rather than relying on same-origin plugin UI alone

Phase-A correction:

- for current Paperclip, live code updates to shared required system plugins should be described as controlled restart-path rollout, not as true hot slot switching
- shadow comparison and candidate evaluation may exist before real slot-based traffic control exists
- no Phase-A language should imply that the current runtime already supports zero-downtime shared-plugin code promotion

## 11. What Requires Core Changes

The plugin can create useful governance work now, but stronger productization will eventually require core support.

### 11.1 System issue semantics

Core may eventually need:

- system-project flags
- system issue type fields
- CEO-intake semantics for system issues
- CEO-primary final closure rules with human board override
- review-aware workflow states
- `ready_to_resume` semantics

The canonical source for shared system project semantics, system issue `type`, workflow state, and `severity` remains the department model document.

### 11.2 Hot-update lifecycle hooks

If hot update becomes a productized system capability rather than an implementation convention, core may need explicit support for:

- dual-slot plugin lifecycle
- candidate health checks
- canary routing
- rollback hooks
- drain completion tracking
- first-class rollout or deployment records
- required-system-plugin lifecycle policy
- real candidate/live slot management for shared system-plugin code
- traffic routing, health-check, and rollback support for shared-plugin rollout

Before shared required system plugins can be treated as safely self-evolving production infrastructure, core must also provide an explicit deployment gate:

- instance-scoped rollout approval by human operators or instance administrators
- versioned candidate/live records for shared plugin code and worker logic
- measurable canary health and rollback hooks owned by the host rather than by plugin convention

### 11.3 Deeper run diagnostics API

Richer execution improvement may later require:

- stronger structured run-event APIs
- easier access to token and cost rollups per pattern
- explicit run outcome categories from core services

## 12. Recommendation

The best strategy is:

1. let the `Execution Improvement Plugin` diagnose, classify, and recommend
2. let responsible departments implement bounded candidate fixes
3. keep company-scoped approval with the CEO and instance-scoped shared-plugin rollout approval with human operators
4. let a core-owned controlled hot-update mechanism execute rollout
5. keep in-flight work on the old version until it drains
6. allow self-evolution only on hot-safe layers
7. send blocked critical paths back to the CEO for explicit resume

This gives the system a governed self-improvement loop rather than an uncontrolled self-modifying runtime.
