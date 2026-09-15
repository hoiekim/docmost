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
**Community Edition (CE)** server module that replaces the private **Enterprise Edition (EE)**
module upstream keeps in a closed repository.

For everything about Docmost itself (features, screenshots, installation, configuration,
development setup) see the upstream project:

- Repository: https://github.com/docmost/docmost
- Documentation: https://docmost.com/docs
- Development guide: https://docmost.com/docs/self-hosting/development

## What CE adds

Upstream ships the user interface, database migrations and shared packages for several
enterprise features as open source, but the server-side code that makes them work lives in a
private git submodule at `apps/server/src/ee`. This fork removes that submodule and provides
its own implementation under `apps/server/src/ce`.

Features currently implemented by CE:

- **Bases** — Notion-style tables and kanban boards backed by a page, with 17 property types,
  filters and sorts, formulas, property type conversion, CSV export and realtime updates.

Every workspace on a CE server has these features enabled. There is no license key and no
plan check; the list of enabled features lives in
[`apps/server/src/ce/licence/enabled-features.ts`](apps/server/src/ce/licence/enabled-features.ts).

Enterprise features that CE does not implement (SSO, MFA, audit logs, and so on) stay hidden in
the UI exactly as they do on an unlicensed upstream install.

## How it fits together

- `apps/server/src/ce/` holds all fork-authored code. Nothing in it is copied from Docmost's
  private enterprise repository.
- `apps/server/src/ee/` contains only four one-line re-export files. The open-source server
  loads enterprise code through fixed `require('./ee/...')` paths, and these shims forward
  those paths into `ce/`.
- No other file differs from upstream. Rebasing onto a new upstream release usually produces a
  single conflict on the removed submodule pointer; the procedure is documented in
  [`apps/server/src/ce/README.md`](apps/server/src/ce/README.md).

## Running

Build and run exactly as upstream describes. The Docker image built from this repository's
`Dockerfile` includes CE; there is no separate build flag or edition switch.

## License

Docmost core is licensed under the [AGPL 3.0](LICENSE), and so is the code in
`apps/server/src/ce`.

Upstream places the following directories under the Docmost Enterprise License defined in
`packages/ee/LICENSE`, and that remains the case in this fork:

- `apps/client/src/ee`
- `packages/ee`

The client-side code for Bases is in `apps/client/src/ee`, so the enterprise license terms
apply to it. Review that license before running this fork in production.
