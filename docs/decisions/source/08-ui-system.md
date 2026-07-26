# Operative decision record — Decision 14: styling and component strategy

Approved 2026-07-24.

## Styling — Tailwind CSS v4

CSS-first tokens via `@theme` and, where semantic variables map into
utilities, `@theme inline`. Bindings: styling colocated with the component
it affects; global CSS reserved for token declarations, resets, typography
defaults, and genuinely global behavior; components use semantic tokens
rather than hardcoded palette values wherever practical; repeated
arbitrary values are promoted into tokens; no parallel JS/TS theme
configuration where CSS tokens suffice; latest stable Tailwind v4 at
implementation (no volatile point version recorded as architecture).

## Components — shadcn-style in-repo approach on Base UI

Components are generated or added into `components/ui/`; their source is
owned, reviewed, and modified like normal application code; generate only
components an approved feature actually needs; generated code is a
starting point, not automatically accepted architecture; the CLI is
development tooling only and never runs during startup or deployment
(pinned to a reviewed exact version; never unpinned `@latest` in committed
scripts).

**Base UI is the sole default headless primitive system.** No mixing of
Base UI, Radix, and React Aria as co-equal systems at launch; Radix and
React Aria remain future exceptions only for a demonstrated missing
capability approved through dependency governance. Use native HTML for
simple controls where it already provides required semantics; Base UI for
complex interaction (focus management, keyboard navigation, overlays,
selection, composite widgets, gestures); WorkinCafe-owned wrappers in
`components/ui/` are the interface feature components consume. The search
interface must not be an unstructured hand-rolled ARIA widget — it uses
the approved primitives for combobox/listbox behavior beneath the custom
grouped results (local café matches + the semantic-search action).

## Mobile bottom sheet — Base UI Drawer

When product design retains a gesture-capable sheet: desktop uses a normal
dialog or side panel; mobile uses Base UI Drawer with swipe dismissal only
where it does not conflict with vertical scrolling or map gestures;
controlled snap points for compact/intermediate/expanded café states;
accessible title and description; correct focus restoration;
reduced-motion behavior; mobile-keyboard handling where the sheet contains
inputs. **Vaul is not added** and stays off the allowlist while Base UI's
maintained Drawer satisfies the requirement; reconsidered only for a
concrete, tested interaction requirement Base UI cannot achieve.

## Design tokens

Port the archived token **structure only**, after review — conceptual
groups: surfaces, text, borders, accent/interactive states,
status/feedback, café/study-attribute categories, elevation, blur, radius,
motion/transition timing. Re-decide all values during the product-design
pass for the curated Google-Maps-inspired direction. Maintain three
layers: foundational palette values → semantic interface tokens →
product-specific category tokens; feature components consume the upper
layers. No archived selectors, Apple-specific assumptions, or unused
tokens copied merely because they exist.

## Dependencies and utilities

Allowlist: `@base-ui/react` (exact official package name verified at
implementation), `clsx`, `tailwind-merge`, `class-variance-authority`,
`tw-animate-css`. Not added: `radix-ui` as default primitives, `vaul`,
`tailwindcss-animate`. Install a utility when the first reviewed component
actually uses it; one canonical `cn()` helper combining clsx +
tailwind-merge; CVA for genuine reusable variants only; `tw-animate-css`
only for shared primitive transitions; no competing class-composition or
animation libraries; all generated files committed and reviewed.

## Accessibility and ownership

The primitive library reduces implementation risk but never transfers
responsibility. Every generated or wrapped interactive component provides:
meaningful accessible name; visible focus treatment; keyboard operability;
correct disabled state; dialog/drawer titles and descriptions; focus
restoration after dismissal; mobile-appropriate touch targets;
reduced-motion behavior where animation is nonessential. Canonical
examples required as slices land: button/icon button; toggle or segmented
selection; dialog; mobile drawer with snap points; popover; tooltip;
search combobox with grouped results; toast/status announcement when
introduced. Archived hand-rolled controls are not ported unless their
semantics and behavior are rebuilt on the approved primitive system.
