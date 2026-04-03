CREATE TABLE "temporary_workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"owner_minister_agent_id" uuid NOT NULL,
	"source_issue_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ttl_expires_at" timestamp with time zone NOT NULL,
	"status_reason" text,
	"resume_requested_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temporary_workers_status_chk" CHECK ("temporary_workers"."status" in (
		'active',
		'paused_due_to_department_freeze',
		'paused_pending_ceo_resume',
		'ttl_expired_pending_minister',
		'ttl_expired_pending_ceo_or_board',
		'terminated'
	))
);
--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "temporary_worker_ttl_minutes" integer DEFAULT 480 NOT NULL;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_owner_minister_agent_id_agents_id_fk" FOREIGN KEY ("owner_minister_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_source_issue_id_issues_id_fk" FOREIGN KEY ("source_issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_company_department_fk" FOREIGN KEY ("company_id","department_id") REFERENCES "public"."departments"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temporary_workers" ADD CONSTRAINT "temporary_workers_company_minister_fk" FOREIGN KEY ("company_id","owner_minister_agent_id") REFERENCES "public"."agents"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "temporary_workers_company_idx" ON "temporary_workers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "temporary_workers_department_idx" ON "temporary_workers" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "temporary_workers_owner_minister_idx" ON "temporary_workers" USING btree ("owner_minister_agent_id");--> statement-breakpoint
CREATE INDEX "temporary_workers_source_issue_idx" ON "temporary_workers" USING btree ("source_issue_id");--> statement-breakpoint
CREATE INDEX "temporary_workers_department_status_idx" ON "temporary_workers" USING btree ("department_id","status");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_temporary_worker_ttl_positive_chk" CHECK ("departments"."temporary_worker_ttl_minutes" > 0);
