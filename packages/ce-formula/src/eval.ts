import {
  ErrorCode,
  FormulaEvalError,
  errorCell,
  fail,
  isErrorCell,
} from './errors';
import {
  AST_VERSION,
  DEFAULT_MAX_DEPTH,
  FormulaDate,
  type Ast,
  type FnContext,
  type FormulaRegistry,
  type StoredValue,
  type Value,
} from './types';
import {
  compareValues,
  snapNumber,
  toBoolean,
  toDate,
  toNumber,
  toStored,
  toText,
  valuesEqual,
} from './value';

export type EvalProperty = {
  id: string;
  type: string;
  typeOptions: unknown;
};

export type EvalContext = {
  registry: FormulaRegistry;
  /** Every property of the base, so formula references can be followed. */
  properties: ReadonlyMap<string, EvalProperty>;
  depth: number;
  maxDepth: number;
  /** Per-row cache of nested formula results, keyed by property id. */
  memo: Map<string, Value>;
  /** Evaluation clock; defaults to wall time. Set it to make NOW() stable. */
  now?: number;
};

/** Read a stored cell as the value its property type promises. */
function readCell(type: string, raw: unknown): Value {
  switch (type) {
    case 'number':
      return typeof raw === 'number' ? raw : null;
    case 'text':
    case 'longText':
    case 'url':
    case 'email':
      return typeof raw === 'string' ? raw : null;
    case 'checkbox':
      return raw === true;
    case 'date':
    case 'createdAt':
    case 'lastEditedAt':
      return toDate(raw as Value);
    default:
      // select, person, page, file and friends do not participate in
      // formulas; typecheck already treats them as null.
      return null;
  }
}

/**
 * Evaluate a resolved AST against one row's cells. Never throws for a formula
 * problem: a failure becomes an ErrorCell so the row still saves and the grid
 * can show #ERROR with a reason.
 */
export function evaluate(
  ast: Ast,
  cells: Record<string, unknown>,
  ctx: EvalContext,
): StoredValue {
  const fnCtx: FnContext = { now: ctx.now ?? Date.now() };
  const maxDepth = ctx.maxDepth ?? DEFAULT_MAX_DEPTH;
  const inFlight = new Set<string>();

  const readProperty = (id: string, depth: number): Value => {
    const prop = ctx.properties.get(id);
    if (!prop) {
      // The referenced property was deleted; the formula needs editing.
      fail(ErrorCode.MISSING_PROP, 'A property this formula uses was deleted');
    }
    if (prop.type !== 'formula') return readCell(prop.type, cells[id]);

    if (ctx.memo.has(id)) return ctx.memo.get(id) as Value;
    if (inFlight.has(id)) {
      fail(ErrorCode.CYCLE, 'Formulas reference each other in a loop');
    }
    if (depth >= maxDepth) {
      fail(ErrorCode.DEPTH, 'Formulas are nested too deeply');
    }

    const options = prop.typeOptions as
      | { ast?: Ast; astVersion?: number }
      | undefined;
    if (!options?.ast || options.astVersion !== AST_VERSION) {
      fail(ErrorCode.MISSING_PROP, 'A referenced formula has not been compiled yet');
    }

    inFlight.add(id);
    try {
      const value = walk(options.ast, depth + 1);
      ctx.memo.set(id, value);
      return value;
    } finally {
      inFlight.delete(id);
    }
  };

  /** Errors travel as values out of nested formulas; re-raise them here. */
  const propagate = (value: Value): Value => {
    if (isErrorCell(value)) {
      throw new FormulaEvalError(value.__err as never, value.msg);
    }
    return value;
  };

  const binary = (op: string, l: Value, r: Value): Value => {
    switch (op) {
      case '+':
        return snapNumber(toNumber(l) + toNumber(r));
      case '-':
        return snapNumber(toNumber(l) - toNumber(r));
      case '*':
        return snapNumber(toNumber(l) * toNumber(r));
      case '/': {
        const divisor = toNumber(r);
        if (divisor === 0) fail(ErrorCode.DIV_BY_ZERO, 'Cannot divide by zero');
        return snapNumber(toNumber(l) / divisor);
      }
      case '%': {
        const divisor = toNumber(r);
        if (divisor === 0) fail(ErrorCode.DIV_BY_ZERO, 'Cannot take a remainder by zero');
        return snapNumber(toNumber(l) % divisor);
      }
      case '^':
        return snapNumber(toNumber(l) ** toNumber(r));
      case '&':
        return toText(l) + toText(r);
      case '=':
        return valuesEqual(l, r);
      case '!=':
        return !valuesEqual(l, r);
      case 'and':
        return toBoolean(l) && toBoolean(r);
      case 'or':
        return toBoolean(l) || toBoolean(r);
      default: {
        const order = compareValues(l, r);
        if (order === null) fail(ErrorCode.TYPE, 'These values cannot be compared');
        switch (op) {
          case '<':
            return order < 0;
          case '<=':
            return order <= 0;
          case '>':
            return order > 0;
          case '>=':
            return order >= 0;
          default:
            fail(ErrorCode.UNKNOWN_FN, `Unknown operator "${op}"`);
        }
      }
    }
  };

  const walk = (node: Ast, depth: number): Value => {
    switch (node.k) {
      case 'lit':
        return node.v;

      case 'prop':
        return propagate(readProperty(node.id, depth));

      case 'un': {
        const value = propagate(walk(node.a, depth));
        return node.op === 'neg' ? snapNumber(-toNumber(value)) : !toBoolean(value);
      }

      case 'bin': {
        // `and`/`or` short-circuit so a failing right side stays unevaluated.
        if (node.op === 'and' || node.op === 'or') {
          const left = toBoolean(propagate(walk(node.l, depth)));
          if (node.op === 'and' && !left) return false;
          if (node.op === 'or' && left) return true;
          return toBoolean(propagate(walk(node.r, depth)));
        }
        return binary(
          node.op,
          propagate(walk(node.l, depth)),
          propagate(walk(node.r, depth)),
        );
      }

      case 'call': {
        const fn = ctx.registry.get(node.fn.toUpperCase());
        if (!fn) fail(ErrorCode.UNKNOWN_FN, `Unknown function "${node.fn}"`);
        if (fn.lazy) {
          return fn.lazy(node.args, (child) => walk(child, depth), fnCtx);
        }
        if (!fn.call) fail(ErrorCode.UNKNOWN_FN, `${fn.name} cannot be evaluated`);
        const args = node.args.map((arg) => propagate(walk(arg, depth)));
        return fn.call(args, fnCtx);
      }
    }
  };

  try {
    const result = walk(ast, ctx.depth ?? 0);
    return toStored(result);
  } catch (err) {
    if (err instanceof FormulaEvalError) return errorCell(err.code, err.message);
    if (err instanceof RangeError) {
      return errorCell(ErrorCode.DEPTH, 'Formula is too deeply nested');
    }
    return errorCell(
      ErrorCode.VALUE,
      err instanceof Error ? err.message : 'Formula failed',
    );
  }
}

/** Convenience for callers that only have a date-ish value. */
export function asDate(value: Value): FormulaDate | null {
  return toDate(value);
}
