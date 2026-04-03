CREATE TABLE IF NOT EXISTS "company_skill_candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "source_plugin_key" text NOT NULL,
  "skill_key" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "markdown" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_skill_candidates_company_id_companies_id_fk'
  ) THEN
    ALTER TABLE "company_skill_candidates"
      ADD CONSTRAINT "company_skill_candidates_company_id_companies_id_fk"
      FOREIGN KEY ("company_id")
      REFERENCES "public"."companies"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "issues_company_id_id_uq"
  ON "issues" USING btree ("company_id","id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'temporary_workers_company_source_issue_fk'
  ) THEN
    ALTER TABLE "temporary_workers"
      ADD CONSTRAINT "temporary_workers_company_source_issue_fk"
      FOREIGN KEY ("company_id", "source_issue_id")
      REFERENCES "public"."issues"("company_id", "id");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "company_skill_candidates_company_id_id_uq"
  ON "company_skill_candidates" USING btree ("company_id","id");

CREATE UNIQUE INDEX IF NOT EXISTS "company_skill_candidates_company_skill_key_uq"
  ON "company_skill_candidates" USING btree ("company_id","skill_key");

CREATE INDEX IF NOT EXISTS "company_skill_candidates_company_slug_idx"
  ON "company_skill_candidates" USING btree ("company_id","slug");

CREATE TABLE IF NOT EXISTS "company_skill_promotion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "candidate_id" uuid NOT NULL,
  "source_plugin_key" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "note" text,
  "approved_by_user_id" text,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_skill_promotion_requests_company_id_companies_id_fk'
  ) THEN
    ALTER TABLE "company_skill_promotion_requests"
      ADD CONSTRAINT "company_skill_promotion_requests_company_id_companies_id_fk"
      FOREIGN KEY ("company_id")
      REFERENCES "public"."companies"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_skill_promotion_requests_candidate_id_company_skill_candidates_id_fk'
  ) THEN
    ALTER TABLE "company_skill_promotion_requests"
      ADD CONSTRAINT "company_skill_promotion_requests_candidate_id_company_skill_candidates_id_fk"
      FOREIGN KEY ("candidate_id")
      REFERENCES "public"."company_skill_candidates"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_skill_promotion_requests_company_candidate_fk'
  ) THEN
    ALTER TABLE "company_skill_promotion_requests"
      ADD CONSTRAINT "company_skill_promotion_requests_company_candidate_fk"
      FOREIGN KEY ("company_id", "candidate_id")
      REFERENCES "public"."company_skill_candidates"("company_id", "id")
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "company_skill_promotion_requests_pending_candidate_uq"
  ON "company_skill_promotion_requests" USING btree ("company_id","candidate_id")
  WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "company_skill_promotion_requests_company_idx"
  ON "company_skill_promotion_requests" USING btree ("company_id","created_at");

CREATE INDEX IF NOT EXISTS "company_skill_promotion_requests_candidate_idx"
  ON "company_skill_promotion_requests" USING btree ("candidate_id","created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_skill_promotion_requests_status_chk'
  ) THEN
    ALTER TABLE "company_skill_promotion_requests"
      ADD CONSTRAINT "company_skill_promotion_requests_status_chk"
      CHECK ("status" IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "plugin_rollouts_active_plugin_uq"
  ON "plugin_rollouts" USING btree ("plugin_id")
  WHERE "status" IN ('pending_approval', 'approved', 'executing');
