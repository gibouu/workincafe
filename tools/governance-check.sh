#!/usr/bin/env bash
# WorkinCafe governance check (Step 2A) — technology-neutral.
#
# Runs today against the reconstruction-in-progress repository (legacy tree
# still present). It validates governance invariants only; it does NOT run the
# application or inspect the legacy package.json. Technology-specific
# enforcement (dependency-allowlist comparison, import boundaries, migrate-from-
# empty, lint/typecheck/tests) arrives with the approved skeleton in Step 2B.
#
# Usage: bash tools/governance-check.sh
set -u
cd "$(dirname "$0")/.."
fail=0
note() { printf '  %s\n' "$1"; }
ok()   { printf 'PASS  %s\n' "$1"; }
bad()  { printf 'FAIL  %s\n' "$1"; fail=1; }

# 1. No foreign lockfiles (npm is the only approved package manager; Decision 2).
foreign=""
for f in pnpm-lock.yaml yarn.lock bun.lock bun.lockb; do
  [ -e "$f" ] && foreign="$foreign $f"
done
if [ -n "$foreign" ]; then bad "foreign lockfile(s) present:$foreign"; else ok "no foreign lockfiles"; fi

# 2. No src/ directory (root-level structure; Decisions 13/24).
if [ -d src ]; then bad "src/ directory exists (root-level structure required)"; else ok "no src/ directory"; fi

# 3. Archived docs are marked non-authoritative (carry the ARCHIVED banner).
if [ -d docs/archive ]; then
  missing=0
  while IFS= read -r f; do
    if ! head -6 "$f" | grep -qi "archived"; then note "missing archived marker: $f"; missing=1; fi
  done < <(find docs/archive -name '*.md' -type f)
  if [ "$missing" -eq 1 ]; then bad "one or more archived docs lack the ARCHIVED banner"; else ok "archived docs carry ARCHIVED banners"; fi
else
  note "docs/archive not present (skipped)"
fi

# 4. Governance documents exist (authority chain intact).
req="AGENTS.md CLAUDE.md CONTRIBUTING.md docs/product-scope.md docs/RECONSTRUCTION.md docs/decisions/README.md docs/decisions/register.md docs/decisions/deferred-register.md docs/approved-dependencies.json docs/testing/obligations.md"
missing=0
for f in $req; do [ -f "$f" ] || { note "missing: $f"; missing=1; }; done
[ -d docs/decisions/source ] && [ "$(find docs/decisions/source -name '*.md' | wc -l | tr -d ' ')" -ge 1 ] || { note "missing docs/decisions/source records"; missing=1; }
if [ "$missing" -eq 1 ]; then bad "governance documents incomplete"; else ok "governance documents present"; fi

# 5. approved-dependencies.json is valid JSON with the required top-level keys.
if [ -f docs/approved-dependencies.json ]; then
  if command -v python3 >/dev/null 2>&1; then
    if python3 - <<'PY' 2>/dev/null
import json,sys
d=json.load(open("docs/approved-dependencies.json"))
assert all(k in d for k in ("statuses","runtime","dev","prohibited_lockfiles"))
PY
    then ok "approved-dependencies.json is valid and well-formed"
    else bad "approved-dependencies.json invalid or missing required keys"; fi
  else note "python3 unavailable; skipped JSON validation"; fi
fi

# 6. Doc-link integrity: repo-relative paths referenced in AGENTS.md exist
#    (anti-staleness guard — the legacy failure mode this reconstruction fixes).
if [ -f AGENTS.md ]; then
  broken=0
  for p in docs/decisions/source docs/decisions/register.md docs/decisions/deferred-register.md \
           docs/architecture.md docs/product-scope.md docs/RECONSTRUCTION.md \
           docs/testing/obligations.md docs/approved-dependencies.json; do
    if grep -q "$p" AGENTS.md && [ ! -e "$p" ]; then note "AGENTS.md references missing path: $p"; broken=1; fi
  done
  if [ "$broken" -eq 1 ]; then bad "AGENTS.md references a missing path"; else ok "AGENTS.md referenced paths exist"; fi
fi

# 7. Migration static check: `drizzle-kit push` / `db:push` are prohibited in
#    every environment (Decision 7). No push script may exist.
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  if node -e 'const s=(JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts)||{}; const bad=Object.entries(s).filter(([k,v])=>k==="db:push"||/drizzle-kit\s+push|\bdb:push\b/.test(String(v))); if(bad.length){console.error(bad.map(b=>b[0]).join(", ")); process.exit(1)}' 2>/dev/null; then
    ok "no drizzle-kit push / db:push scripts"
  else
    bad "prohibited push script present (drizzle-kit push is forbidden everywhere)"
  fi
fi

# 8. No network-exposed dev tooling (Decision 26): no `drizzle-kit studio` /
#    `esbuild ... serve` scripts — the vulnerable esbuild dev-server path is unused.
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  if node -e 'const s=(JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts)||{}; const bad=Object.entries(s).filter(([,v])=>/drizzle-kit\s+studio|esbuild[^\n]*\bserve\b/.test(String(v))); if(bad.length){console.error(bad.map(b=>b[0]).join(", ")); process.exit(1)}' 2>/dev/null; then
    ok "no network-exposed dev tooling scripts (studio/esbuild-serve)"
  else
    bad "prohibited dev-server script present (drizzle-kit studio / esbuild serve — Decision 26)"
  fi
fi

echo
if [ "$fail" -eq 0 ]; then echo "governance-check: OK"; else echo "governance-check: FAILED"; fi
exit "$fail"
