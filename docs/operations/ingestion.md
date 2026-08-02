# Ingestion runbook — Overture matching index + service area

Operator-run repository CLIs (Decision 19b): explicit execution on a documented
~monthly cadence (personal calendar reminder), never scheduled, never in the
request path. Scripts produce staging/matching data only — never candidates,
publications, merges, closures, or deletions. All external input is validated;
runs are idempotent and support `--dry-run`.

Both commands need a direct database URL in the environment
(`DATABASE_URL_DIRECT`, or the Neon alias `DATABASE_URL_UNPOOLED`) — for
production, pull it the same way as the operator-bootstrap flow
(`docs/operations/deploy.md`).

## Overture matching index (`overture_places`)

The index is internal staging for human-confirmed matching (Decision 9):
Overture is the enrichment/identity source, never the relevance or membership
source; an Overture record alone never becomes a candidate.

### 1. Produce the extract (external tooling, outside the repo)

Approved acquisition approach (technical-lead ruling, 2026-07-29): the extract
is produced by an external tool on the operator's machine into a local
GeoJSONSeq file (one GeoJSON Feature per line); no ingestion dependency lives
in the repository. Record the Overture release you used — it becomes
`--source-version`.

With the official Overture CLI (installed on this machine in a dedicated venv:
`~/.venvs/overturemaps/bin/overturemaps`; fresh setup alternative:
`pipx install overturemaps`):

```bash
overturemaps download \
  --bbox=-79.6393,43.5810,-79.1156,43.8555 \
  -f geojsonseq --type=place \
  -o /tmp/overture-toronto-places.geojsonseq
```

The bbox above covers the City of Toronto; the file contains all Overture
places in that box (~50–100k rows — fine for the index; the loader validates
every line and the matching UI filters by name/proximity, so no category
pre-filtering is required or wanted: venues are often miscategorized and the
operator search should still find them).

### 2. Load it

```bash
npm run ingest:overture -- \
  --file /tmp/overture-toronto-places.geojsonseq \
  --source-version 2026-06.0 --dry-run   # parse + counts only, no writes
npm run ingest:overture -- \
  --file /tmp/overture-toronto-places.geojsonseq \
  --source-version 2026-06.0
```

Semantics: upsert by GERS id (re-imports update in place, never duplicate);
rows are **never deleted** by a refresh — records absent from the newest
extract keep their old `source_version`, which is how stale rows are
identified. A fail-fast advisory job lock prevents concurrent runs. Malformed
lines are skipped with counted reasons, never crash the run.

Verify after a load:

```sql
SELECT source_version, count(*) FROM overture_places GROUP BY 1 ORDER BY 1;
```

## Service area (`service_areas` — Toronto launch boundary)

Source: City of Toronto Open Data "Regional Municipal Boundary" GeoJSON
(city-owned data; persistable). Download the current boundary export from the
Toronto Open Data portal and note the dataset's last-refreshed date as
`--source-version`.

```bash
npm run import:service-area -- \
  --file /tmp/toronto-boundary.geojson --source-version 2026-07 --dry-run
npm run import:service-area -- \
  --file /tmp/toronto-boundary.geojson --source-version 2026-07
```

Upsert by `--code` (default `toronto`); accepts a bare (Multi)Polygon, a
Feature, or a FeatureCollection (first feature wins); PostGIS validates the
geometry (`ST_IsValid`, non-empty) before any write.

Verify:

```sql
SELECT code, name, source_version, active,
       ST_Contains(geometry, ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326)) AS contains_downtown
FROM service_areas;
```
