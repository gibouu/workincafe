CREATE TABLE "provider_call_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"context" text NOT NULL,
	"candidate_id" uuid,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"http_status" integer
);
--> statement-breakpoint
ALTER TABLE "provider_call_attempts" ADD CONSTRAINT "provider_call_attempts_candidate_id_gp1_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."gp1_candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- ============================================================================
-- Custom SQL — Decision 27 accounting: billable-call attempts are immutable
-- history (same wc_reject_mutation() trigger as the other append-only tables).
-- ============================================================================
CREATE TRIGGER provider_call_attempts_append_only
  BEFORE UPDATE OR DELETE ON "provider_call_attempts"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();
