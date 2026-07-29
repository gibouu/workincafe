CREATE TABLE "candidate_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"candidate_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reason_code" text,
	"note" text,
	"matched_gers_id" text,
	"decided_by_operator_user_id" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"features" jsonb NOT NULL,
	"feature_set_version" integer NOT NULL,
	CONSTRAINT "candidate_decisions_valid" CHECK ("candidate_decisions"."decision" IN ('approved', 'rejected', 'deferred')),
	CONSTRAINT "candidate_decisions_reason_matches_decision" CHECK (("candidate_decisions"."decision" = 'rejected') = ("candidate_decisions"."reason_code" IS NOT NULL)),
	CONSTRAINT "candidate_decisions_reason_valid" CHECK ("candidate_decisions"."reason_code" IS NULL OR "candidate_decisions"."reason_code" IN ('not_a_cafe', 'chain', 'takeout_only_no_seating', 'not_study_suitable', 'permanently_closed', 'duplicate', 'outside_service_area', 'insufficient_evidence', 'other')),
	CONSTRAINT "candidate_decisions_features_object" CHECK (jsonb_typeof("candidate_decisions"."features") = 'object'),
	CONSTRAINT "candidate_decisions_features_bounded" CHECK (pg_column_size("candidate_decisions"."features") <= 8192)
);
--> statement-breakpoint
CREATE TABLE "gp1_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_place_id" text NOT NULL,
	"seeding_run_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_place_id" uuid,
	CONSTRAINT "gp1_candidates_status_valid" CHECK ("gp1_candidates"."status" IN ('pending', 'approved', 'rejected', 'deferred')),
	CONSTRAINT "gp1_candidates_place_id_bounded" CHECK (length("gp1_candidates"."google_place_id") BETWEEN 1 AND 255),
	CONSTRAINT "gp1_candidates_created_place_requires_approved" CHECK ("gp1_candidates"."created_place_id" IS NULL OR "gp1_candidates"."status" = 'approved')
);
--> statement-breakpoint
CREATE TABLE "seeding_run_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"http_status" integer,
	"results_count" integer
);
--> statement-breakpoint
CREATE TABLE "seeding_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initiated_by_operator_user_id" text NOT NULL,
	"query_template_id" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"results_count" integer,
	CONSTRAINT "seeding_runs_status_valid" CHECK ("seeding_runs"."status" IN ('running', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "candidate_decisions" ADD CONSTRAINT "candidate_decisions_candidate_id_gp1_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."gp1_candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_decisions" ADD CONSTRAINT "candidate_decisions_decided_by_operator_user_id_user_id_fk" FOREIGN KEY ("decided_by_operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gp1_candidates" ADD CONSTRAINT "gp1_candidates_seeding_run_id_seeding_runs_id_fk" FOREIGN KEY ("seeding_run_id") REFERENCES "public"."seeding_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gp1_candidates" ADD CONSTRAINT "gp1_candidates_created_place_id_places_id_fk" FOREIGN KEY ("created_place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seeding_run_attempts" ADD CONSTRAINT "seeding_run_attempts_run_id_seeding_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."seeding_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seeding_runs" ADD CONSTRAINT "seeding_runs_initiated_by_operator_user_id_user_id_fk" FOREIGN KEY ("initiated_by_operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_decisions_seq_key" ON "candidate_decisions" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "candidate_decisions_candidate_idx" ON "candidate_decisions" USING btree ("candidate_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "gp1_candidates_google_place_id_key" ON "gp1_candidates" USING btree ("google_place_id");--> statement-breakpoint
CREATE INDEX "gp1_candidates_status_entered_idx" ON "gp1_candidates" USING btree ("status","entered_at");--> statement-breakpoint
-- ============================================================================
-- Custom SQL (not expressible in the Drizzle DSL) — slice 2 pt.2.
-- Append-only enforcement: candidate review decisions and billable-call
-- accounting are immutable history (same wc_reject_mutation() trigger function
-- as the baseline evidence tables).
-- ============================================================================
CREATE TRIGGER candidate_decisions_append_only
  BEFORE UPDATE OR DELETE ON "candidate_decisions"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();--> statement-breakpoint
CREATE TRIGGER seeding_run_attempts_append_only
  BEFORE UPDATE OR DELETE ON "seeding_run_attempts"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();
