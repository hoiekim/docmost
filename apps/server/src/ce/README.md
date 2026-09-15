# `apps/server/src/ce` — fork-authored server extensions

This directory holds the server side of features that upstream Docmost ships
only in its private enterprise repository. Everything here is written for this
fork; nothing is copied from `github.com/docmost/ee`.

Currently implemented:

- **Bases** (`base/`): tables and kanban boards backed by a page. The client
  (`apps/client/src/ee/base`), the DB migration, the `base` editor node and the
  `@docmost/base-formula` package are all upstream open-source code; this
  directory supplies the REST API, query engine, formula evaluation, property
  type conversion, CSV export and realtime broadcasting they expect.
- **Licence shim** (`licence/`): reports the features in
  `licence/enabled-features.ts` as available to every workspace so the client
  unlocks them. No license key is involved.

## Why `apps/server/src/ee` still exists

The open-source server reaches enterprise code through `require()` calls with
fixed relative paths, each wrapped in `try/catch`:

| open-source file | required path |
|---|---|
| `app.module.ts` | `./ee/ee.module` → `EeModule` |
| `integrations/environment/license-check.service.ts` | `../../ee/licence/license.service` → `LicenseService` |
| `integrations/environment/license-check.service.ts` | `../../ee/licence/feature-registry` → `getFeaturesForCloudPlan` |
| `ws/base-realtime.bridge.ts` | `../ee/base/realtime/base-ws.service` → `BaseWsService` |

So `apps/server/src/ee/` contains exactly four one-line re-export files that
forward to this directory. Nothing else should ever be added there.

Upstream tracks `apps/server/src/ee` as a git submodule (a gitlink to the
private repo). This fork removed the gitlink and `.gitmodules` so real files can
live at that path.

## Rebasing onto upstream

No open-source file is modified by this feature, so `git rebase upstream/main`
only conflicts when upstream bumps the submodule pointer (it does so on most
enterprise releases). The conflict looks like:

```
CONFLICT (modify/delete): apps/server/src/ee deleted in HEAD and modified in <upstream commit>
```

Resolve it by keeping the fork's directory:

```sh
git rm --cached apps/server/src/ee      # drop upstream's gitlink from the index
git add apps/server/src/ee              # re-add the shim files
git rebase --continue
```

If upstream ever edits `.gitmodules` you will see a similar conflict on that
file; keep it deleted (`git rm .gitmodules`).

After a rebase, re-check the four `require()` seams above still exist with the
same paths, and that `apps/server/src/common/features.ts`, the
`EventName.BASE_*` constants, `QueueName.BASE_QUEUE` and the bases migration are
still present. If upstream changes the client contract
(`apps/client/src/ee/base/services/base-service.ts`,
`apps/client/src/ee/base/types/base.types.ts`,
`apps/client/src/ee/base/hooks/use-base-socket.ts`), mirror the change in
`base/types/base.types.ts` and the affected service.

## Layout

```
ce/
  ee.module.ts            EeModule: audit no-op shim + LicenceModule + BaseModule
  licence/                license shim (enabled-features.ts is the only file to edit)
  base/
    base.controller.ts    POST /api/bases/**
    dto/                  class-validator DTOs (shape validation of nested JSON is done with zod)
    engine/               pure functions: zod schemas, filter/sort SQL compilers, date presets,
                          cell normalization/conversion/rendering, formula type projection
    repos/                Kysely access to base_properties / base_rows / base_views
    services/             business logic; services emit EventName.BASE_* after commit
    jobs/                 BullMQ processor for BASE_QUEUE (type conversion, cell GC, formula backfill)
    realtime/             BaseWsService: room subscription + event → socket broadcast
```

Design notes:

- A base **is** a page (`pages.is_base = true`), so trash, restore, permissions,
  favorites and the sidebar all work unchanged. `IBase.id === pageId`.
- Formula cells are computed on the server and stored in `base_rows.cells`.
- Property type conversion and formula backfill run inline for bases with at
  most `INLINE_ROW_THRESHOLD` rows and through `BASE_QUEUE` above that, using
  the `pending_type` / `base_schema_version` flow the client already supports.
- Row listing uses keyset pagination on `(position, id)` when unsorted and an
  opaque offset cursor when sorted.
