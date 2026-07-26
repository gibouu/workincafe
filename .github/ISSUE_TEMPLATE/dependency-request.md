---
name: Dependency request
about: Request adding, removing, or major-upgrading a dependency
title: "deps: <package> — <add|remove|upgrade>"
labels: ["dependency"]
---

<!--
Never add/remove/major-upgrade a dependency directly. Propose it here; on
approval it is added to docs/approved-dependencies.json in the same reviewed PR
that introduces its use. Check the deferred register first — the item may
already be deferred or governance-gated.
-->

## Package and action

- Package: <!-- exact npm name -->
- Action: add / remove / major-upgrade
- Runtime or dev dependency:

## Why the current approved stack cannot do this

<!-- Concrete need in an implemented or imminent slice. "It's popular/modern/
convenient" is not sufficient. -->

## Deferred-register check

<!-- Is it listed in docs/decisions/deferred-register.md? If so, cite the entry
and the recorded trigger or changed fact that now justifies it. -->

## Facts (verify officially, with dates)

- Latest stable version / channel (no beta/RC/preview per FW-1):
- License:
- Maintenance status (last release, activity):
- Next.js / runtime compatibility:
- Bundle/client-boundary impact:

## Alternatives considered
