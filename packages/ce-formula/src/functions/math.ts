import { ErrorCode, fail } from '../errors';
import type { FormulaFn, Value } from '../types';
import { snapNumber, toNumber } from '../value';

function nums(args: Value[]): number[] {
  return args.map(toNumber);
}

/** Round half away from zero at `digits` decimals, like a spreadsheet. */
function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  const scaled = snapNumber(value * factor);
  return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / factor;
}

function digitsOf(args: Value[], index: number): number {
  const raw = args[index];
  if (raw === undefined || raw === null) return 0;
  const n = toNumber(raw);
  if (!Number.isFinite(n)) fail(ErrorCode.VALUE, 'Digits must be a whole number');
  return Math.trunc(n);
}

export const mathFunctions: FormulaFn[] = [
  {
    name: 'SUM',
    category: 'math',
    doc: 'Adds every argument together.',
    arity: { min: 1, max: null },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => snapNumber(nums(args).reduce((a, b) => a + b, 0)),
  },
  {
    name: 'AVERAGE',
    category: 'math',
    doc: 'Mean of the arguments.',
    arity: { min: 1, max: null },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => {
      const values = nums(args);
      return snapNumber(values.reduce((a, b) => a + b, 0) / values.length);
    },
  },
  {
    name: 'MIN',
    category: 'math',
    doc: 'Smallest of the arguments.',
    arity: { min: 1, max: null },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.min(...nums(args)),
  },
  {
    name: 'MAX',
    category: 'math',
    doc: 'Largest of the arguments.',
    arity: { min: 1, max: null },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.max(...nums(args)),
  },
  {
    name: 'ABS',
    category: 'math',
    doc: 'Absolute value.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.abs(toNumber(args[0])),
  },
  {
    name: 'ROUND',
    category: 'math',
    doc: 'Rounds to the given number of decimal places (default 0).',
    arity: { min: 1, max: 2 },
    paramTypes: ['number', 'number'],
    resultType: 'number',
    call: (args) => roundTo(toNumber(args[0]), digitsOf(args, 1)),
  },
  {
    name: 'ROUNDUP',
    category: 'math',
    doc: 'Rounds away from zero to the given number of decimal places.',
    arity: { min: 1, max: 2 },
    paramTypes: ['number', 'number'],
    resultType: 'number',
    call: (args) => {
      const factor = 10 ** digitsOf(args, 1);
      const scaled = snapNumber(toNumber(args[0]) * factor);
      return (scaled < 0 ? -Math.ceil(-scaled) : Math.ceil(scaled)) / factor;
    },
  },
  {
    name: 'ROUNDDOWN',
    category: 'math',
    doc: 'Rounds toward zero to the given number of decimal places.',
    arity: { min: 1, max: 2 },
    paramTypes: ['number', 'number'],
    resultType: 'number',
    call: (args) => {
      const factor = 10 ** digitsOf(args, 1);
      const scaled = snapNumber(toNumber(args[0]) * factor);
      return Math.trunc(scaled) / factor;
    },
  },
  {
    name: 'FLOOR',
    category: 'math',
    doc: 'Largest whole number less than or equal to the value.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.floor(toNumber(args[0])),
  },
  {
    name: 'CEILING',
    category: 'math',
    doc: 'Smallest whole number greater than or equal to the value.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.ceil(toNumber(args[0])),
  },
  {
    name: 'TRUNC',
    category: 'math',
    doc: 'Drops the fractional part.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.trunc(toNumber(args[0])),
  },
  {
    name: 'MOD',
    category: 'math',
    doc: 'Remainder after dividing the first argument by the second.',
    arity: { min: 2, max: 2 },
    paramTypes: ['number', 'number'],
    resultType: 'number',
    call: (args) => {
      const divisor = toNumber(args[1]);
      if (divisor === 0) fail(ErrorCode.DIV_BY_ZERO, 'Cannot take a remainder by zero');
      return snapNumber(toNumber(args[0]) % divisor);
    },
  },
  {
    name: 'POWER',
    category: 'math',
    doc: 'Raises the first argument to the power of the second.',
    arity: { min: 2, max: 2 },
    paramTypes: ['number', 'number'],
    resultType: 'number',
    call: (args) => snapNumber(toNumber(args[0]) ** toNumber(args[1])),
  },
  {
    name: 'SQRT',
    category: 'math',
    doc: 'Square root.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => {
      const n = toNumber(args[0]);
      if (n < 0) fail(ErrorCode.VALUE, 'Cannot take the square root of a negative number');
      return snapNumber(Math.sqrt(n));
    },
  },
  {
    name: 'SIGN',
    category: 'math',
    doc: 'Returns -1, 0 or 1 depending on the sign.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => Math.sign(toNumber(args[0])),
  },
  {
    name: 'EXP',
    category: 'math',
    doc: 'e raised to the given power.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => snapNumber(Math.exp(toNumber(args[0]))),
  },
  {
    name: 'LN',
    category: 'math',
    doc: 'Natural logarithm.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => {
      const n = toNumber(args[0]);
      if (n <= 0) fail(ErrorCode.VALUE, 'LN needs a positive number');
      return snapNumber(Math.log(n));
    },
  },
  {
    name: 'LOG10',
    category: 'math',
    doc: 'Base-10 logarithm.',
    arity: { min: 1, max: 1 },
    paramTypes: ['number'],
    resultType: 'number',
    call: (args) => {
      const n = toNumber(args[0]);
      if (n <= 0) fail(ErrorCode.VALUE, 'LOG10 needs a positive number');
      return snapNumber(Math.log10(n));
    },
  },
];
