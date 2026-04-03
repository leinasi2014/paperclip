CREATE TABLE "department_budget_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"monthly_limit_cents" integer DEFAULT 0 NOT NULL,
	"reserved_cents" integer DEFAULT 0 NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'reserved_only' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"mission" text,
	"status" text DEFAULT 'frozen_unstaffed' NOT NULL,
	"minister_agent_id" uuid,
	"max_concurrent_temporary_workers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "ceo_agent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "owning_department_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "system_issue_type" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "system_issue_severity" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "system_issue_workflow_state" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "block_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_system_project" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "system_project_kind" text;--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_budget_envelopes" ADD CONSTRAINT "department_budget_envelopes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_minister_agent_id_agents_id_fk" FOREIGN KEY ("minister_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_budget_envelopes_company_idx" ON "department_budget_envelopes" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "department_budget_envelopes_department_idx" ON "department_budget_envelopes" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_company_slug_idx" ON "departments" USING btree ("company_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_minister_agent_idx" ON "departments" USING btree ("minister_agent_id");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_owning_department_id_departments_id_fk" FOREIGN KEY ("owning_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_company_owning_department_idx" ON "issues" USING btree ("company_id","owning_department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_company_system_kind_uq" ON "projects" USING btree ("company_id","system_project_kind") WHERE "projects"."is_system_project" = true and "projects"."system_project_kind" is not null;