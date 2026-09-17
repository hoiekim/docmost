import { ErrorCode, fail } from '../errors';
import type { FormulaFn } from '../types';
import { isBlank, toBoolean, toDate, toNumber, toText } from '../value';

export const coercionFunctions: FormulaFn[] = [
  {
    name: 'TONUMBER',
    category: 'coercion',
    doc: 'Reads the value as a number.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'number',
    call: (args) => toNumber(args[0]),
  },
  {
    name: 'TOTEXT',
    category: 'coercion',
    doc: 'Renders the value as text.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'string',
    call: (args) => toText(args[0]),
  },
  {
    name: 'TOBOOLEAN',
    category: 'coercion',
    doc: 'Reads the value as true or false.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'boolean',
    call: (args) => toBoolean(args[0]),
  },
  {
    name: 'TODATE',
    category: 'coercion',
    doc: 'Reads the value as a date.',
    arity: { min: 1, max: 1 },
    paramTypes: ['any'],
    resultType: 'date',
    call: (args) => {
      if (isBlank(args[0])) return null;
      const date = toDate(args[0]);
      if (!date) fail(ErrorCode.VALUE, `Cannot read "${toText(args[0])}" as a date`);
      return date;
    },
  },
];
