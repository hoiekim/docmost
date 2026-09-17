import type { FormulaFn, FormulaRegistry } from '../types';
import { coercionFunctions } from './coercion';
import { dateFunctions } from './date';
import { logicFunctions } from './logic';
import { mathFunctions } from './math';
import { stringFunctions } from './string';

const ALL: FormulaFn[] = [
  ...logicFunctions,
  ...mathFunctions,
  ...stringFunctions,
  ...dateFunctions,
  ...coercionFunctions,
];

function build(fns: FormulaFn[]): FormulaRegistry {
  const map = new Map<string, FormulaFn>();
  for (const fn of fns) {
    if (map.has(fn.name)) {
      throw new Error(`Duplicate formula function: ${fn.name}`);
    }
    map.set(fn.name, fn);
  }
  return map;
}

/**
 * Every callable function, keyed by upper-case name. The formula editor reads
 * this to build its palette, so `doc`, `category` and `arity` are user-facing.
 */
export const registry: FormulaRegistry = build(ALL);
