import { ErrorCode, FormulaEvalError, fail, isErrorCell } from '../errors';
import type { FormulaFn, FormulaResultType, Value } from '../types';
import { isBlank, toBoolean, valuesEqual } from '../value';
import { unifyTypes } from '../typecheck';

/** Result type of the branches at the given argument positions. */
function branchType(
  args: FormulaResultType[],
  positions: number[],
): FormulaResultType {
  const types = positions
    .map((i) => args[i])
    .filter((t): t is FormulaResultType => t !== undefined);
  if (types.length === 0) return 'null';
  return types.reduce(unifyTypes);
}

export const logicFunctions: FormulaFn[] = [
  {
    name: 'IF',
    category: 'logic',
    doc: 'Returns the second argument when the condition is true, otherwise the third.',
    arity: { min: 2, max: 3 },
    paramTypes: ['boolean', 'any', 'any'],
    resultType: (args) => branchType(args, [1, 2]),
    lazy: (args, evalNode) =>
      toBoolean(evalNode(args[0]))
        ? evalNode(args[1])
        : args[2] !== undefined
          ? evalNode(args[2])
          : null,
  },
  {
    name: 'IFS',
    category: 'logic',
    doc: 'Takes condition/value pairs and returns the value of the first true condition.',
    arity: { min: 2, max: null },
    paramTypes: ['any'],
    resultType: (args) => branchType(args, args.map((_, i) => i).filter((i) => i % 2 === 1)),
    lazy: (args, evalNode) => {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (toBoolean(evalNode(args[i]))) return evalNode(args[i + 1]);
      }
      // An odd trailing argument acts as the fallback.
      return args.length % 2 === 1 ? evalNode(args[args.length - 1]) : null;
    },
  },
  {
    name: 'SWITCH',
    category: 'logic',
    doc: 'Compares the first argument against match/value pairs, with an optional final default.',
    arity: { min: 3, max: null },
    paramTypes: ['any'],
    resultType: (args) =>
      branchType(args, args.map((_, i) => i).filter((i) => i > 0 && i % 2 === 0)),
    lazy: (args, evalNode) => {
      const subject = evalNode(args[0]);
      for (let i = 1; i + 1 < args.length; i += 2) {
        if (valuesEqual(subject, evalNode(args[i]))) return evalNode(args[i + 1]);
      }
      return args.length % 2 === 0 ? evalNode(args[args.length - 1]) : null;
    },
  },
  {
    name: 'AND',
    category: 'logic',
    doc: 'True when every argument is true.',
    arity: { min: 1, max: null },
    paramTypes: ['boolean'],
    resultType: 'boolean',
    lazy: (args, evalNode) => {
      for (const arg of args) {
        if (!toBoolean(evalNode(arg))) return false;
      }
      return true;
    },
  },
  {
    name: 'OR',
    category: 'logic',
    doc: 'True when at least one argument is true.',
    arity: { min: 1, max: null },
    paramTypes: ['boolean'],
    resultType: 'boolean',
    lazy: (args, evalNode) => {
      for (const arg of args) {
        if (toBoolean(evalNode(arg))) return true;
      }
      return false;
    },
  },
  {
    name: 'NOT',
    category: 'logic',
    doc: 'Inverts a true/false value.',
    arity: { min: 1, max: 1 },
    paramTypes: ['boolean'],
    resultType: 'boolean',
    call: (args) => !toBoolean(args[0]),
  },
  {
    name: 'ISBLANK',
    category: 'logic',
    doc: 'True when the value is empty.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'boolean',
    call: (args) => isBlank(args[0]),
  },
  {
    name: 'ISERROR',
    category: 'logic',
    doc: 'True when evaluating the argument fails.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'boolean',
    lazy: (args, evalNode) => {
      try {
        return isErrorCell(evalNode(args[0]));
      } catch (err) {
        if (err instanceof FormulaEvalError) return true;
        throw err;
      }
    },
  },
  {
    name: 'IFERROR',
    category: 'logic',
    doc: 'Returns the first argument, or the second when the first fails.',
    arity: { min: 2, max: 2 },
    paramTypes: ['any', 'any'],
    resultType: (args) => branchType(args, [0, 1]),
    lazy: (args, evalNode) => {
      try {
        const value = evalNode(args[0]);
        return isErrorCell(value) ? evalNode(args[1]) : value;
      } catch (err) {
        if (err instanceof FormulaEvalError) return evalNode(args[1]);
        throw err;
      }
    },
  },
  {
    name: 'COALESCE',
    category: 'logic',
    doc: 'Returns the first argument that is not empty.',
    arity: { min: 1, max: null },
    paramTypes: ['any'],
    resultType: (args) => (args.length ? args.reduce(unifyTypes) : 'null'),
    lazy: (args, evalNode) => {
      for (const arg of args) {
        const value = evalNode(arg);
        if (!isBlank(value)) return value;
      }
      return null;
    },
  },
  {
    name: 'ERROR',
    category: 'logic',
    doc: 'Fails the cell with a custom message.',
    arity: { min: 0, max: 1 },
    paramTypes: ['string'],
    resultType: 'null',
    call: (args: Value[]) =>
      fail(
        ErrorCode.VALUE,
        typeof args[0] === 'string' && args[0] ? args[0] : 'Formula raised an error',
      ),
  },
];
