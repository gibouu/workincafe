# Decision 27 — Editorial AI assistance over Google Places content (policy-confirmed)

Status: **DRAFT — awaiting technical-lead ratification** (ratified by the
technical lead merging this record; until merged, nothing here is operative
and the prior stricter rules control).

Date of underlying guidance: 2026-08-02 (Google Maps Platform Support, Policy
and Compliance Team, case reference: _fill in case number_). The full inquiry
and the full response are preserved verbatim in Appendices A and B — they are
this decision's compliance record. Guidance is contingent, workflow-specific,
and does not amend the Google Maps Platform Terms; on conflict, the Terms and
product documentation control.

## Context

The confirmed GP-1 workflow (source/05) was implemented IDs-only end-to-end,
stricter than Google's written terms required. A policy inquiry (Appendix A)
asked seven scoped questions about internal editorial workflows. Google's
Policy and Compliance Team approved all seven for the described
implementation (Appendix B). This record makes that guidance operative inside
WorkinCafe's rules, exactly as scoped — no broader.

## Rulings (operative once ratified)

- **27a — Review-informed editorial notes (Q1).** Operator decision notes may
  incorporate the operator's own aggregate judgment formed from live-viewed
  Google content (details, reviews, photos, AI summaries). Notes must remain
  the operator's original words: no copied or paraphrased review language, no
  rating or review-count values, no identification of particular reviews, not
  reconstructable into the source content, and always presented as
  WorkinCafe's editorial opinion.
- **27b — Session-only AI pre-read (Q2, Q3, Q6).** Live-fetched Places text
  (including reviews and `generativeSummary`/`reviewSummary`) and photo media
  may be sent to an approved no-training model provider for one-time
  inference assisting the reviewing operator. Inputs and outputs are
  session-only; nothing is persisted or auto-published; the operator remains
  the decision-maker. Photo inference must not perform facial recognition,
  biometric identification, or identification of individuals.
- **27c — Model provider (Q4).** Third-party providers are permitted where
  binding terms prohibit training on customer inputs and limit retention to
  service delivery. **Selected provider: Anthropic API** (enterprise/API
  no-training terms), called via hand-written `fetch` (no SDK dependency),
  server-only credential, production-only by default — mirroring the Google
  caller posture. Documentation of the provider's no-training and retention
  terms must be retained with compliance records. Changing provider = new
  ruling under this decision.
- **27d — Durable derived values (Q5).** Non-reconstructable editorial signal
  values may be persisted: internal review-priority scores, signal booleans
  (e.g. `editor_noted_possible_study_suitability`), whether human-, rule-, or
  AI-created (AI-created only via the 27b workflow and independently reviewed
  where used for editorial decisions). Derived values must never allow
  ratings, counts, review text, or summaries to be recovered or reliably
  inferred, and are never presented as Google-provided facts.
- **27e — Session-only queue triage (Q7).** `rating` and `userRatingCount`
  may be fetched live and used transiently to order the operator's review
  queue for a session. Raw values never persist; the resulting order is never
  stored (not even as a proxy); the ordering is internal prioritization only
  and never presented as a Google ranking.
- **27f — Internal display (Q1/Q6 precondition).** The GP-1 review surface
  may display live-fetched place details, reviews, photos, and AI summaries
  to the operator with all required Google and author attribution, reporting
  links, and source links; AI summaries display in full with required
  disclosure. (Supersedes the IDs-only-even-for-display simplification of the
  original GP-1 implementation; the IDs-only _persistence_ boundary is
  unchanged.)

## Unchanged and reinforced prohibitions

- Google Maps Content still never persists beyond Place IDs — in the
  database, durable caches, analytics, error reports, **or logs, now
  explicitly including model prompts/inputs on all paths including error
  paths** (per the guidance's general conditions).
- No training, testing, validation, fine-tuning, **evaluation, or
  benchmarking** of any model using Google Maps Content. Shadow-mode or any
  model evaluation compares only WorkinCafe-stored values (decisions, notes,
  derived values, predictions) — the evaluation harness never touches Google
  content.
- No automated publication; meaningful human review precedes every editorial
  action (unchanged: signals create human review tasks only; human-confirmed
  matching stands).
- Access restricted to authorized operators and contracted processors.
- Material expansion of any 27x workflow requires a new inquiry referencing
  this case, then a new ruling — not a PR.

## Implementation order (each its own slice PR, normal change control)

1. Note-guidance copy update in the decision forms (27a) — small.
2. AI pre-read panel on the GP-1 review page (27b/27c/27f): richer-field
   Places Details caller (Pro/Enterprise SKU fields — verify pricing tier at
   build time), Anthropic inference caller (no-store, no-log, session-only),
   attributed internal display. New env: `ANTHROPIC_API_KEY` (server-only,
   production-only, feature-conditional).
3. Session queue triage (27e).
4. Feature-set v2 + stored predictions (27d) — schema change, full Tier 2.

## Appendix A — Inquiry as sent

> _Verify this matches the letter as actually filed (fill in project number /
> case reference; note any edits made before sending)._

Subject: Policy guidance request — internal editorial workflow uses of Places
API content (human judgment, inference-only AI assistance, derived values)

We operate WorkinCafe (www.workin.cafe), a human-curated directory of study-
and work-friendly cafés in Toronto, under Google Maps Platform project
[PROJECT NUMBER]. Every venue is reviewed and approved by a human editor
before publication. Google Maps Content is not used as the source of any
permanently stored venue fact.

Current implementation: Text Search with an IDs-only field mask
(`places.id`); only Google Place IDs persisted; requests live and uncached;
no other Places response fields persisted; application logging configured not
to capture Places response bodies; no use of Google Maps Content to train,
test, validate, fine-tune, or otherwise improve any machine-learning model.

Seven questions were asked (Q1 human-authored editorial judgment; Q2
transient text inference via LLM; Q3 transient image inference; Q4
third-party model providers; Q5 durable derived values — explicitly scoped to
derived signal values, with editors' approve/reject decisions and structured
reasons identified as WorkinCafe's own editorial records outside the
question; Q6 `generativeSummary`/`reviewSummary`; Q7 transient rating-based
queue ordering), each requesting a permitted / prohibited /
permitted-only-via-specific-product answer. Full letter text retained with
the support case export.

## Appendix B — Response (2026-08-02, Google Maps Platform Support, Policy and Compliance Team)

Verbatim:

Hello Cem,

Thank you for the detailed description of WorkinCafe's proposed internal editorial workflows.

Based on the facts and safeguards described in your request, the workflows outlined in Questions 1 through 7 are approved for your stated implementation under the ordinary Places API terms, subject to the conditions summarized below.

This guidance applies only to the specific workflows and technical controls described in your message. Any material change to the data retained, model-provider terms, publication process, attribution, user access, or degree of automation should be reviewed separately.

**Q1 — Human-authored editorial judgment**

Permitted.

An authorized human editor may review live-displayed Places content and retain an original editorial judgment such as: "The editor believes this venue may be suitable for laptop work." Under the conditions described, the judgment would be treated as WorkinCafe's independent editorial opinion rather than a stored copy, paraphrase, summary, or reconstructable substitute for Google Maps Content. The stored judgment must not reproduce identifiable review language, ratings, review counts, photo content, or other protected Places fields. Independent verification through another source or an in-person visit further supports the independence of the editorial judgment, but it is not required for the limited aggregate opinion described in your request.

**Q2 — Transient text inference using an LLM**

Permitted.

Live-fetched Places text may be provided to an LLM for one-time inference assisting an authorized human editor, provided that: neither WorkinCafe nor the model provider uses the content to train, test, validate, fine-tune, evaluate, or improve a model; the provider's applicable contractual terms prohibit training on customer API inputs; the Places content is processed only for the requested inference; neither the input nor generated output is retained beyond the operationally necessary session; the output is not automatically published or treated as an authoritative Google-derived venue fact; a human editor reviews the result and remains responsible for the decision; and appropriate access, security, deletion, and logging controls remain in place. For the narrowly defined workflow described, Maps Grounding Lite is not required. Maps Grounding Lite may nevertheless be appropriate for other generative-AI use cases that involve persistent grounded outputs, user-facing answers, broader automation, or permissions expressly provided by that product.

**Q3 — Transient image inference**

Permitted under the same general safeguards as Q2.

A live-fetched Place Photo may be submitted transiently to a multimodal model to identify possible visual signals, such as seating configuration or the apparent presence of laptops, provided that: the photo is not stored or cached outside the permitted live-delivery process; the model provider does not retain the photo or use it for model development; the analysis is session-only; the result is not automatically published; the model does not perform facial recognition, biometric identification, or identification of individuals; the output does not reproduce or act as a substitute for the photo; and a human editor remains responsible for any resulting editorial action.

**Q4 — Third-party model providers**

Permitted.

A third-party enterprise or API model provider may perform the authorized transient processing described above where its binding terms and technical configuration prohibit training on customer inputs and limit retention to what is strictly necessary to provide the requested service. Using a third-party processor does not, by itself, constitute prohibited exporting or an unauthorized grant of rights, provided that the provider: acts solely as WorkinCafe's contracted processor; receives no independent right to use the Places content; processes the content only to provide the requested inference; applies suitable confidentiality and security protections; does not retain or reuse the content; and complies with all applicable Google Maps Platform terms flowing through to WorkinCafe's processing arrangements. Processing is not required to occur exclusively through a Google model or Google Cloud architecture for the specific transient workflows described. WorkinCafe remains responsible for the conduct of its service providers and should retain documentation of the provider's applicable no-training and retention terms.

**Q5 — Durable derived values**

Permitted under the conditions described.

A durable value may be retained where it is a limited operational or editorial signal that does not reproduce, summarize, expose, or function as a substitute for the underlying Google Maps Content. This includes examples such as: an internal editorial-review priority score; and a value such as `editor_noted_possible_study_suitability`. The permitted treatment is as follows: (1) Human-created value: permitted where it represents an independent human judgment. (2) Deterministic rule-created value: permitted where it is a non-reconstructable operational signal and does not preserve protected source values or encode them in a reversible form. (3) AI-created value: permitted where it is produced through the approved transient workflow, is independently reviewed where used for editorial decisions, and does not reproduce or substitute for the source content. Derived values must not be designed so that ratings, review counts, review text, summary content, or other restricted Places fields can be recovered or reliably inferred. WorkinCafe should also avoid presenting such values as Google-provided facts or implying Google's endorsement of its editorial classifications.

**Q6 — Places API AI-powered summaries**

The `generativeSummary` and `reviewSummary` fields are Google Maps Content and remain subject to the applicable Places API requirements. Their use is nevertheless permitted for the workflows described in your request as follows: internal editorial display — permitted when fetched live and displayed with all required disclosure, attribution, reporting links, source links, and presentation requirements; transient model processing — permitted under the safeguards approved in Q2; human-authored judgments based on a summary — permitted under the conditions approved in Q1; persisted derived values — permitted under the conditions approved in Q5. The summary itself, a paraphrase functioning as a substitute for it, or a substantially equivalent reconstruction may not be retained unless expressly allowed by the applicable product documentation or a separate written agreement. All product-specific display and attribution requirements continue to apply whenever an AI-powered summary is shown.

**Q7 — Transient use of rating information for queue ordering**

Permitted.

The `rating` and `userRatingCount` fields may be fetched live and used transiently to order an internal editorial-review queue during a session where: the raw values are not persisted; the raw values are not publicly displayed unless displayed in accordance with applicable Places requirements; the resulting queue order is not stored as a proxy for the underlying values; the ordering is used only to prioritize human editorial review; the workflow does not misrepresent or modify Google's public search ranking; and the application does not present the internal ordering as a Google ranking or recommendation. The described workflow would not, by itself, be treated as an impermissible modification of Google search-result integrity.

**General conditions**

This guidance is contingent on WorkinCafe continuing to: store only Place IDs where storage is expressly permitted; fetch all other Places content live unless another retention permission applies; prevent application and infrastructure logs from capturing Places response bodies or restricted model inputs; maintain all required Google Maps and third-party attribution; avoid using Google Maps Content for model training, testing, validation, fine-tuning, evaluation, benchmarking, or product improvement; prevent automated publication without meaningful human review; avoid creating outputs that reproduce, closely paraphrase, reconstruct, or substitute for Google Maps Content; restrict access to authorized personnel and contracted processors; maintain appropriate deletion, security, and provider-governance controls; and refrain from representing WorkinCafe's judgments as Google's conclusions, rankings, or endorsements.

This response is limited to the implementation described in your request and does not amend the Google Maps Platform Terms, product documentation, or any other governing agreement. In the event of a conflict, the applicable agreement and product documentation control.

Please retain this response with your compliance records and reference this case in any future request involving a materially expanded workflow.

Regards,

Google Maps Platform Support
Policy and Compliance Team
