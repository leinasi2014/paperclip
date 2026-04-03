ALTER TABLE "agents" ADD CONSTRAINT "agents_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_id_uq" UNIQUE("company_id","id");--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_company_department_fk" FOREIGN KEY ("company_id","department_id") REFERENCES "public"."departments"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_minister_fk" FOREIGN KEY ("company_id","minister_agent_id") REFERENCES "public"."agents"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_company_owning_department_fk" FOREIGN KEY ("company_id","owning_department_id") REFERENCES "public"."departments"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_budget_monthly_non_negative_chk" CHECK ("agents"."budget_monthly_cents" >= 0);--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_spent_monthly_non_negative_chk" CHECK ("agents"."spent_monthly_cents" >= 0);--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_status_chk" CHECK ("department_budget_envelopes"."status" in ('allocated', 'reserved_only', 'active'));--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_monthly_limit_non_negative_chk" CHECK ("department_budget_envelopes"."monthly_limit_cents" >= 0);--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_reserved_non_negative_chk" CHECK ("department_budget_envelopes"."reserved_cents" >= 0);--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_spent_non_negative_chk" CHECK ("department_budget_envelopes"."spent_cents" >= 0);--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_status_chk" CHECK ("departments"."status" in ('active', 'frozen_unstaffed', 'frozen_suspended'));--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_max_workers_non_negative_chk" CHECK ("departments"."max_concurrent_temporary_workers" >= 0);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_system_issue_type_chk" CHECK ("issues"."system_issue_type" is null or "issues"."system_issue_type" in ('execution', 'skill', 'governance'));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_system_issue_severity_chk" CHECK ("issues"."system_issue_severity" is null or "issues"."system_issue_severity" in ('critical', 'high', 'medium', 'low'));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_system_issue_workflow_state_chk" CHECK ("issues"."system_issue_workflow_state" is null or "issues"."system_issue_workflow_state" in ('open', 'triaging', 'in_progress', 'pending_review', 'review_passed', 'ready_to_resume', 'done'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_system_project_kind_chk" CHECK ("projects"."system_project_kind" is null or "projects"."system_project_kind" in ('execution_governance'));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_system_project_flag_consistency_chk" CHECK ("projects"."system_project_kind" is null or "projects"."is_system_project" = true);
