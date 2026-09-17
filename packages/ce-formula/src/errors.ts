import type { ErrorCell, Span } from './types';

export type ParseError = { message: string; span?: Span };

/**
 * Thrown by parseRaw/resolve/typecheck. Carries every diagnostic found, with
 * the first one being the most useful to show; callers surface `errors[0]`.
 */
export class FormulaParseError extends Error {
  readonly errors: ParseError[];

  constructor(errors: ParseError[]) {
    super(errors[0]?.message ?? 'Invalid formula');
    this.name = 'FormulaParseError';
    this.errors = errors;
    Object.setPrototypeOf(this, FormulaParseError.prototype);
  }

  static of(message: string, span?: Span): FormulaParseError {
    return new FormulaParseError([{ message, span }]);
  }
}

/**
 * Error codes an evaluated cell can carry. The client renders every one of
 * them as #ERROR with `msg` as the tooltip, so these are for debugging and
 * for the names CE already uses in comments and tests.
 */
export const ErrorCode = {
  TYPE: 'TYPE',
  VALUE: 'VALUE',
  DIV_BY_ZERO: 'DIV_BY_ZERO',
  DEPTH: 'DEPTH',
  CYCLE: 'CYCLE',
  UNKNOWN_FN: 'UNKNOWN_FN',
  MISSING_PROP: 'MISSING_PROP',
} as const;

export type ErrorCodeKey = (typeof ErrorCode)[keyof typeof ErrorCode];

export function errorCell(code: ErrorCodeKey, msg: string): ErrorCell {
  return { __err: code, msg, v: 1 };
}

/**
 * True for a cell value that represents a failed formula. Mirrors
 * isFormulaError() in apps/client/src/ce/base/model/cell-read.ts.
 */
export function isErrorCell(value: unknown): value is ErrorCell {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ErrorCell).__err === 'string'
  );
}

/**
 * Raised inside function implementations to abort the current cell. eval.ts
 * converts it to an ErrorCell; it never escapes evaluate().
 */
export class FormulaEvalError extends Error {
  constructor(
    readonly code: ErrorCodeKey,
    message: string,
  ) {
    super(message);
    this.name = 'FormulaEvalError';
    Object.setPrototypeOf(this, FormulaEvalError.prototype);
  }
}

export function fail(code: ErrorCodeKey, message: string): never {
  throw new FormulaEvalError(code, message);
}
