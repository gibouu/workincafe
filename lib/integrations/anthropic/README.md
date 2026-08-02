# `lib/integrations/anthropic`

Server-only Anthropic API callers (Decision 27c — the approved no-training
model provider for editorial AI assistance; hand-written `fetch`, no SDK
dependency; server-only, production-only credential).

`server/messages.ts` — single-turn Messages caller for the GP-1 pre-read:
transient text + photo inputs, structured JSON output validated against
`lib/domain/assist`, `no-store`, per-attempt accounting callback, no automatic
retry, and request/response bodies never logged (prompts carry live Google
content). Model: `claude-opus-4-8` (deliberate, reviewed edits only).

Compliance documentation duty (27c): retain a copy of Anthropic's applicable
no-training and retention terms with the Decision 27 compliance records.

Dependency-direction and boundary rules: see `docs/architecture.md` and
`docs/decisions/source/07-application-architecture.md`.
