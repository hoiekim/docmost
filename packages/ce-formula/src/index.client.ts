/**
 * Browser entry point: everything needed to write, validate and describe a
 * formula, without the evaluator (the server computes cell values).
 */

export {
  AST_VERSION,
  DEFAULT_MAX_DEPTH,
  FormulaDate,
  MAX_FORMULA_SOURCE_LENGTH,
  type Ast,
  type BinaryOp,
  type ErrorCell,
  type FormulaCategory,
  type FormulaFn,
  type FormulaParamType,
  type FormulaRegistry,
  type FormulaResultType,
  type LiteralValue,
  type RawAst,
  type Span,
  type StoredValue,
  type UnaryOp,
  type Value,
} from './types';

export {
  ErrorCode,
  FormulaParseError,
  isErrorCell,
  type ErrorCodeKey,
  type ParseError,
} from './errors';

export { parseRaw } from './parser';
export { resolve, type ResolveResult } from './resolver';
export { typecheck, unifyTypes, type TypecheckResult } from './typecheck';
export { registry } from './functions/registry';
export { BaseFormulaGraph, type GraphProperty } from './graph';
export {
  compareValues,
  dateToString,
  formatNumber,
  isBlank,
  snapNumber,
  toBoolean,
  toDate,
  toNumber,
  toText,
  valuesEqual,
  valueToString,
} from './value';
