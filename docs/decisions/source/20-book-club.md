# Decision 33 — Book Club cafés with their Luma link

Status: **proposed** (product owner, 2026-11-12). Becomes ratified when the
technical lead (Cem Gunay) approves the pull request that carries this record;
until then nothing here may be built. Builds on proposed Decisions 31 and 32.

## Ruling

1. The product owner runs a **Book Club** that meets in cafés. WorkinCafe
   shows which published cafés have hosted it.
2. A café can carry a **Book Club** mark, set by an operator only (curation
   admin), never by community input.
3. Each mark carries the **Luma event link** for the session held there
   (past or upcoming). The café page shows the next session date when there
   is one, and a "See on Luma" link; the café list shows a "Book Club" badge;
   a "Book Club" filter is available.
4. **Luma is the event system.** WorkinCafe stores the link and the date
   only: no RSVP, no attendee list, no ticketing, no Luma API sync. The Luma
   link is opened in a new tab.
5. The same MCP read tools (Decision 32b) can answer "where is the next Book
   Club?" from this data.
6. Like everything else, Book Club marks are organised by **country, then
   city** (Decision 31a): an operator picks the city when adding one.

## Initial data

The product owner provides the list of cafés that already hosted the Book
Club, with one Luma link per session. Cafés not yet published go through the
normal curation path first.

## Still out of scope

Other clubs or event types, in-app RSVP, notifications.
