# `apps/client/src/ce` — fork-authored client extensions

This directory holds the client side of features that upstream Docmost ships
under its Enterprise License in `apps/client/src/ee`. Everything here was
written for this fork against the server contract in `apps/server/src/ce`.

To be precise about what that does and does not claim: no implementation code
was copied from `apps/client/src/ee`, and none of its components, hooks,
styles, layout or logic were adapted. The interface vocabulary is a different
matter — this fork's bases UI is intentionally a drop-in replacement for the
enterprise one, so route paths, JSON shapes, socket operation names and a
number of exported type names are the same by design. Unlike the server side,
where the enterprise source has never been present in the tree, that source
*is* checked in here under `ee/base`, so this was not written blind to it.
[Where the bases contract comes from](../../../server/src/ce/README.md#where-the-bases-contract-comes-from)
records what each part of the shared interface derives from and why.

Currently implemented:

- **Bases** (`base/`): tables and kanban boards backed by a page. The
  open-source core keeps the page/route plumbing (`pages/page/page.tsx`, the
  `base` editor node and its `base-embed-view.tsx`, the slash-menu items, the
  "Get started with" chips) and only needs a `BaseView` component, a
  `BaseTableSkeleton`, a `useBaseQuery` hook, a
  `useConvertPageToBaseMutation` hook and the `/base/:pageId` route page.
  This directory supplies them.

## How the core is wired to this directory

Unlike the server (where upstream's enterprise code is a private submodule
and the seams are `require()` calls), the client's enterprise code is
checked in under `apps/client/src/ee/base`. Deleting it would make every
upstream change to that directory a modify/delete conflict on rebase, so it
is left untouched and simply not imported. Four open-source files import the
bases UI; in this fork each of those imports points at `@/ce/base/...`
instead of `@/ee/base/...`:

| open-source file | imports |
|---|---|
| `src/App.tsx` | `@/ce/base/pages/base-page.tsx` (default export) |
| `src/pages/page/page.tsx` | `BaseView` from `@/ce/base/components/base-view` |
| `src/features/editor/components/base-embed/base-embed-view.tsx` | `BaseView`, `BaseTableSkeleton`, `useBaseQuery` |
| `src/features/editor/components/empty-page/empty-page-get-started.tsx` | `useConvertPageToBaseMutation` from `@/ce/base/queries/base-query` |

Those are the only edits to open-source files. Nothing else imports
`apps/client/src/ee/base`, so Vite tree-shakes it out of the bundle (it is
still type-checked by `tsc`, which is harmless).

`ce/base` itself imports nothing from `apps/client/src/ee`.

`apps/client/package.json` still lists `@docmost/base-formula` as a dependency.
That is only so the untouched `ee/base` tree keeps type-checking — it carries
the Docmost Enterprise License, `ce/base` uses `@docmost/ce-formula` instead,
and since nothing imports `ee/base` it never reaches the bundle or the Docker
image.

## Rebasing onto upstream

1. `git rebase upstream/main`. Conflicts in the four files above are
   confined to their import lines; keep the `@/ce/base/...` path.
2. Run `apps/client/src/ce/rewire.sh`. It rewrites any `@/ee/base/` import in
   open-source files to `@/ce/base/` and prints the files it touched. New
   imports upstream may add (a new symbol or module) show up as a `tsc`
   error next; implement the missing export in `ce/base`.
3. Re-check the contract this directory depends on:
   - `apps/server/src/ce/base` (the REST and realtime API — both sides of
     the contract are fork code, so change them together);
   - `packages/ce-formula` (`@docmost/ce-formula/client` exports used
     by `base/model/formula.ts`);
   - the `BaseEmbed` node in `packages/editor-ext` (`pageId` / `pendingKey`
     attributes read by `base-embed-view.tsx`);
   - `features/page/page.utils.ts` (`buildPageUrl`, `getPageTitle`),
     `features/search/services/search-service.ts` (`searchPage`,
     `searchSuggestions`), `features/page/services/page-service.ts`
     (`uploadFile`) and `features/workspace/services/workspace-service.ts`
     (`getWorkspaceMembers`), which the pickers call.
4. `pnpm --filter client exec tsc --noEmit` and `pnpm --filter client test`.

## Layout

```
ce/
  README.md
  rewire.sh                  post-rebase import rewrite (see above)
  base/
    types.ts                 client mirror of the server contract
    api.ts                   REST client for /api/bases/**
    ids.ts, positions.ts     choice/request ids; fractional-index helpers
    model/                   pure logic: property-type descriptors, cell read/format,
                             filter operators, view config, formula validation, conversion warnings
    queries/                 TanStack Query hooks + cache helpers (base, properties, rows, views, page refs)
    realtime/                socket subscription that folds base:* events into the cache
    state/                   jotai atoms (active view, drafts, selection, focus, references)
    hooks/                   active view, view-config controller (persist vs. local draft)
    components/
      base-view.tsx          root: loads the base, provides BaseContext, renders toolbar + view
      base-context.tsx       useBase()
      toolbar/               view tabs, toolbar, viewer draft banner
      table/                 virtualized grid, header cells (sort/hide/resize/reorder), keyboard nav
      kanban/                board grouped by a select/status property
      cells/                 per-type display + editors, pickers (choice, person, page, date, file)
      property/              property editor (name, type, per-type options, formula editor)
      views/                 filter, sort and property-visibility popovers
      row-detail/            row modal
    pages/base-page.tsx      /base/:pageId → redirects to the page's canonical URL
    styles/                  CSS modules
```

Design notes:

- A base **is** a page; `BaseView` gets `pageId` and the caller's
  `editable` verdict (feature flag + page permission + editor mode).
- View configuration changes made by editors are persisted for everyone;
  viewers get an in-memory draft (`state/atoms.ts#viewDraftAtom`) so they
  can still filter and sort what they see.
- Mutations attach a `requestId`; the socket handler ignores events that
  echo this client's own writes because the mutation already updated the
  cache from the HTTP response.
- Date-only cells are stored as `YYYY-MM-DD` so every timezone shows the
  same day and the server's UTC-day filters agree; cells with a time are
  ISO instants.
