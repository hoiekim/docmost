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
  `@/ce/base/...` instead of `@/ee/base/...`. `apps/client/src/ee/base` is left as upstream
  ships it, unused and therefore not bundled, so upstream changes to it never conflict.
- No other file differs from upstream. Rebasing onto a new upstream release usually produces a
  single conflict on the removed submodule pointer plus, occasionally, one of the four import
  lines; the procedures are documented in
  [`apps/server/src/ce/README.md`](apps/server/src/ce/README.md) and
  [`apps/client/src/ce/README.md`](apps/client/src/ce/README.md).

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

No CE code imports any of them. The bases UI comes from `apps/client/src/ce` and its formula
engine from `packages/ce-formula`, a fork-authored AGPL replacement for
`packages/base-formula`; nothing under `apps/client/src/ee/base` or `packages/base-formula`
is imported, bundled or copied into the Docker image.

The rest of `apps/client/src/ee` (feature flags, entitlement hooks and the pages for features
CE does not implement) is still imported by the open-source core exactly as upstream does, so
a client bundle built from this repository still contains that enterprise code. Review the
Enterprise License before running this fork in production, and before publishing an image
built from it.
