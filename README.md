<div align="center">
    <h1><b>Docmost CE</b></h1>
    <p>
        A fork of <a href="https://github.com/docmost/docmost">Docmost</a>, the open-source collaborative wiki,
        with a Community Edition that stands in for the paywalled Enterprise Edition.
    </p>
</div>
<br />

## About this fork

This repository tracks [docmost/docmost](https://github.com/docmost/docmost) and adds a
**Community Edition (CE)**: a server module that replaces the private **Enterprise Edition (EE)**
module upstream keeps in a closed repository, and a client implementation of the same features
that replaces the enterprise-licensed UI upstream ships in `apps/client/src/ee`.

For everything about Docmost itself (features, screenshots, installation, configuration,
development setup) see the upstream project:

- Repository: https://github.com/docmost/docmost
- Documentation: https://docmost.com/docs
- Development guide: https://docmost.com/docs/self-hosting/development

## What CE adds

Upstream ships the database migrations and shared packages for several enterprise features
as open source, keeps the server-side code in a private git submodule at `apps/server/src/ee`,
and publishes the user interface under a proprietary license in `apps/client/src/ee`. This fork
removes the submodule and provides its own server implementation under `apps/server/src/ce`,
and its own user interface under `apps/client/src/ce`.

Features currently implemented by CE:

- **Bases** — Notion-style tables and kanban boards backed by a page, with 17 property types,
  filters and sorts, formulas, property type conversion, CSV export and realtime updates.

Every workspace on a CE server has these features enabled. There is no license key and no
plan check; the list of enabled features lives in
[`apps/server/src/ce/licence/enabled-features.ts`](apps/server/src/ce/licence/enabled-features.ts).

Enterprise features that CE does not implement (SSO, MFA, audit logs, and so on) stay hidden in
the UI exactly as they do on an unlicensed upstream install.

## How it fits together

- `apps/server/src/ce/` holds all fork-authored server code. Nothing in it is copied from
  Docmost's private enterprise repository.
- `apps/server/src/ee/` contains only four one-line re-export files. The open-source server
  loads enterprise code through fixed `require('./ee/...')` paths, and these shims forward
  those paths into `ce/`.
- `apps/client/src/ce/` holds all fork-authored client code, written against the CE server
  contract. No implementation code is copied from `apps/client/src/ee`; the wire contract is
  intentionally compatible with it, for the reasons recorded in
  [`apps/server/src/ce/README.md`](apps/server/src/ce/README.md#where-the-bases-contract-comes-from).
- `packages/ce-formula/` is the fork's own formula engine, replacing upstream's
  enterprise-licensed `packages/base-formula`, which CE does not import.
- Four open-source client files import the bases UI; in this fork those imports point at
  `@/ce/base/...` instead of `@/ee/base/...`. Every other `@/ee/*` import is left exactly as
  upstream wrote it and redirected at build time to
  [`apps/client/src/ce/ee-stub`](apps/client/src/ce/ee-stub/README.md), so `apps/client/src/ee`
  is left as upstream ships it and upstream changes to it never conflict.
- Fourteen upstream files differ in total: the four bases files above plus
  `features/search/components/search-spotlight.tsx`; this README; and eight build and config
  files (`Dockerfile`, `.dockerignore`, both `tsconfig.json`, both `package.json`,
  `vite.config.ts`, the lockfile). To regenerate that list:

  ```sh
  git diff --name-status $(git merge-base main upstream/main) main | grep '^M'
  ```

**Before rebasing onto a new upstream release, read
[`apps/client/src/ce/README.md`](apps/client/src/ce/README.md#rebasing-onto-upstream)** — it has
the checklist, and the list of config entries that must survive the rebase, two of which fail
silently by letting enterprise code back into the build. The server side is documented in
[`apps/server/src/ce/README.md`](apps/server/src/ce/README.md#rebasing-onto-upstream); its usual
conflict is upstream bumping the removed `apps/server/src/ee` submodule pointer.

## Running

Build and run exactly as upstream describes. The Docker image built from this repository's
`Dockerfile` includes CE; there is no separate build flag or edition switch.

## License

Docmost core is licensed under the [AGPL 3.0](LICENSE), and so is the code this fork adds:
`apps/server/src/ce`, `apps/client/src/ce` and `packages/ce-formula`.

Upstream places the following under the Docmost Enterprise License defined in
`packages/ee/LICENSE`, and that remains the case in this fork:

- `apps/client/src/ee`
- `packages/ee`
- `packages/base-formula` (see `packages/base-formula/LICENSE`)

Being checked into the public upstream repository does not make these open source. The
Enterprise License permits copying and modification "for development and testing purposes",
but forbids publishing and distribution, and conditions production use on a valid Docmost
Enterprise subscription.

**None of it is built into this fork.** The open-source core imports enterprise code in 39 files;
`vite.config.ts` and `tsconfig.json` alias every `@/ee/*` import to
[`apps/client/src/ce/ee-stub`](apps/client/src/ce/ee-stub/README.md), the bases UI comes from
`apps/client/src/ce/base`, and the formula engine from `packages/ce-formula`, a fork-authored
AGPL replacement for `packages/base-formula`. So `apps/client/src/ee` and `packages/base-formula`
are excluded from `tsconfig.json`, absent from the module graph, and listed in `.dockerignore` —
they reach neither the client bundle nor any layer of the Docker image. They stay on disk,
untouched, only so that upstream changes to them never conflict on rebase.

The check that keeps this true: **the client builds with `apps/client/src/ee` deleted.**

```sh
mv apps/client/src/ee /tmp/ee && pnpm --filter client build; mv /tmp/ee apps/client/src/ee
```

This matters if you redistribute rather than only run: an image built from this repository
contains no enterprise-licensed code, but the repository itself still carries those directories,
so read `packages/ee/LICENSE` before redistributing the source.
