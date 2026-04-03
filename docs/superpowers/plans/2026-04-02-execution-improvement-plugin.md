# 2026-04-02 Execution Improvement Plugin Plan

Status: Proposed
Date: 2026-04-02
Audience: Product and engineering
Related:
- `doc/plans/2026-04-02-department-minister-and-subagent-org-model.md`
- `doc/plans/2026-04-02-skills-system-plugin.md`
- `doc/plans/2026-04-02-system-self-evolution-and-hot-update.md`
- `doc/plugins/PLUGIN_SPEC.md`
- `doc/plugins/PLUGIN_AUTHORING_GUIDE.md`
- `server/src/routes/plugins.ts`
- `server/src/services/plugin-host-services.ts`
- `server/src/services/plugin-event-bus.ts`

## 1. Purpose

This document defines a plugin-first `Execution Improvement System` for Paperclip.

Its job is to observe how agents actually execute work, detect failures and waste, and convert those observations into company-level improvement work owned by the CEO.

The system should answer questions such as:

- which runs are repeatedly blocked
- which failures self-heal versus require intervention
- which execution paths waste tokens or time
- which failures are caused by missing skills versus permissions versus workflow versus product defects
- which recurring problems should become explicit system work

This plugin is not the final authority for governance decisions.
It is the diagnostic and recommendation layer.

## 2. Decision Summary

The `Execution Improvement Plugin` should:

- observe runs, issues, retries, self-corrections, and blocking patterns
- classify execution problems
- create or update company system issues in the shared system project
- route all top-level planning responsibility back to the CEO
- cooperate with the `Skills System Plugin` when the diagnosed problem is a capability gap
- exist as a system-level first-party plugin installed by default at the instance level

It should not:

- directly close top-level system issues
- directly modify core governance policy
- directly grant permissions or budget authority
- directly promote skills into production
- directly unblock critical chains after review
- directly execute hot-switch rollout

## 3. Installation And Management Model

The `Execution Improvement Plugin` should be treated as a system-level first-party plugin.

That means:

- it should be bundled with the product
- it should be installed or enabled by default for the instance
- it should be enabled by default and not be operator-disableable in normal operation
- it should not be treated as an optional per-company add-on
- its outputs should remain company-scoped within each company context

It should still appear in the plugin management UI as a visible system plugin.

Recommended management behavior:

- visible in the plugin list
- marked as `system` and `required`
- not uninstallable in normal operation
- not disableable in normal operation
- allowed to expose a limited configuration surface

Allowed configuration should be limited to runtime tuning, such as:

- blocker thresholds
- self-heal versus incident thresholds
- de-duplication behavior
- evidence rollup windows
- recommendation sensitivity
- reminder timing

Configuration must not allow operators to remove or bypass the plugin's core system responsibilities.

The runtime package is instance-level, but governance and data boundaries must still split cleanly:

- instance-level bootstrap defaults and safety rails are writable only by human operators or instance administrators
- company-scoped tuning, evidence, and recommendation data must remain isolated per company
- an ordinary board in company A must not be able to change thresholds or behavior that affect company B

If host-enforced per-company configuration and data isolation do not yet exist, authenticated multi-company deployments should treat this plugin as safe only when:

- a human operator controls all writable system-plugin settings
- or the deployment is effectively trusted as single-company

Phase-A consequence:

- ordinary company boards must not receive writable system-plugin tuning surfaces in authenticated multi-company deployments
- per-company writable tuning is deferred until host-enforced company isolation exists

When rollout is needed, the plugin may recommend it and later observe it, but the actual hot-switch execution belongs to the core-owned hot-update controller.

## 4. Why A Plugin Is A Good Fit

The current plugin runtime already provides the key building blocks needed for this system:

- event subscriptions
- scheduled jobs
- plugin state and entity storage
- company, issue, agent, and run-related host services
- plugin pages and settings pages
- plugin agent tools
- activity logging

That means a plugin can already:

- collect run telemetry
- keep failure-pattern records
- maintain optimization recommendations
- render company dashboards
- create or update evidence on governance work items

This is a strong fit for a plugin-first implementation because the system is mostly about:

- observation
- analysis
- classification
- recommendation

Those are extension-friendly capabilities.

## 5. Boundaries

The `Execution Improvement Plugin` must not become a shadow control plane.

### 5.1 It is not the final governor

It may diagnose and recommend.
It may not become the final source of truth for:

- permissions
- budget policy
- approval rules
- final issue closure
- company restructuring
- resume authorization after critical blocking

The CEO is the default governance actor for these actions.
Human board operators retain top-level override authority.

Current plugin boundaries are still partly contractual rather than fully enforced by host runtime policy.
Stronger host-side enforcement is a later core concern, not something this plugin should assume already exists.

### 5.2 It is not the skills system

It may decide that a problem is skill-related.
It should not absorb skill registry, skill lab, or skill promotion responsibilities.

### 5.3 It is not an alternate issue tracker

It should use the company shared system project as the top-level governance surface.
It should not invent a second independent improvement-ticket model outside Paperclip issues unless there is a compelling reason later.

## 6. Classification Model

The plugin should classify problems along multiple dimensions.

### 6.1 Primary source classification

The first version should use a small source taxonomy.

Recommended source classes:

- `permission`
- `skill`
- `workflow`
- `product_bug`
- `runtime`

This source classification is the primary grouping key.

### 6.2 Impact classification

After source classification, the plugin should determine business impact.

Examples:

- affects one issue chain
- affects one department
- affects company-level governance
- affects budget or data safety

The preferred evaluation order is:

1. classify by source
2. then derive impact

### 6.3 System issue type mapping

At the system-issue level, the plugin should map problems into the canonical system issue `type` values defined in the department model.

For this design set, those canonical values are:

- `execution`
- `skill`
- `governance`

The department model remains the authority for the shared system project semantics and issue taxonomy.

## 7. Rules Versus LLM

The first version should use:

- rules as the primary classifier
- LLM as a supporting analyzer

### 7.1 What rules should own

Rules should own:

- hard classification gates
- de-duplication keys
- severity thresholds
- auto-block eligibility
- whether a problem can trigger automatic `critical` handling

### 7.2 What the LLM should assist with

The LLM should assist with:

- evidence summarization
- pattern explanation
- likely root-cause narratives
- candidate grouping suggestions
- next-step recommendations

### 7.3 Hard guardrail

The LLM must not be the sole authority for:

- automatic blocking
- automatic unblocking
- automatic closure of system issues

Automatic blocking requires rule-based high-confidence criteria.

## 8. Severity Model

Use the canonical system-issue severity model and default sort order defined in the department model.

For this design set, that means:

- sort by `severity` first
- then by `frequency`
- use `critical / high / medium / low`

### 8.1 Source-to-severity bias

The first version should be stricter by default for:

- `permission`
- `governance`

These should be more likely to escalate into `critical` when high-confidence rules fire.

`product_bug` and `runtime` should normally begin lower unless they create:

- data-loss risk
- company-wide unavailability
- repeated high-risk failures
- cross-department blocking

## 9. Execution Outcome Model

The plugin should classify execution outcomes rather than flatten everything into success or failure.

Recommended run outcome classes:

- `succeeded`
- `self_healed`
- `blocked`
- `failed_fatal`

### 9.1 Meaning

`self_healed`

- the run encountered an error
- the agent corrected itself within bounded retries
- the path still matters because repeated self-healing may indicate optimization debt

`blocked`

- the run cannot move forward without external action
- examples:
  - permission gap
  - missing skill
  - missing routing decision
  - unaccepted department intake

`failed_fatal`

- continuing automatically is unsafe or pointless
- examples:
  - invariant break risk
  - data-loss risk
  - repeated deterministic failure
  - clearly unrecoverable execution path

## 10. Critical Handling Model

### 10.1 Default rule

If a high-confidence rule identifies a `critical` problem, the target core-backed model is that the plugin should:

- immediately create or update a system issue
- immediately notify the CEO
- copy the human operator
- immediately mark the relevant execution path as requiring block

This should happen without waiting for CEO pre-approval.

The reason is simple:

- once a high-confidence `critical` governance or permission failure exists, continuing the chain is usually riskier than temporarily stopping it

Plugin-only Phase-A limitation:

- in Phase A, the plugin may create or update the parent system issue, attach `block_recommended` evidence, and notify the CEO and human operator
- Phase A should not be described as a guaranteed host-enforced hard-stop unless a separate core gate already exists
- trustworthy hard blocking is a later core-backed capability, even if the plugin already classifies and escalates the incident

### 10.2 Blocking scope

Default blocking scope should be:

- the affected issue
- or the affected execution chain

This is preferred over immediate department-wide blocking because it is more precise and less disruptive.

### 10.3 Escalation to department blocking

The plugin may recommend department-level blocking only when rule criteria show that:

- the same `critical` pattern is repeating across the department
- the root cause is department-shared
- continuing department execution would predictably recreate the same high-risk result

Department-level blocking should be authorized by the CEO or a human board override, not by the plugin alone.

### 10.4 Resume authority

Blocked critical chains must not resume automatically.

The intended flow is:

1. critical problem triggers blocking
2. system issue enters CEO-controlled governance flow
3. responsible side implements a fix
4. review succeeds
5. the issue enters `ready_to_resume`
6. only the CEO normally authorizes resume unless a human board override is used
7. ministers continue work only after explicit CEO instruction

This applies both to issue-chain blocking and to any escalated department-level blocking.

## 11. Shared System Project Integration

The plugin should not stop at dashboards.
It should materialize governance work as system issues in the shared company system project.

### 11.1 Shared system project

All top-level improvement work should go into the shared company system project defined in the department model.

The project should be:

- company-wide
- automatically created during company initialization
- a normal project with system-reserved semantics
- planned by the CEO
- backfilled for existing companies through migration or reconciliation rather than assumed to already exist

### 11.2 Issue types

The plugin should create or update system issues using the canonical `type` values defined in the department model rather than inventing plugin-local categories.

### 11.3 Issue authority

System issues should enter `CEO intake`.

The plugin may:

- create them
- update evidence
- attach diagnostics
- suggest status changes

The plugin may not:

- directly mark them `done`
- bypass CEO planning

If a human board override directly re-routes a parent issue or changes its owning department:

- the old responsibility line must be treated as superseded
- prior department-linked active execution assumptions must be cleared
- preserved evidence may remain attached, but follow-up execution must re-enter the new department's normal acceptance path unless a human-operated emergency path is chosen

## 12. Review And Closure

### 12.1 Parent issue flow

The preferred top-level flow is:

1. plugin observes a recurring or significant problem
2. plugin creates or updates a parent system issue in the shared system project
3. issue enters `CEO intake`
4. CEO triages and decides the follow-up path
5. follow-up work is assigned to the appropriate department or system owner
6. responsible party submits work for review
7. reviewer verifies outcome
8. CEO performs final closure or resume authorization

### 12.2 Closure rule

Top-level system issues should normally be closed by the CEO.

Human board operators retain emergency override authority.

The plugin must never directly set `done`.

### 12.3 Review rule

The plugin may recommend review, but review remains a human or ministerial governance function.

The preferred first model is:

- `execution` issues reviewed by an execution review minister
- `skill` issues reviewed by a skill review minister
- `governance` issues reviewed by a governance review minister

The recommended staffing model is:

- V1: these are dual-hatted review functions, not separate formal review departments
- V2: promote them into dedicated review ministers only if review load becomes a sustained bottleneck

Hard independence rules:

- the minister or department responsible for the fix must not review the same parent system issue
- the same responsibility line must not satisfy both implementation and review roles
- if no eligible cross-line reviewer exists, the review must escalate to a human operator

## 13. Reminder And Notification Model

When a blocked `critical` issue becomes `ready_to_resume` and the CEO does not act, the system should:

- keep the block in place
- send reminder emails to the CEO
- copy the human operator
- avoid automatic resume

### 13.1 Reminder cadence

The first version should use escalating reminder intervals rather than fixed intervals.

This better supports:

- early visibility
- lower long-tail noise
- stronger escalation as delay increases

### 13.2 Delivery channel

Primary reminder channel:

- email

Recommended audit side effect:

- also append reminder evidence to the linked system issue

### 13.3 Email content order

Default email body order should be:

1. recent same-pattern summary
2. latest key failure
3. current blocking scope
4. review conclusion
5. recommended CEO action
6. relevant issue and run links

### 13.4 Grouping model

Same-pattern summaries should be grouped primarily by problem pattern, with time-window statistics attached.

This means:

- pattern first
- recent frequency second

### 13.5 Subject emphasis

Email subject lines should emphasize:

1. blocking scope
2. severity

This makes it easier for the CEO and human operator to immediately understand impact.

## 14. Collaboration With The Skills System Plugin

The `Execution Improvement Plugin` should be the first diagnostic layer.
The `Skills System Plugin` should be the downstream capability layer.

### 14.1 Hand-off rule

If the execution plugin concludes that the core problem is capability-related, it should:

- mark the system issue as `type = skill`
- attach its evidence
- emit an asynchronous `skill_support_requested` hand-off

The preferred handshake is event-driven rather than synchronous RPC.

Recommended contract:

- `Execution Improvement Plugin` emits `skill_support_requested`
- the event includes the parent system issue id, company id, evidence summary, and requested capability context
- the `Skills System Plugin` responds asynchronously with `skill_support_analyzed`
- the response attaches recommendations, candidate-skill references, or failure context back to the same parent issue

The execution plugin must not block governance progress waiting on a synchronous skills reply.

If the skills plugin is unavailable, unhealthy, or times out:

- the parent system issue remains open in the shared system project
- the execution plugin records `skills_plugin_unavailable` or equivalent degraded evidence
- CEO triage still proceeds
- the missing skills analysis becomes explicit follow-up work rather than a hidden dependency

This hand-off must preserve company isolation:

- events must carry explicit `companyId`
- evidence and recommendations must be written back only into that same company context
- no plugin may rely on implicit instance-global correlation for skill support follow-up

The skills plugin may then:

- recommend an existing skill
- recommend a candidate skill
- recommend new skill work
- attach evaluation results back to the same parent issue

### 14.2 Division of labor

Execution plugin:

- why did this run or workflow fail
- is this a repeated pattern
- is this self-healing waste
- should this become a system issue

Skills plugin:

- which capability or skill can help
- how should a skill be improved
- should a candidate skill be promoted

## 15. Plugin Data Model

The MVP should keep its own records in plugin-owned storage.

Use:

- `plugin_entities`
- `plugin_state`

Suggested `entity_type` values:

- `run_incident`
- `failure_pattern`
- `self_heal_pattern`
- `blocker_cluster`
- `optimization_opportunity`
- `system_issue_link`
- `review_request`

Suggested fields:

- related company
- related agent
- related issue
- related run ids
- source class
- impact class
- severity
- frequency
- cost impact
- evidence summary
- recommended action
- linked system issue id if created

### 15.1 Retention, rollup, and degraded mode

The MVP should assume plugin-owned storage is bounded and needs consolidation.

Recommended first-version rules:

- keep raw incident records for a bounded retention window
- roll repeated incidents into periodic aggregates
- use idempotent de-duplication keys for repeated events and reminders
- separate raw evidence from long-lived pattern summaries

If plugin event delivery or storage falls behind:

- the plugin should enter a degraded mode
- continue creating high-signal system issues where possible
- reduce non-critical recommendation churn
- avoid duplicate reminder or duplicate issue storms

The plugin should explicitly document:

- retention window
- rollup cadence
- de-duplication key strategy
- degraded-mode behavior

## 16. Plugin UI And Tools

### 16.1 Plugin UI

The plugin should expose a company page and a settings page.

Suggested company page sections:

- `Overview`
- `Critical Blockers`
- `Self-Heal Waste`
- `Fatal Failures`
- `Open System Issues`
- `Recommendations`
- `Pattern Clusters`

These plugin pages are observability and recommendation surfaces.
They must not become the sole approval surface for:

- reroute
- review approval
- resume
- final closure

Those governance actions belong on core-rendered or otherwise core-validated surfaces.

Suggested issue and agent detail extensions:

- recent execution health for this agent
- recurring blocker summary for this issue
- linked system improvement records

### 16.2 Plugin tools

The plugin may expose tools such as:

- `execution.analyze-run`
- `execution.summarize-agent-health`
- `execution.list-open-blockers`
- `execution.explain-pattern`
- `execution.recommend-next-step`

These tools should help CEO and ministers understand what happened.
They should not mutate governance policy directly.

## 17. What Can Ship Now Without Core Changes

The following can ship as a constrained plugin-first MVP now:

- telemetry collection
- failure-pattern registry
- self-heal and blocker analysis
- recommendation dashboards
- system issue creation through existing issue and project APIs
- evidence updates on shared system issues
- email reminders through the existing notification path, if available

The current plugin runtime is already sufficient for this level.

Important limitation:

- this phase can create useful governance work and advisory issue flows
- it does not by itself create hard-enforced core system-issue semantics
- explicit core-backed `CEO intake`, review gates, and resume gates belong to later phases
- it should not be treated as a generally safe board-writable multi-company control surface

Important correction:

- this is not a claim that a production-safe Phase A requires zero core changes
- it is only true for a constrained advisory MVP in trusted or operator-controlled deployments

Minimum core prerequisites for a broadly shippable Phase A are:

- a first-class department model and routing contract
- a canonical shared system-project marker or equivalent core-owned identification path
- explicit issue routing metadata such as `owningDepartmentId` or equivalent
- company-scoped system-plugin settings and entity/state isolation if multi-company deployment is in scope

## 18. What Requires Core Changes

The plugin can create useful governance work now, but stronger productization will eventually require core support.

Before ordinary board-writable multi-company deployment is considered safe, core must also provide:

- company-scoped system-plugin settings as the authoritative writable path
- host-enforced company availability checks for required system plugins
- company-scoped entity and state query enforcement rather than best-effort plugin conventions

### 18.1 System issue semantics

If the product wants first-class support for company system issues, core may need:

- system-project flags
- system issue type fields
- CEO-intake semantics for system issues
- CEO-primary final closure rules with human board override
- review-aware workflow states
- `ready_to_resume` semantics
- company-scoped required-system-plugin settings and availability enforcement

Likely change areas:

- `packages/shared/src/*`
- `server/src/routes/issues.ts`
- `server/src/services/issues.ts`
- `ui/src/pages/*`
- `ui/src/components/*`

### 18.2 Review workflow support

If review becomes first-class rather than convention-based, core may need:

- review-role metadata
- structured review requests
- approval-like transitions for system issue review

### 18.3 Deeper run diagnostics API

The plugin can already observe much of the system indirectly, but richer diagnostics may eventually require:

- stronger structured run-event APIs
- better categorization of retry versus block versus fatal failure
- easier access to token and cost rollups per pattern

Likely change areas:

- `server/src/services/heartbeat/*`
- related run routes and run event surfaces

## 19. Recommended Delivery Phases

### Phase A: Plugin-only MVP

Deliver:

- run analysis
- blocker detection
- optimization recommendations
- system issue creation in the shared company system project

Scope guardrail:

- Phase A is acceptable only for trusted single-company deployments or for operator-controlled multi-company deployments where boards do not get writable system-plugin tuning surfaces

Acceptance criteria:

- repeated incidents de-duplicate correctly within a bounded window
- high-confidence `critical` rules can create one parent system issue and attach one de-duplicated `block_recommended` path without creating duplicate parent issues
- parent issues enter the shared system project and `CEO intake`
- skills-related incidents can emit an asynchronous `skill_support_requested` hand-off without blocking issue creation
- plugin degradation does not create duplicate reminder or issue storms
- the MVP clearly documents which gates are advisory conventions in this phase and which ones are already core-enforced
- authenticated multi-company deployments do not treat plugin-owned settings as board-writable cross-company control surfaces

### Phase B: Typed system issue model

Deliver:

- core support for typed system issues
- CEO intake semantics for system issues
- review-aware workflow states
- explicit resume gating

Acceptance criteria:

- canonical `type`, workflow state, and `severity` come from core-backed shared contracts
- top-level system issue closure is enforceably CEO-primary with human board override
- review and resume transitions are represented explicitly in core-backed workflow semantics
- UI can distinguish parent system issues from ordinary issue flow without plugin-only conventions

### Phase C: Closed-loop optimization

Deliver:

- better interaction with the skills plugin
- measurement of whether fixes actually reduced failure frequency and cost
- stronger recurring-pattern automation

Acceptance criteria:

- execution-to-skills hand-off can be measured end-to-end
- post-fix recurrence, token cost, and blocker-rate deltas are visible on the parent issue or linked analytics
- degraded plugin conditions are observable rather than silent

## 20. Recommendation

The best strategy is:

1. make the `Execution Improvement Plugin` the first observer and classifier of execution problems
2. use rule-based `block_recommended` signals for high-confidence critical conditions until core-backed hard blocking exists
3. use the LLM as an analyst and summarizer, not as the sole blocker authority
4. route all top-level improvement planning back to the CEO through the shared system project
5. keep skill-specific follow-up delegated to the `Skills System Plugin`
6. keep final governance, review, and closure in core or CEO-controlled workflow

This preserves a clean split:

- execution plugin diagnoses
- skills plugin supplies capability
- CEO governs
