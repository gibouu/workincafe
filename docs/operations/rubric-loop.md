# Rubric loop — the standing procedure

The curation rubric (reject-reason definitions + the assist system prompt in
`lib/domain/assist.ts`) is a **living document that changes only through this
loop** — never silently, never by the model itself. Dynamic by cadence,
deliberate by change: every revision is a reviewed PR, stamps a new
`RUBRIC_VERSION`, and becomes measurable through the per-version agreement
rate on the GP-1 label-capture panel.

## The trigger (mechanical — no one has to remember)

The GP-1 page computes it from `rubricLoopStatus()` and shows it at all times:

- **First distillation** is due when the baseline batch completes
  (`RUBRIC_BASELINE_TARGET` = 20 final decisions, reviewed WITHOUT the
  pre-read).
- **Every subsequent distillation** is due `RUBRIC_DISTILLATION_INTERVAL`
  (= 15) final decisions after the last one.
- When due, the panel shows a red banner until a distillation PR merges.

## What a distillation is (run with the coding agent, ~one session)

Input: all decision rows since the last distillation — reason codes, the
operator's own-words notes, baseline/assisted flags, and (for assisted
decisions) agreement/disagreement with the stored prediction. Google content
is never an input — the notes are the operator's authored judgment.

Output: **one PR** containing some or all of:

1. Sharpened or new reject-reason operational definitions (new codes need a
   forward migration for the DB CHECK — normal change control).
2. A rewritten signal list / assist system prompt derived from the evidence
   the operator actually cited.
3. Few-shot examples: curated real note+decision pairs embedded in the prompt.
4. Deterministic-rules updates (operator-authored chain list, service-area,
   duplicate-proximity checks) once the rules tier exists.
5. Mandatory bookkeeping: bump `RUBRIC_VERSION`, set
   `RUBRIC_LAST_DISTILLED_AT_DECISIONS` to the current final-decision count.

The operator reviews and merges the PR — that merge IS the rubric revision.

## Reading the results

Predictions are stamped with the rubric version that produced them, so after
each revision the label-capture panel's agreement rate reflects the new
version's performance. Rising agreement across versions = the rubric is
converging on the operator's actual judgment; falling = revert or revise (the
append-only history makes every version's record permanent).

## Ground rules

- Never edit the rubric outside a distillation PR; never edit it mid-baseline.
  **One carve-out:** pre-use hotfixes are permitted while ZERO predictions
  exist under the current rubric version (nothing measured means nothing
  corrupted) — as a normal reviewed PR that says so explicitly.
- `assist_predictions` / `candidate_decisions` are append-only — history
  cannot be rewritten to flatter a revision.
- The baseline batch is sacred: rubric changes never touch unassisted
  decisions (no model was involved), so the baseline remains a stable anchor.
