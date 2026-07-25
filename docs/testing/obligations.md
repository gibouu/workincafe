# Test-obligation matrix (compliance-bearing coverage)

Scope: security, compliance, persistence and architecture boundaries where
losing coverage would be hard to notice (Decision 22). Obligations are
coverage requirements, not one-test-per-line mandates; one well-designed
test may cover several obligations. Populated as slices land; every row
must have enforcement before the feature it guards ships. TODO(step-N)
entries are allowed skeleton placeholders for features that do not exist
yet.

| Obligation | Source | Tier | Enforcing test/rule | Module | Accepted gap |
|---|---|---|---|---|---|
| Of Google-returned data, only Place IDs cross the approved persistence boundary | GP-1 / 13 | 1 (+2 depth) | TODO(step-4) | ingestion | — |
| Semantic results intersect published records before display | GP-2 / 16 | 1 | TODO(step-4) | application | — |
| Unmatched Google results never exposed | GP-2 | 1 | TODO(step-4) | application | — |
| Exact Place-ID equality before contextual display | GD-2 | 1 | TODO(step-4) | google/server | — |
| Attribution/disclosure survive DTO mapping | 16 / 18 | 1 | TODO(step-4) | google/server | — |
| Semantic ordering & contextual content never persisted/logged | 15 / 16 | 1 | TODO(step-4) | multiple | — |
| Google fetches `no-store`; responses `private, no-store, max-age=0` | 16 / 18 | 1 | TODO(step-4) | google/server, api | — |
| Flag-off paths make no provider request; disabled handlers return approved error | 16 / 18 | 1 | TODO(step-4) | flags/application | — |
| Accounting once per outbound attempt; no automatic billable retry | 16 | 1 | TODO(step-4) | google/server | — |
| Photo identifiers/URIs/bytes never persisted; optimizer bypassed | 16 | 1 | TODO(step-4) | google/server, components | — |
| GP-1 surface mapless (static import assertion) | 13d | 1 | TODO(step-2B) | app/(operator)/gp1 | — |
| Unauthenticated / non-operator blocked from operator actions | 8 | 1 (+2) | TODO(step-4) | auth/application | — |
| Registration by unapproved identity rejected; sessions fail closed | 8 | 2 | TODO(step-4) | auth | — |
| Migration chain builds from empty w/ PostGIS + custom objects | 7 / 22 | 2 | TODO(step-3B) | drizzle | Tier 2 convention-enforced (22 accepted risk) |
| Append-only observations; curation events persist; prohibited Google fields rejected at DB | 3 / 22 | 2 | TODO(step-4) | db | Tier 2 convention-enforced |
| Boundary lint: graph prohibitions, no docs/archive imports, contracts free of server imports | 13 / 24c-G2 | 1 | TODO(step-2B) | eslint config | — |
| Dependency governance: unlisted deps, unsatisfied conditionals, foreign lockfiles rejected | 24d | 1 | TODO(step-2B) | verification script | — |
| Production-URL safety guard fails tests immediately | 22 | 1 | TODO(step-2B) | tests | — |
| No test contacts Google or creates billable traffic | 16 / 22 | harness | TODO(step-2B) | tests | — |
| Error envelopes exclude internals/provider content; codes from closed vocabulary | 18 | 1 | TODO(step-4) | contracts/http | — |
| Client response validation rejects malformed server responses safely | 16 / 18 | 1 | TODO(step-4) | client fetch | — |
| Correlation ID present, propagated to accounting, caller values never trusted blindly | 18 | 1 | TODO(step-4) | api | — |
| Reload of a semantic URL performs a fresh search; no ordering URL parameter exists | 15 / 16 | 1 | TODO(step-4) | client-state | — |
| Active-panel DTO lifetime: reuse while open, discard on close/change/unmount/reload | 16e | 1 | TODO(step-4) | MapExplorer | — |
