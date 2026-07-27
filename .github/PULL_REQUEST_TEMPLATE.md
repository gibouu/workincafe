<!--
WorkinCafe PR template. Fill every section honestly; it encodes the definition
of done (AGENTS.md, CONTRIBUTING.md). Delete guidance comments as you go.
-->

## What and why

<!-- One or two sentences. Link the decision/issue this implements. -->

Implements / refs: <!-- e.g. Refs #NN, decision docs/decisions/source/07-application-architecture.md -->

## Reconstruction phase

<!-- Which step (see docs/RECONSTRUCTION.md): e.g. Step 2A, Step 4 slice 3. -->

## Approval & scope

- [ ] This change stays within an already-approved plan and architecture, **or**
      a technical-lead-approved plan is linked above.
- [ ] It does **not** build anything on the do-not-build list in
      `docs/product-scope.md` (if it does, link the approved scope decision).
- [ ] It does **not** silently broaden scope, module boundaries, or provider use.

## Dependencies

- [ ] No dependencies added/removed/major-upgraded, **or** each change is listed
      in `docs/approved-dependencies.json` with an installable status and links
      an approved _Dependency request_.
- [ ] No foreign lockfiles (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`).

## Compliance-bearing behavior (if this touches Google/persistence/auth)

<!-- Delete this section if not applicable. -->

- [ ] Of Google-returned data, only Place IDs cross the persistence boundary.
- [ ] Google content is display-only, attributed, not cached/persisted; server
      Google fetches use `no-store`.
- [ ] No automatic publication/closure/deletion/merge of cafés.
- [ ] Relevant obligations in `docs/testing/obligations.md` are covered.

## Provenance (port PRs only)

<!-- If reusing legacy code from the snapshot tag, cite it: -->
<!-- ported from archive/pre-reconstruction-2026-07-21:<path> — adapted: <what changed> -->

## Definition of done

- [ ] `bash tools/governance-check.sh` passes.
- [ ] Verification appropriate to this phase passes (Step 2B+: `npm run verify`).
- [ ] Owned doc tables updated if a table this PR changes lives in them.
- [ ] Legacy application tree not extended (reconstruction rule).
