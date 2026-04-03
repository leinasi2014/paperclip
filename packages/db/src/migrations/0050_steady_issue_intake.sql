ALTER TABLE "issues" ADD COLUMN "department_intake_status" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "routed_by_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "routed_by_user_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "routed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "minister_decision_response" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "minister_decision_by_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "minister_decision_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "minister_decision_reason" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_department_intake_status_chk" CHECK ("issues"."department_intake_status" is null or "issues"."department_intake_status" in ('ceo_intake', 'routed', 'accepted', 'rejected', 'needs_clarification'));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_minister_decision_response_chk" CHECK ("issues"."minister_decision_response" is null or "issues"."minister_decision_response" in ('accept', 'reject', 'needs_clarification'));--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_routed_by_agent_id_agents_id_fk" FOREIGN KEY ("routed_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_minister_decision_by_agent_id_agents_id_fk" FOREIGN KEY ("minister_decision_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_company_routed_by_agent_fk" FOREIGN KEY ("company_id","routed_by_agent_id") REFERENCES "public"."agents"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_company_minister_decision_by_agent_fk" FOREIGN KEY ("company_id","minister_decision_by_agent_id") REFERENCES "public"."agents"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "issues"
SET "department_intake_status" = CASE
  WHEN "owning_department_id" IS NULL THEN 'ceo_intake'
  ELSE 'routed'
END
WHERE "system_issue_type" IS NOT NULL
  AND "department_intake_status" IS NULL;--> statement-breakpoint
