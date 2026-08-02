CREATE TABLE "assist_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"suggested_decision" text NOT NULL,
	"suggested_reason_code" text,
	"confidence" text NOT NULL,
	"rubric_version" integer NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assist_predictions_decision_valid" CHECK ("assist_predictions"."suggested_decision" IN ('approved', 'rejected', 'deferred')),
	CONSTRAINT "assist_predictions_reason_valid" CHECK ("assist_predictions"."suggested_reason_code" IS NULL OR "assist_predictions"."suggested_reason_code" IN ('not_a_cafe', 'chain', 'takeout_only_no_seating', 'not_study_suitable', 'permanently_closed', 'duplicate', 'outside_service_area', 'insufficient_evidence', 'other')),
	CONSTRAINT "assist_predictions_confidence_valid" CHECK ("assist_predictions"."confidence" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
ALTER TABLE "candidate_decisions" ADD COLUMN "assisted_by_prediction_id" uuid;--> statement-breakpoint
ALTER TABLE "assist_predictions" ADD CONSTRAINT "assist_predictions_candidate_id_gp1_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."gp1_candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assist_predictions_candidate_idx" ON "assist_predictions" USING btree ("candidate_id","created_at");--> statement-breakpoint
ALTER TABLE "candidate_decisions" ADD CONSTRAINT "candidate_decisions_assisted_by_prediction_id_assist_predictions_id_fk" FOREIGN KEY ("assisted_by_prediction_id") REFERENCES "public"."assist_predictions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ============================================================================
-- Custom SQL — Decision 27d: stored predictions are immutable history.
-- ============================================================================
CREATE TRIGGER assist_predictions_append_only
  BEFORE UPDATE OR DELETE ON "assist_predictions"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();
