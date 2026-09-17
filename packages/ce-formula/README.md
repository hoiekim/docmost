# `@docmost/ce-formula` — formula engine for CE bases

Fork-authored replacement for `@docmost/base-formula`. Everything here is
written for this fork and licensed under the AGPL 3.0, like the rest of the
open-source tree.

## Why this package exists

`packages/base-formula` carries the Docmost Enterprise License
(`packages/base-formula/LICENSE`), even though it is checked into the public
upstream repository. That license permits copying and modification "for
development and testing purposes" but forbids publishing and distribution, and
conditions production use on a subscription. CE depends on nothing from it: the
bases feature in this fork is served entirely by `apps/server/src/ce/base` and
`apps/client/src/ce/base`, so its formula engine lives here instead.

Nothing in this package is copied from or derived from `packages/base-formula`.
The API surface was taken from the CE call sites that consume it
(`apps/server/src/ce/base/services/base-formula.service.ts`,
`apps/server/src/ce/base/engine/cell-renderer.ts` and
`apps/client/src/ce/base/model/formula.ts`); the language semantics are the
ordinary spreadsheet ones.

`packages/base-formula` is left on disk and untouched so that the equally
untouched `apps/client/src/ee` tree still type-checks. It is not imported by
CE, not bundled into the client, and not copied into the Docker image.

## The language

```
prop("Budget") * 1.2                      arithmetic over property references
IF(prop("Done"), "shipped", "open")       branching
CONCAT(prop("First"), " ", prop("Last"))  text, also written with &
DATEDIFF(prop("Start"), TODAY(), "days")  dates
```

- References are always `prop("Name")`; names match exactly first, then
  case-insensitively.
- Operators, loosest binding first: `or`, `and`, `not`, comparisons
  (`= == != <> < <= > >=`), `&` (text join), `+ -`, `* / %`, unary `-`, `^`
  (right-associative). `-2^2` is `-4`.
- Literals: numbers, `"text"` or `'text'`, `true`, `false`, `null`/`blank`.
- Functions are case-insensitive and grouped into the five categories the
  formula editor renders: logic, math, string, date, coercion.

Dates are held as an instant plus a `dateOnly` flag, so a formula over a
`YYYY-MM-DD` cell returns `YYYY-MM-DD` and shows the same day in every
timezone. Date maths is done in UTC for the same reason.

## Pipeline

```
source ──parseRaw──▶ RawAst ──resolve──▶ Ast + dependencies
                                   │
                                   ├──typecheck──▶ resultType
                                   └──evaluate───▶ cell value
```

`parseRaw`, `resolve` and `typecheck` throw `FormulaParseError`, whose
`.errors[0]` carries the message and source span the editor underlines.
`evaluate` never throws for a formula problem: a failure becomes an
`ErrorCell` (`{ __err, msg, v: 1 }`) so the row still saves and the grid shows
`#ERROR` with the reason in a tooltip.

`BaseFormulaGraph` answers the two graph questions: `detectCycle` rejects a
formula that would reference itself, and `affectedFormulas` lists the formulas
to recompute after a property changes.

## Stored ASTs

The resolved AST is persisted in `base_properties.type_options.ast` next to the
`source` it came from, tagged with `astVersion` (`AST_VERSION` in `types.ts`).
`BaseFormulaService.computeRow` recompiles from `source` when it meets an AST
from an older version, so bumping `AST_VERSION` is a safe way to change the
shape.
