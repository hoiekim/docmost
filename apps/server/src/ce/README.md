# `apps/server/src/ce` — fork-authored server extensions

This directory holds the server side of features that upstream Docmost ships
only in its private enterprise repository. Everything here is written for this
fork. No enterprise implementation code is copied: upstream tracks its server
EE code as a submodule pointing at the private `github.com/docmost/ee`, which
this fork has never fetched, so that source has never been present in this tree.
The wire contract is a separate matter and is deliberately compatible — see
[Where the bases contract comes from](#where-the-bases-contract-comes-from).

Currently implemented:

- **Bases** (`base/`): tables and kanban boards backed by a page. The DB
  migration and the `base` editor node are upstream open-source code; the
  formula engine is the fork's own `packages/ce-formula` and the client is the
  fork's own `apps/client/src/ce/base`. This directory supplies the REST API,
  query engine, formula evaluation, property type conversion, CSV export and
  realtime broadcasting.

  Note that `packages/base-formula` is **not** open source, despite being
  checked into the public upstream repository: it carries the Docmost
  Enterprise License (`packages/base-formula/LICENSE`), which permits
  development and testing but not distribution, and conditions production use
  on a subscription. Nothing in CE imports it. See
  `packages/ce-formula/README.md`.
- **Licence shim** (`licence/`): reports the features in
  `licence/enabled-features.ts` as available to every workspace so the client
  unlocks them. No license key is involved.

## Where the bases contract comes from

CE's wire contract — route paths, JSON shapes, stored values, event names — is
deliberately compatible with the one upstream's enterprise build uses. Three
reasons, all of them interoperability:

1. A database written by an enterprise install stays readable. Property types,
   `type_options` and view `config` are persisted JSON that the open-source
   migration creates but does not describe, so the shapes have to agree.
2. The open-source core calls into bases at fixed seams it defines itself
   (`require('./ee/...')`, the `base` editor node, the feature key), and those
   seams dictate part of the interface.
3. `apps/client/src/ce/base` and `apps/client/src/ee/base` stay interchangeable,
   which is what lets this fork rebase without re-deriving the interface every
   release.

Compatibility is an interface property; no enterprise implementation code was
copied into this directory. Provenance, area by area:

| part of the contract | comes from |
|---|---|
| table, column and JSON key names (`base_properties`, `base_rows.cells`, `base_views.config`, `pages.is_base`, `base_schema_version`) | open-source `database/migrations/20260529T125146-bases.ts` |
| `BaseProperty` / `BaseRow` / `BaseView` entity types | open-source `database/types/entity.types.ts` |
| domain event names (`base.row.created`, `base.schema.bumped`, …) | open-source `common/events/event.contants.ts` |
| queue and job names (`BASE_QUEUE`, `base-type-conversion`, …) | open-source `integrations/queue/constants/queue.constants.ts` |
| the `bases` feature key | open-source `common/features.ts` |
| socket operation names (`base:row:created`, …) | restyled from the open-source `EventName.BASE_*` constants. The open-source `ws/base-realtime.bridge.ts` forwards these blind and never names one, so the colon spelling matches the enterprise client's rather than being derived from open-source code. |
| property type values (`text`, `multiSelect`, `lastEditedBy`, …) and `type_options` / view `config` shapes | chosen to match what an enterprise install writes into `base_properties.type` and the two `jsonb` columns, per reason 1 above |
| `POST /api/bases/**` route paths and request/response shapes | chosen so the two client implementations stay interchangeable, per reason 3 above |

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

No open-source file *under `src/`* is modified by this feature, so
`git rebase upstream/main` usually only conflicts when upstream bumps the
submodule pointer (it does so on most enterprise releases). Two build files
outside `src/` do carry fork entries, and both fail loudly if a rebase drops
them: `apps/server/package.json` (the `@docmost/ce-formula` dependency and the
jest `moduleNameMapper` entries) and `apps/server/tsconfig.json` (the
`@docmost/ce-formula/*` paths). The client has four more, two of which fail
silently — see
[Fork-specific build configuration](../../../client/src/ce/README.md#fork-specific-build-configuration).

The submodule conflict looks like this. Note that a *rebase* replays the
fork's commit onto upstream, so the fork's deletion is the incoming side and
upstream's gitlink is `HEAD` — the reverse of a merge. Because the fork's real
directory wants the same path, git moves the gitlink aside rather than
conflicting on the path itself:

```
CONFLICT (file/directory): directory in the way of apps/server/src/ee from HEAD;
  moving it to apps/server/src/ee~HEAD instead.
CONFLICT (modify/delete): apps/server/src/ee~HEAD deleted in <fork commit> and
  modified in HEAD.
```

So the conflicted path is `apps/server/src/ee~HEAD`, not `apps/server/src/ee`,
and the shim files are already staged at stage 0 — nothing needs re-adding.
Drop the stray gitlink and its empty directory:

```sh
git update-index --force-remove 'apps/server/src/ee~HEAD'
rmdir 'apps/server/src/ee~HEAD'
git rebase --continue
```

`git rm --cached` does not work here: the entry is unmerged and has no stage-0
version, so it has to be removed from the index directly. Confirm the result
with `git ls-files -s apps/server/src/ee`, which must list the four shim files
as `100644` and no `160000` gitlink.

`.gitmodules` replays as a clean delete (the fork removed it, upstream has not
touched it since). If upstream ever edits it you will get a conflict there too;
keep it deleted (`git rm .gitmodules`).

After a rebase, re-check the four `require()` seams above still exist with the
same paths, and that `apps/server/src/common/features.ts`, the
`EventName.BASE_*` constants, `QueueName.BASE_QUEUE` and the bases migration are
still present. The client contract lives in the fork
(`apps/client/src/ce/base/types.ts`, `api.ts` and
`realtime/use-base-socket.ts`); change both sides together.

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
