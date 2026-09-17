/**
 * Value domain, AST and function-descriptor types for the CE formula engine.
 *
 * The AST here is persisted in `base_properties.type_options.ast` alongside the
 * `source` it was compiled from, so its shape is a storage format: keys are
 * short, and nothing that can be re-derived (spans, resolved types) is kept.
 * Bump AST_VERSION whenever the shape changes; BaseFormulaService recompiles
 * from `source` when a stored ast carries an older version.
 */

export type Span = { start: number; end: number };

export type FormulaResultType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'date'
  | 'null';

/** What a function parameter accepts. `any` opts out of static checking. */
export type FormulaParamType = FormulaResultType | 'any';

export type FormulaCategory =
  | 'logic'
  | 'math'
  | 'string'
  | 'date'
  | 'coercion';

export const AST_VERSION = 2;

/** Longest formula source accepted; mirrors formulaTypeOptionsSchema. */
export const MAX_FORMULA_SOURCE_LENGTH = 10_000;

/** Guard against formulas that reference each other through long chains. */
export const DEFAULT_MAX_DEPTH = 16;

export type UnaryOp = 'neg' | 'not';

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '&'
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export type LiteralValue = string | number | boolean | null;

/** AST as parsed, before property names are resolved to ids. Carries spans. */
export type RawAst =
  | { k: 'lit'; v: LiteralValue; span: Span }
  | { k: 'name'; name: string; span: Span }
  | { k: 'call'; fn: string; args: RawAst[]; span: Span }
  | { k: 'un'; op: UnaryOp; a: RawAst; span: Span }
  | { k: 'bin'; op: BinaryOp; l: RawAst; r: RawAst; span: Span };

/** AST after resolution. This is what gets stored. */
export type Ast =
  | { k: 'lit'; v: LiteralValue }
  | { k: 'prop'; id: string }
  | { k: 'call'; fn: string; args: Ast[] }
  | { k: 'un'; op: UnaryOp; a: Ast }
  | { k: 'bin'; op: BinaryOp; l: Ast; r: Ast };

/**
 * A date that has not been flattened to a string yet. Date cells are stored
 * either as `YYYY-MM-DD` (no timezone, same day everywhere) or as an ISO
 * instant; `dateOnly` remembers which so the result serializes back the same
 * way it came in.
 */
export class FormulaDate {
  constructor(
    readonly ms: number,
    readonly dateOnly: boolean,
  ) {}
}

/**
 * Failure of a single cell. Stored in the cell so the grid can show #ERROR
 * with a reason instead of a blank. Shape matches FormulaErrorCell in
 * apps/client/src/ce/base/types.ts.
 */
export type ErrorCell = { __err: string; msg: string; v: 1 };

/** Value flowing through evaluation. FormulaDate never escapes to storage. */
export type Value =
  | number
  | string
  | boolean
  | null
  | FormulaDate
  | ErrorCell;

/** Value as stored in a cell: JSON, no FormulaDate. */
export type StoredValue = number | string | boolean | null | ErrorCell;

export type FormulaFn = {
  name: string;
  category: FormulaCategory;
  doc: string;
  arity: { min: number; max: number | null };
  /** Positional parameter types; the last entry repeats when arity.max is null. */
  paramTypes: FormulaParamType[];
  /**
   * Static result type. A function whose result depends on its arguments
   * (IF, COALESCE) gets a callback over the checked argument types.
   */
  resultType:
    | FormulaResultType
    | ((args: FormulaResultType[]) => FormulaResultType);
  /** Called with evaluated arguments. Omitted for special forms (see `lazy`). */
  call?: (args: Value[], ctx: FnContext) => Value;
  /**
   * Special form: receives unevaluated argument nodes plus an evaluator, so it
   * can short-circuit (IF, AND, OR) or trap a failing branch (IFERROR).
   * Takes precedence over `call`.
   */
  lazy?: (
    args: Ast[],
    evalNode: (node: Ast) => Value,
    ctx: FnContext,
  ) => Value;
};

/** What a function implementation is allowed to see. */
export type FnContext = {
  /** Evaluation clock, so NOW()/TODAY() agree across one row. */
  now: number;
};

export type FormulaRegistry = ReadonlyMap<string, FormulaFn>;
