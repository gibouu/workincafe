CREATE TABLE "attribute_observation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"observation_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"decided_by_operator_user_id" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "attribute_observation_decisions_valid" CHECK ("attribute_observation_decisions"."decision" IN ('accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "attribute_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"provenance_kind" text NOT NULL,
	"source_ref_id" uuid,
	"observed_by_operator_user_id" text,
	"confidence" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "attribute_observations_kind_value_matrix" CHECK (("attribute_observations"."kind" = 'wifi' AND "attribute_observations"."value" IN ('unknown', 'none', 'unreliable', 'usable', 'fast')) OR ("attribute_observations"."kind" = 'power' AND "attribute_observations"."value" IN ('unknown', 'none', 'limited', 'available', 'abundant')) OR ("attribute_observations"."kind" = 'noise' AND "attribute_observations"."value" IN ('unknown', 'very_quiet', 'quiet', 'moderate', 'lively')) OR ("attribute_observations"."kind" = 'seating' AND "attribute_observations"."value" IN ('unknown', 'none', 'limited', 'adequate', 'ample'))),
	CONSTRAINT "attribute_observations_provenance_valid" CHECK ("attribute_observations"."provenance_kind" IN ('imported', 'curator', 'measurement')),
	CONSTRAINT "attribute_observations_confidence_valid" CHECK ("attribute_observations"."confidence" IN ('low', 'medium', 'high')),
	CONSTRAINT "attribute_observations_imported_requires_source" CHECK ("attribute_observations"."provenance_kind" <> 'imported' OR "attribute_observations"."source_ref_id" IS NOT NULL),
	CONSTRAINT "attribute_observations_attended_requires_operator" CHECK ("attribute_observations"."provenance_kind" = 'imported' OR "attribute_observations"."observed_by_operator_user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "place_attribute_current" (
	"place_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"current_observation_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_attribute_current_place_id_kind_pk" PRIMARY KEY("place_id","kind"),
	CONSTRAINT "place_attribute_current_kind_valid" CHECK ("place_attribute_current"."kind" IN ('wifi', 'power', 'noise', 'seating'))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"place_id" uuid,
	"actor_kind" text NOT NULL,
	"actor_user_id" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text,
	"details" jsonb,
	CONSTRAINT "curation_events_type_valid" CHECK ("curation_events"."event_type" IN ('place_created', 'place_published', 'place_hidden', 'place_closed', 'place_marked_duplicate', 'attribute_promoted', 'attribute_conflict_detected', 'hours_updated')),
	CONSTRAINT "curation_events_actor_kind_valid" CHECK ("curation_events"."actor_kind" IN ('operator', 'system', 'script')),
	CONSTRAINT "curation_events_operator_has_user" CHECK (NOT ("curation_events"."actor_kind" = 'operator' AND "curation_events"."actor_user_id" IS NULL)),
	CONSTRAINT "curation_events_details_bounded" CHECK ("curation_events"."details" IS NULL OR pg_column_size("curation_events"."details") <= 4096)
);
--> statement-breakpoint
CREATE TABLE "place_hours" (
	"place_id" uuid PRIMARY KEY NOT NULL,
	"schedule" jsonb NOT NULL,
	"provenance_kind" text NOT NULL,
	"source_ref_id" uuid,
	"observed_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_operator_user_id" text,
	"confidence" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_hours_provenance_valid" CHECK ("place_hours"."provenance_kind" IN ('imported', 'curator', 'measurement')),
	CONSTRAINT "place_hours_confidence_valid" CHECK ("place_hours"."confidence" IN ('low', 'medium', 'high')),
	CONSTRAINT "place_hours_schedule_object" CHECK (jsonb_typeof("place_hours"."schedule") = 'object'),
	CONSTRAINT "place_hours_schedule_version" CHECK ("place_hours"."schedule" ->> 'version' = '1'),
	CONSTRAINT "place_hours_schedule_shape" CHECK ("place_hours"."schedule" -> 'days' IS NOT NULL AND "place_hours"."schedule" ->> 'timeZone' IS NOT NULL),
	CONSTRAINT "place_hours_schedule_bounded" CHECK (pg_column_size("place_hours"."schedule") <= 8192),
	CONSTRAINT "place_hours_imported_requires_source" CHECK ("place_hours"."provenance_kind" <> 'imported' OR "place_hours"."source_ref_id" IS NOT NULL),
	CONSTRAINT "place_hours_attended_requires_operator" CHECK ("place_hours"."provenance_kind" = 'imported' OR "place_hours"."verified_by_operator_user_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"user_id" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"neighborhood" text,
	"website" text,
	"phone" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"publication_state" text DEFAULT 'draft' NOT NULL,
	"record_state" text DEFAULT 'active' NOT NULL,
	"duplicate_of_place_id" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_latitude_range" CHECK ("places"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "places_longitude_range" CHECK ("places"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "places_slug_format" CHECK ("places"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("places"."slug") <= 96),
	CONSTRAINT "places_published_requires_active" CHECK (NOT ("places"."publication_state" = 'published' AND "places"."record_state" <> 'active')),
	CONSTRAINT "places_duplicate_ref_matches_state" CHECK (("places"."record_state" = 'duplicate') = ("places"."duplicate_of_place_id" IS NOT NULL)),
	CONSTRAINT "places_no_self_duplicate" CHECK ("places"."duplicate_of_place_id" IS NULL OR "places"."duplicate_of_place_id" <> "places"."id"),
	CONSTRAINT "places_closed_at_matches_state" CHECK (("places"."record_state" = 'closed') = ("places"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"source" text,
	"source_version" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "service_areas_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "place_source_refs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_source_refs_source_external_key" UNIQUE("source","external_id"),
	CONSTRAINT "place_source_refs_place_source_external_key" UNIQUE("place_id","source","external_id"),
	CONSTRAINT "place_source_refs_source_valid" CHECK ("place_source_refs"."source" IN ('google_places', 'overture', 'toronto_open_data', 'dinesafe', 'official_website')),
	CONSTRAINT "place_source_refs_external_id_bounded" CHECK (length("place_source_refs"."external_id") BETWEEN 1 AND 255)
);
--> statement-breakpoint
ALTER TABLE "attribute_observation_decisions" ADD CONSTRAINT "attribute_observation_decisions_observation_id_attribute_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."attribute_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_observation_decisions" ADD CONSTRAINT "attribute_observation_decisions_decided_by_operator_user_id_user_id_fk" FOREIGN KEY ("decided_by_operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_observations" ADD CONSTRAINT "attribute_observations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_observations" ADD CONSTRAINT "attribute_observations_source_ref_id_place_source_refs_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."place_source_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_observations" ADD CONSTRAINT "attribute_observations_observed_by_operator_user_id_user_id_fk" FOREIGN KEY ("observed_by_operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_attribute_current" ADD CONSTRAINT "place_attribute_current_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_attribute_current" ADD CONSTRAINT "place_attribute_current_current_observation_id_attribute_observations_id_fk" FOREIGN KEY ("current_observation_id") REFERENCES "public"."attribute_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_events" ADD CONSTRAINT "curation_events_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_events" ADD CONSTRAINT "curation_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours" ADD CONSTRAINT "place_hours_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours" ADD CONSTRAINT "place_hours_source_ref_id_place_source_refs_id_fk" FOREIGN KEY ("source_ref_id") REFERENCES "public"."place_source_refs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hours" ADD CONSTRAINT "place_hours_verified_by_operator_user_id_user_id_fk" FOREIGN KEY ("verified_by_operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_duplicate_of_place_id_places_id_fk" FOREIGN KEY ("duplicate_of_place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_source_refs" ADD CONSTRAINT "place_source_refs_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_observation_decisions_seq_key" ON "attribute_observation_decisions" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "attribute_observation_decisions_obs_idx" ON "attribute_observation_decisions" USING btree ("observation_id","seq");--> statement-breakpoint
CREATE INDEX "attribute_observations_place_kind_idx" ON "attribute_observations" USING btree ("place_id","kind");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "curation_events_place_idx" ON "curation_events" USING btree ("place_id","occurred_at");--> statement-breakpoint
CREATE INDEX "curation_events_type_idx" ON "curation_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_key" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_publication_state_idx" ON "places" USING btree ("publication_state");--> statement-breakpoint
CREATE INDEX "places_record_state_idx" ON "places" USING btree ("record_state");--> statement-breakpoint
-- ============================================================================
-- WorkinCafe custom SQL (Step 3B). Objects Drizzle's DSL cannot represent:
-- the PostGIS extension, generated/typed spatial columns, spatial indexes,
-- append-only triggers, and the DEFERRED bidirectional current-attribute
-- invariant. Not reflected in meta/0000_snapshot.json (Decision 6). Part of the
-- same ordered baseline, reproducible from empty, never silently removed. All
-- prior statements create only plain columns, so the extension is created here
-- (before the spatial columns are added) without reordering.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
-- Location (amendment C): database-generated geography(Point,4326) from lng/lat.
-- Proven immutable + STORED in PostgreSQL 17.5 / PostGIS 3.5.2; because geog is
-- GENERATED it can never be written independently, so lat/lng/geog cannot drift.
ALTER TABLE "places" ADD COLUMN "geog" geography(Point,4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED;--> statement-breakpoint
CREATE INDEX "places_geog_gist" ON "places" USING gist ("geog");--> statement-breakpoint
-- Service-area geometry (amendment D). NOT NULL is safe: the table is empty in
-- the baseline; the authoritative Toronto polygon loads via a reviewed command.
ALTER TABLE "service_areas" ADD COLUMN "geometry" geometry(MultiPolygon,4326) NOT NULL;--> statement-breakpoint
CREATE INDEX "service_areas_geometry_gist" ON "service_areas" USING gist ("geometry");--> statement-breakpoint
-- Append-only enforcement (ruling 2): evidence/history tables reject UPDATE and
-- DELETE at the database. Restrictive FKs already prevent cascade-delete.
CREATE FUNCTION wc_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only: % on % is not permitted', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "attribute_observations_append_only"
  BEFORE UPDATE OR DELETE ON "attribute_observations"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();--> statement-breakpoint
CREATE TRIGGER "attribute_observation_decisions_append_only"
  BEFORE UPDATE OR DELETE ON "attribute_observation_decisions"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();--> statement-breakpoint
CREATE TRIGGER "curation_events_append_only"
  BEFORE UPDATE OR DELETE ON "curation_events"
  FOR EACH ROW EXECUTE FUNCTION wc_reject_mutation();--> statement-breakpoint
-- Current-pointer invariant (ruling 2 + strict-gate amendment). The current
-- observation must belong to the same place, the same kind, and have a latest
-- effective decision of 'accepted' — ordered SOLELY by the monotonic decision
-- `seq` (not decided_at). Validation is DEFERRED and runs from BOTH directions,
-- against the FINAL transaction state:
--   • when place_attribute_current changes (repoint), and
--   • when a new decision is appended for an observation.
-- So a later rejection cannot leave a rejected observation current, yet
-- rejection + valid repointing in the same transaction succeeds.
CREATE FUNCTION wc_validate_current_pointer(p_place uuid, p_kind text)
  RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  cur       uuid;
  obs_place uuid;
  obs_kind  text;
  latest    text;
BEGIN
  SELECT current_observation_id INTO cur
  FROM place_attribute_current WHERE place_id = p_place AND kind = p_kind;

  IF cur IS NULL THEN
    RETURN; -- no current pointer for this (place, kind); nothing to validate
  END IF;

  SELECT o.place_id, o.kind INTO obs_place, obs_kind
  FROM attribute_observations o WHERE o.id = cur;

  IF obs_place IS NULL THEN
    RAISE EXCEPTION 'current observation % does not exist', cur
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF obs_place <> p_place THEN
    RAISE EXCEPTION 'current observation % belongs to a different place', cur
      USING ERRCODE = 'check_violation';
  END IF;
  IF obs_kind <> p_kind THEN
    RAISE EXCEPTION 'current observation % is a different attribute kind', cur
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT d.decision INTO latest
  FROM attribute_observation_decisions d
  WHERE d.observation_id = cur
  ORDER BY d.seq DESC
  LIMIT 1;

  IF latest IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'current observation % is not accepted (latest decision: %)',
      cur, COALESCE(latest, 'none') USING ERRCODE = 'check_violation';
  END IF;
END;
$$;--> statement-breakpoint
CREATE FUNCTION wc_current_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM wc_validate_current_pointer(NEW.place_id, NEW.kind);
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE FUNCTION wc_decision_current_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  o_place uuid;
  o_kind  text;
BEGIN
  SELECT place_id, kind INTO o_place, o_kind
  FROM attribute_observations WHERE id = NEW.observation_id;
  IF o_place IS NOT NULL THEN
    PERFORM wc_validate_current_pointer(o_place, o_kind);
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "place_attribute_current_valid"
  AFTER INSERT OR UPDATE ON "place_attribute_current"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wc_current_pointer_guard();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "attribute_observation_decisions_current_guard"
  AFTER INSERT ON "attribute_observation_decisions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION wc_decision_current_guard();