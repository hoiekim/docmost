import { ErrorCode, fail } from '../errors';
import type { FormulaFn, Value } from '../types';
import { toNumber, toText } from '../value';

/** Clamp a user-supplied length to something safe to allocate. */
const MAX_REPEAT = 10_000;

function count(args: Value[], index: number, fallback: number): number {
  const raw = args[index];
  if (raw === undefined || raw === null) return fallback;
  const n = Math.trunc(toNumber(raw));
  if (n < 0) fail(ErrorCode.VALUE, 'Length cannot be negative');
  return n;
}

export const stringFunctions: FormulaFn[] = [
  {
    name: 'CONCAT',
    category: 'string',
    doc: 'Joins every argument into one piece of text.',
    arity: { min: 1, max: null },
    paramTypes: ['string'],
    resultType: 'string',
    call: (args) => args.map(toText).join(''),
  },
  {
    name: 'JOIN',
    category: 'string',
    doc: 'Joins the arguments after the first, separated by the first argument.',
    arity: { min: 2, max: null },
    paramTypes: ['string'],
    resultType: 'string',
    call: (args) => args.slice(1).map(toText).join(toText(args[0])),
  },
  {
    name: 'LEN',
    category: 'string',
    doc: 'Number of characters.',
    arity: { min: 1, max: 1 },
    paramTypes: ['string'],
    resultType: 'number',
    call: (args) => toText(args[0]).length,
  },
  {
    name: 'LOWER',
    category: 'string',
    doc: 'Converts text to lower case.',
    arity: { min: 1, max: 1 },
    paramTypes: ['string'],
    resultType: 'string',
    call: (args) => toText(args[0]).toLowerCase(),
  },
  {
    name: 'UPPER',
    category: 'string',
    doc: 'Converts text to upper case.',
    arity: { min: 1, max: 1 },
    paramTypes: ['string'],
    resultType: 'string',
    call: (args) => toText(args[0]).toUpperCase(),
  },
  {
    name: 'TRIM',
    category: 'string',
    doc: 'Removes leading and trailing whitespace.',
    arity: { min: 1, max: 1 },
    paramTypes: ['string'],
    resultType: 'string',
    call: (args) => toText(args[0]).trim(),
  },
  {
    name: 'LEFT',
    category: 'string',
    doc: 'First N characters (default 1).',
    arity: { min: 1, max: 2 },
    paramTypes: ['string', 'number'],
    resultType: 'string',
    call: (args) => toText(args[0]).slice(0, count(args, 1, 1)),
  },
  {
    name: 'RIGHT',
    category: 'string',
    doc: 'Last N characters (default 1).',
    arity: { min: 1, max: 2 },
    paramTypes: ['string', 'number'],
    resultType: 'string',
    call: (args) => {
      const n = count(args, 1, 1);
      const text = toText(args[0]);
      return n === 0 ? '' : text.slice(Math.max(0, text.length - n));
    },
  },
  {
    name: 'MID',
    category: 'string',
    doc: 'N characters starting at a 1-based position.',
    arity: { min: 2, max: 3 },
    paramTypes: ['string', 'number', 'number'],
    resultType: 'string',
    call: (args) => {
      const start = Math.trunc(toNumber(args[1]));
      if (start < 1) fail(ErrorCode.VALUE, 'MID starts counting at 1');
      const text = toText(args[0]);
      const length = count(args, 2, text.length);
      return text.slice(start - 1, start - 1 + length);
    },
  },
  {
    name: 'FIND',
    category: 'string',
    doc: 'Position of the second argument inside the first, or 0 when absent.',
    arity: { min: 2, max: 2 },
    paramTypes: ['string', 'string'],
    resultType: 'number',
    call: (args) => toText(args[0]).indexOf(toText(args[1])) + 1,
  },
  {
    name: 'CONTAINS',
    category: 'string',
    doc: 'True when the first argument contains the second.',
    arity: { min: 2, max: 2 },
    paramTypes: ['string', 'string'],
    resultType: 'boolean',
    call: (args) => toText(args[0]).includes(toText(args[1])),
  },
  {
    name: 'STARTSWITH',
    category: 'string',
    doc: 'True when the text starts with the given prefix.',
    arity: { min: 2, max: 2 },
    paramTypes: ['string', 'string'],
    resultType: 'boolean',
    call: (args) => toText(args[0]).startsWith(toText(args[1])),
  },
  {
    name: 'ENDSWITH',
    category: 'string',
    doc: 'True when the text ends with the given suffix.',
    arity: { min: 2, max: 2 },
    paramTypes: ['string', 'string'],
    resultType: 'boolean',
    call: (args) => toText(args[0]).endsWith(toText(args[1])),
  },
  {
    name: 'SUBSTITUTE',
    category: 'string',
    doc: 'Replaces every occurrence of the second argument with the third.',
    arity: { min: 3, max: 3 },
    paramTypes: ['string', 'string', 'string'],
    resultType: 'string',
    call: (args) => {
      const needle = toText(args[1]);
      if (needle === '') return toText(args[0]);
      return toText(args[0]).split(needle).join(toText(args[2]));
    },
  },
  {
    name: 'REPLACE',
    category: 'string',
    doc: 'Replaces N characters at a 1-based position with new text.',
    arity: { min: 4, max: 4 },
    paramTypes: ['string', 'number', 'number', 'string'],
    resultType: 'string',
    call: (args) => {
      const text = toText(args[0]);
      const start = Math.trunc(toNumber(args[1]));
      if (start < 1) fail(ErrorCode.VALUE, 'REPLACE starts counting at 1');
      const length = count(args, 2, 0);
      return text.slice(0, start - 1) + toText(args[3]) + text.slice(start - 1 + length);
    },
  },
  {
    name: 'REPEAT',
    category: 'string',
    doc: 'Repeats text N times.',
    arity: { min: 2, max: 2 },
    paramTypes: ['string', 'number'],
    resultType: 'string',
    call: (args) => {
      const times = count(args, 1, 0);
      const text = toText(args[0]);
      if (text.length * times > MAX_REPEAT) {
        fail(ErrorCode.VALUE, 'REPEAT would produce too much text');
      }
      return text.repeat(times);
    },
  },
  {
    name: 'SPLITPART',
    category: 'string',
    doc: 'Splits text by a separator and returns the 1-based part.',
    arity: { min: 3, max: 3 },
    paramTypes: ['string', 'string', 'number'],
    resultType: 'string',
    call: (args) => {
      const index = Math.trunc(toNumber(args[2]));
      if (index < 1) fail(ErrorCode.VALUE, 'SPLITPART starts counting at 1');
      return toText(args[0]).split(toText(args[1]))[index - 1] ?? '';
    },
  },
];
