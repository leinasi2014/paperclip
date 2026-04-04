CREATE TABLE "board_assistant_binding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"binding_code" text NOT NULL,
	"binding_token_hash" text NOT NULL,
	"initiated_by" text NOT NULL,
	"external_user_id" text,
	"external_thread_id" text,
	"external_display_name" text,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"external_user_id" text NOT NULL,
	"external_thread_id" text,
	"external_display_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_bundle_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_kind" text NOT NULL,
	"revision_label" text NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"updated_by" text NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_kind" text NOT NULL,
	"summary" text NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"visibility_policy" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_memory_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"memory_kind" text NOT NULL,
	"summary" text NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"visibility_policy" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_session_id" uuid,
	"external_thread_id" text,
	"current_step" integer DEFAULT 1 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"external_user_id" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"status" text NOT NULL,
	"checkpoint_kind" text NOT NULL,
	"target_ref" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_request_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"target_ref" text NOT NULL,
	"status" text NOT NULL,
	"blocked_reason" text,
	"issue_id" uuid,
	"instance_action" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"binding_id" uuid,
	"thread_id" uuid,
	"external_user_id" text NOT NULL,
	"external_thread_id" text NOT NULL,
	"external_message_id" text NOT NULL,
	"status" text NOT NULL,
	"message_text" text DEFAULT '' NOT NULL,
	"normalized_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intent_kind" text,
	"summary" text,
	"card_payload" jsonb,
	"blocked_reason" text,
	"target_kind" text,
	"target_ref" text,
	"proposed_action" text,
	"proposed_payload" jsonb,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_thread_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_kind" text NOT NULL,
	"author_ref" text,
	"direction" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supersedes_message_id" uuid,
	"superseded_by_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_assistant_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_kind" text NOT NULL,
	"channel" text,
	"binding_id" uuid,
	"external_thread_id" text,
	"subject_type" text,
	"subject_id" text,
	"mode" text DEFAULT 'observe' NOT NULL,
	"active_context_summary" text,
	"archived_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"set_by" text,
	"set_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instance_settings" ADD COLUMN "board_assistant" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "board_assistant_onboarding_sessions" ADD CONSTRAINT "board_assistant_onboarding_sessions_binding_session_id_board_assistant_binding_sessions_id_fk" FOREIGN KEY ("binding_session_id") REFERENCES "public"."board_assistant_binding_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_outbox" ADD CONSTRAINT "board_assistant_outbox_request_id_board_assistant_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."board_assistant_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_request_targets" ADD CONSTRAINT "board_assistant_request_targets_request_id_board_assistant_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."board_assistant_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_request_targets" ADD CONSTRAINT "board_assistant_request_targets_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_requests" ADD CONSTRAINT "board_assistant_requests_binding_id_board_assistant_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."board_assistant_bindings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_requests" ADD CONSTRAINT "board_assistant_requests_thread_id_board_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."board_assistant_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_thread_messages" ADD CONSTRAINT "board_assistant_thread_messages_thread_id_board_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."board_assistant_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_assistant_threads" ADD CONSTRAINT "board_assistant_threads_binding_id_board_assistant_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."board_assistant_bindings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_binding_sessions_token_hash_uq" ON "board_assistant_binding_sessions" USING btree ("binding_token_hash");--> statement-breakpoint
CREATE INDEX "board_assistant_binding_sessions_status_idx" ON "board_assistant_binding_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_bindings_active_uq" ON "board_assistant_bindings" USING btree ("status") WHERE "board_assistant_bindings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "board_assistant_bindings_channel_user_idx" ON "board_assistant_bindings" USING btree ("channel","external_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_bundle_revisions_active_uq" ON "board_assistant_bundle_revisions" USING btree ("bundle_kind") WHERE "board_assistant_bundle_revisions"."is_active" = true;--> statement-breakpoint
CREATE INDEX "board_assistant_bundle_revisions_kind_created_idx" ON "board_assistant_bundle_revisions" USING btree ("bundle_kind","created_at");--> statement-breakpoint
CREATE INDEX "board_assistant_memories_kind_status_idx" ON "board_assistant_memories" USING btree ("memory_kind","status");--> statement-breakpoint
CREATE INDEX "board_assistant_memory_proposals_status_created_idx" ON "board_assistant_memory_proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_onboarding_sessions_binding_active_uq" ON "board_assistant_onboarding_sessions" USING btree ("binding_session_id") WHERE "board_assistant_onboarding_sessions"."status" = 'active' and "board_assistant_onboarding_sessions"."binding_session_id" is not null;--> statement-breakpoint
CREATE INDEX "board_assistant_onboarding_sessions_status_expires_idx" ON "board_assistant_onboarding_sessions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_outbox_request_checkpoint_uq" ON "board_assistant_outbox" USING btree ("request_id","checkpoint_kind","target_ref");--> statement-breakpoint
CREATE INDEX "board_assistant_outbox_status_attempt_idx" ON "board_assistant_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_request_targets_request_target_uq" ON "board_assistant_request_targets" USING btree ("request_id","target_kind","target_ref");--> statement-breakpoint
CREATE INDEX "board_assistant_request_targets_request_status_idx" ON "board_assistant_request_targets" USING btree ("request_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "board_assistant_requests_ingress_uq" ON "board_assistant_requests" USING btree ("channel","external_user_id","external_thread_id","external_message_id");--> statement-breakpoint
CREATE INDEX "board_assistant_requests_status_updated_idx" ON "board_assistant_requests" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "board_assistant_requests_thread_created_idx" ON "board_assistant_requests" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "board_assistant_thread_messages_thread_created_idx" ON "board_assistant_thread_messages" USING btree ("thread_id","created_at","id");--> statement-breakpoint
CREATE INDEX "board_assistant_threads_kind_updated_idx" ON "board_assistant_threads" USING btree ("thread_kind","updated_at");--> statement-breakpoint
CREATE INDEX "board_assistant_threads_external_idx" ON "board_assistant_threads" USING btree ("channel","external_thread_id");--> statement-breakpoint
CREATE INDEX "board_assistant_threads_subject_idx" ON "board_assistant_threads" USING btree ("subject_type","subject_id");--> statement-breakpoint
