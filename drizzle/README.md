# `drizzle`

Committed SQL migrations (generated + custom), applied in journal order.

`0000_baseline.sql` is the Step 3B database baseline: Drizzle-generated DDL for
all tables/constraints/indexes, then a custom-SQL section for objects the Drizzle
DSL cannot model (the PostGIS extension, the generated `geography(Point,4326)`
column, GiST indexes, append-only triggers, the cross-table current-attribute
constraint trigger). That custom section is **not** in `meta/0000_snapshot.json`
(Decision 6: an empty regeneration diff never proves database equivalence); it is
part of the same ordered chain, reproducible from empty, and never silently
removed. After it applies to the canonical database the chain **freezes** —
correct forward with new migrations. `drizzle-kit push` is prohibited. `meta/`
and `*.sql` are generator-owned and excluded from Prettier.

Workflow: edit `lib/db/schema` → `npm run db:generate` (no DB URL) → review SQL →
`npm run db:migrate` (requires `DATABASE_URL_DIRECT`).
