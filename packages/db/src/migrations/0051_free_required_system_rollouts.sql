CREATE TABLE "plugin_rollouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_id" uuid NOT NULL,
	"plugin_key" text NOT NULL,
	"rollout_kind" text DEFAULT 'restart_path' NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"base_version" text NOT NULL,
	"candidate_version" text,
	"candidate_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"last_error" text,
	"requested_by_user_id" text NOT NULL,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"restart_command_json" jsonb,
	"rollback_command_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_rollouts_kind_chk" CHECK ("plugin_rollouts"."rollout_kind" in ('restart_path')),
	CONSTRAINT "plugin_rollouts_status_chk" CHECK ("plugin_rollouts"."status" in ('pending_approval', 'approved', 'rejected', 'executing', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "plugin_rollouts" ADD CONSTRAINT "plugin_rollouts_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "plugin_rollouts_plugin_idx" ON "plugin_rollouts" USING btree ("plugin_id","created_at");
--> statement-breakpoint
CREATE INDEX "plugin_rollouts_status_idx" ON "plugin_rollouts" USING btree ("status","created_at");
--> statement-breakpoint
CREATE TABLE "plugin_rollout_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rollout_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugin_rollout_approvals_decision_chk" CHECK ("plugin_rollout_approvals"."decision" in ('approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "plugin_rollout_approvals" ADD CONSTRAINT "plugin_rollout_approvals_rollout_id_plugin_rollouts_id_fk" FOREIGN KEY ("rollout_id") REFERENCES "public"."plugin_rollouts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "plugin_rollout_approvals_rollout_idx" ON "plugin_rollout_approvals" USING btree ("rollout_id","created_at");
