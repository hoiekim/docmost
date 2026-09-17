# `apps/client/src/ce/ee-stub` — CE stand-ins for the enterprise client

Upstream's open-source client imports enterprise code directly: 39 files reach
into `@/ee/*` for feature gating, entitlements, SSO, billing, AI and the
settings pages of features CE does not implement. That code is checked into the
public repository under the Docmost Enterprise License, which forbids
publishing and distribution — so as long as it is in the module graph, anything
built from this repository carries enterprise-licensed code.

This directory removes it from the graph. `vite.config.ts` and `tsconfig.json`
alias `@/ee/*` here, so every one of those imports resolves to a fork-authored
stub and `apps/client/src/ee` is never compiled or bundled. The directory stays
on disk, untouched, only so upstream changes to it never conflict on rebase;
`.dockerignore` keeps it out of the image build context entirely.

**Verification.** The client builds with `apps/client/src/ee` physically
deleted. If it ever stops doing so, something has re-entered the graph.

```sh
mv apps/client/src/ee /tmp/ee && pnpm --filter client build; mv /tmp/ee apps/client/src/ee
```

## What the stubs do

Almost all of them do nothing, because CE does not implement the feature: a
component renders `null`, a list endpoint returns an empty page, a lazy route
renders `_not-available.tsx`. The enterprise UI they replace is unreachable
anyway — every link to it is behind an entitlement a CE server does not report.

Four carry real behaviour, and changing them will break things:

| module | behaviour |
|---|---|
| `entitlement/use-entitlements.ts` | Really calls `POST /workspace/entitlements`. **This is what unlocks bases.** Stub it out and CE's own feature turns off. |
| `entitlement/entitlement-atom.ts` | Holds that response. `user-provider.tsx` writes it, `settings-sidebar.tsx` and `use-feature.ts` read it. |
| `hooks/use-feature.ts` | `entitlements?.features?.includes(f) ?? false` — the same check `settings-sidebar.tsx` performs inline on the same atom. |
| `features.ts` | The feature keys, mirroring the open-source `apps/server/src/common/features.ts`. |

## Provenance

Every stub's shape is taken from the **open-source call site** that imports it,
not from the enterprise module it replaces: what the caller destructures, which
props it passes, what it does with the return value. `Feature` mirrors the
open-source server's `common/features.ts`, and the entitlements response shape
is the literal return of the open-source
`core/workspace/controllers/workspace.controller.ts`. Nothing here is copied
from `apps/client/src/ee`.

## Adding a stub

After a rebase, a new enterprise import in an open-source file shows up as a
`tsc` error naming the missing module. Two steps:

1. Run `apps/client/src/ce/rewire.sh`, which normalises relative `../ee/`
   imports to `@/ee/` so the alias catches them (upstream writes a couple by
   hand) and points `@/ee/base/` at the fork's real bases UI.
2. Create the file at the path the error names, mirroring the `@/ee/*`
   specifier exactly — including the extension, since upstream imports both
   `@/ee/features` and `@/ee/features.ts`, and directory imports like
   `@/ee/mfa` need an `index.tsx`. Read the call site to see what it needs.

Files starting with `_` are stub-internal helpers, not mirrors of an
enterprise path.

**A stub that returns a function, array or object has to return the same
reference every render.** Callers put those values in `useEffect` and `useMemo`
dependency arrays, so a fresh `() => {}` or `[]` per render makes the effect
re-run on every render; if the effect sets any state — directly or through a
mutation's `reset()` — that is a render loop. `ai/hooks/use-ai-search.ts`
shipped with `clearStreaming: () => {}` and cost about five seconds of blank
page on every page navigation, because `search-spotlight.tsx` depends on it
and it sits under `<Layout>`, above the whole app. Hoist such values to module
scope (they never close over anything, since the stubs do nothing) or wrap them
in `useCallback`/`useMemo` with a stable dependency list.
