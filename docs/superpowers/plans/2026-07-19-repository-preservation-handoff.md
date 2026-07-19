# Repository Preservation and GitHub Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve completed WorkinCafe work on GitHub and leave a durable, issue-backed continuation record without starting product work or destroying ambiguous local state.

**Architecture:** Treat `MEMORY.md` and onboarding issue #311 as the human/agent entry point, existing product issues as the authoritative work inventory, and issue #312 as the preservation boundary for historical local-only Git objects. Publish only understood branches after verification and secret review; leave unverified work in draft PRs with explicit blockers.

**Tech Stack:** Git, GitHub CLI, Markdown, Next.js validation commands, Xcode/XCTest scripts where the host environment permits.

## Global Constraints

- Do not reset, clean, rebase, amend, force-push, delete branches/worktrees/stashes, expire reflogs, or run aggressive garbage collection.
- Do not publish secrets, credentials, personal data, generated bulk artifacts, `.env*`, App Store keys, archives, IPA files, DerivedData, `.xcresult`, or Xcode `xcuserdata`.
- Do not mark Task 6 or issue #309 complete until post-`a8fd2e9` Simulator verification and cumulative independent review pass.
- Do not start Task 7, TestFlight, App Store, or production release work.
- Every authored commit and PR body ends with `— gib` on its own line.

---

### Task 1: Capture the non-destructive repository safety baseline

**Files:**
- Create: `MEMORY.md`
- Reference: `AGENTS.md`
- Reference: `.superpowers/sdd/task-6-report.md` (ignored local evidence)

**Interfaces:**
- Consumes: local Git refs/worktrees/stashes, GitHub branch/issue/PR state, plans, reports, and test artifacts.
- Produces: a verified safety snapshot and issue-backed preservation boundary.

- [x] **Step 1: Record branch and remote state**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git remote get-url origin
git rev-list --left-right --count origin/main...HEAD
```

Expected: active Task 6 checkout is clean at `a8fd2e9`, 20 commits ahead and 0 behind `main`, initially without an upstream.

- [x] **Step 2: Preserve worktree and stash evidence**

Run:

```bash
git worktree list --porcelain
git stash list
git branch -vv --no-abbrev
```

Expected: no mutation; ambiguous historical state is captured by #312.

### Task 2: Establish durable GitHub issue coverage

**Files:**
- Create: `MEMORY.md`

**Interfaces:**
- Consumes: open/closed issues, PRs, labels, and documented dependencies.
- Produces: onboarding issue #311, preservation issue #312, and updated existing issue metadata.

- [x] **Step 1: Create the onboarding issue first**

Run:

```bash
gh issue create --title "Project continuation guide — read MEMORY.md before starting" --body-file /private/tmp/workincafe-onboarding-issue.md
```

Expected: issue #311.

- [x] **Step 2: Reuse existing product issues and create only the missing preservation issue**

Expected mapping: #298 umbrella, #300 web performance, #301 API/auth, #303 native authenticated/device flows, #304 release safety, #305 delivery, #309 antimeridian/release gate, #310 native product rebuild, #311 onboarding, #312 Git archaeology.

### Task 3: Write and validate durable repository documentation

**Files:**
- Create: `MEMORY.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-19-native-workincafe-product-rebuild-design.md`
- Create: `docs/superpowers/plans/2026-07-19-repository-preservation-handoff.md`

**Interfaces:**
- Consumes: Tasks 1–2 evidence.
- Produces: a coherent future-contributor entry point and durable maintenance rule.

- [x] **Step 1: Write every required `MEMORY.md` section**

Verify:

```bash
rg '^## ' MEMORY.md
rg '#(298|300|301|303|304|305|309|310|311|312)' MEMORY.md
```

Expected: all required sections and issue mappings exist.

- [x] **Step 2: Add the concise AGENTS handoff rule and README entry point**

Expected: contributors are required to read/update `MEMORY.md`, work on scoped branches, record verification, and leave recoverable state.

- [x] **Step 3: Remove range-diff whitespace errors**

Run:

```bash
git diff --check
git diff --cached --check
```

Expected: no output from either working-tree/index check before commit.

- [x] **Step 4: Commit the reviewed documentation before publication**

Stage only the five documented Task 3 files, inspect the staged diff, and commit with the required `— gib` signature. Then run:

```bash
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: range diff has no whitespace errors and the active checkout is clean before any push.

### Task 4: Validate and publish understood active branches

**Files:**
- Verify only: `feat/310-native-product-rebuild`
- Verify only: `feat/300-web-performance-cleanup`

**Interfaces:**
- Consumes: clean committed branches and their focused verification evidence.
- Produces: remote branches and draft PRs linked to #310 and #300.

- [x] **Step 1: Validate the web-performance Task 1 branch**

Run in its worktree:

```bash
npm test -- tests/bundle-stats.test.ts
npm run lint
npm run typecheck
npm run build
npm run bundle:report
npm run bundle:check
git diff --check origin/main...HEAD
```

Expected: record exact results. If the documented baseline variance remains, preserve it in the draft PR and do not merge.

- [x] **Step 2: Secret-scan branch ranges and documentation**

Run repository-available secret scanning plus targeted searches for private-key headers and credential assignments. Expected: no secret values in commits to publish.

- [x] **Step 3: Push without force and open draft PRs**

Expected: current branch references #310/#309; web-performance branch references #300. Neither is merged while its documented gate remains open.

### Task 5: Finalize synchronization and handoff evidence

**Files:**
- Modify: `MEMORY.md`

**Interfaces:**
- Consumes: published branch/PR URLs and final GitHub state.
- Produces: a clean, remotely recoverable handoff and final report.

- [x] **Step 1: Update issue comments and `MEMORY.md` with actual remote SHAs/PRs**

Commit this synchronization update separately with the required `— gib` signature and push it without force so the durable record itself is remotely recoverable.

- [x] **Step 2: Review open PRs without merging unsafe work**

Expected: PR #295 remains open pending update/review decision; PR #297 remains open with failed verification documented; draft preservation PRs remain open until their gates pass.

- [x] **Step 3: Run final documentation and repository checks**

Run:

```bash
git diff --check origin/main...HEAD
git status --short --branch
git rev-parse HEAD
git ls-remote --heads origin feat/310-native-product-rebuild feat/300-web-performance-cleanup main
gh pr list --state open --limit 100
gh issue view 311
gh issue view 312
```

Expected: documentation is coherent, relevant branches exist remotely, PR/issue links resolve, and the active checkout is clean.

Final result: XcodeGen check, range diff check, both worktree status checks, exact remote SHA verification, issue/PR linkage, and GitHub state inspection passed. Draft PR checks were recorded at their observed state; Simulator-dependent Task 6 verification remains explicitly blocked rather than skipped or claimed green.

## Self-review

- Spec coverage: safety snapshot, durable memory, onboarding-first issue, complete issue inventory, active branch publication, PR triage, validation, and final reporting are represented.
- Placeholder scan: no deferred placeholder instructions are present; blocked commands have explicit expected handling.
- Type consistency: branch, issue, and command names match the repository inventory taken on 2026-07-19.
