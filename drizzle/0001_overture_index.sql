CREATE TABLE "overture_places" (
	"gers_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"primary_category" text,
	"alternate_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"address" text,
	"website" text,
	"phone" text,
	"confidence" double precision,
	"source_version" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overture_places_latitude_range" CHECK ("overture_places"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "overture_places_longitude_range" CHECK ("overture_places"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "overture_places_confidence_range" CHECK ("overture_places"."confidence" IS NULL OR ("overture_places"."confidence" BETWEEN 0 AND 1)),
	CONSTRAINT "overture_places_alternate_categories_array" CHECK (jsonb_typeof("overture_places"."alternate_categories") = 'array'),
	CONSTRAINT "overture_places_alternate_categories_bounded" CHECK (pg_column_size("overture_places"."alternate_categories") <= 4096)
);
--> statement-breakpoint
-- ============================================================================
-- Custom SQL (not expressible in the Drizzle DSL) — slice 2 pt.1.
-- Location: database-generated geography(Point,4326) from lng/lat, mirroring
-- `places.geog` (baseline). GENERATED means it can never be written
-- independently, so lat/lng/geog cannot drift. GiST index for proximity
-- suggestions during human-confirmed matching.
-- ============================================================================
ALTER TABLE "overture_places" ADD COLUMN "geog" geography(Point,4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED;--> statement-breakpoint
CREATE INDEX "overture_places_geog_gist" ON "overture_places" USING gist ("geog");
