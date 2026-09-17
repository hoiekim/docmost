import { FormulaParseError } from './errors';
import type {
  Ast,
  FormulaParamType,
  FormulaRegistry,
  FormulaResultType,
} from './types';

export type TypecheckResult = { resultType: FormulaResultType };

/**
 * What each declared parameter type will accept. Kept deliberately permissive
 * where the runtime coerces anyway (anything renders to text; numbers are
 * truthy), and strict where a coercion would just hide a mistake (text into
 * arithmetic).
 */
const ACCEPTS: Record<FormulaParamType, ReadonlySet<FormulaResultType> | null> = {
  any: null,
  string: null,
  number: new Set<FormulaResultType>(['number', 'boolean', 'null']),
  boolean: new Set<FormulaResultType>(['number', 'boolean', 'string', 'null']),
  date: new Set<FormulaResultType>(['date', 'string', 'null']),
  null: null,
};

function accepts(param: FormulaParamType, arg: FormulaResultType): boolean {
  if (arg === 'null') return true;
  const allowed = ACCEPTS[param];
  return allowed === null ? true : allowed.has(arg);
}

/** Least upper bound of two branch types, used by IF/SWITCH/COALESCE. */
export function unifyTypes(
  a: FormulaResultType,
  b: FormulaResultType,
): FormulaResultType {
  if (a === b) return a;
  if (a === 'null') return b;
  if (b === 'null') return a;
  return 'string';
}

function describeArity(min: number, max: number | null): string {
  if (max === null) return `at least ${min}`;
  if (min === max) return `exactly ${min}`;
  return `between ${min} and ${max}`;
}

const ARITHMETIC = new Set(['+', '-', '*', '/', '%', '^']);
const COMPARISON = new Set(['<', '<=', '>', '>=']);

/**
 * Infer the result type of a resolved AST, rejecting unknown functions, wrong
 * argument counts and argument types that cannot be coerced. `propertyTypes`
 * maps property id to the type that property contributes; a missing id is
 * treated as `null` (the property was deleted).
 */
export function typecheck(
  ast: Ast,
  propertyTypes: ReadonlyMap<string, FormulaResultType>,
  registry: FormulaRegistry,
): TypecheckResult {
  const walk = (node: Ast): FormulaResultType => {
    switch (node.k) {
      case 'lit':
        if (node.v === null) return 'null';
        if (typeof node.v === 'number') return 'number';
        if (typeof node.v === 'boolean') return 'boolean';
        return 'string';

      case 'prop':
        return propertyTypes.get(node.id) ?? 'null';

      case 'un':
        walk(node.a);
        return node.op === 'neg' ? 'number' : 'boolean';

      case 'bin': {
        const left = walk(node.l);
        const right = walk(node.r);
        if (ARITHMETIC.has(node.op)) {
          for (const [type, side] of [
            [left, 'left'],
            [right, 'right'],
          ] as const) {
            if (!accepts('number', type)) {
              throw FormulaParseError.of(
                `The ${side} side of "${node.op}" must be a number, not ${type}`,
              );
            }
          }
          return 'number';
        }
        if (node.op === '&') return 'string';
        if (COMPARISON.has(node.op)) {
          if (
            (left === 'date') !== (right === 'date') &&
            left !== 'null' &&
            right !== 'null' &&
            left !== 'string' &&
            right !== 'string'
          ) {
            throw FormulaParseError.of(
              `Cannot compare ${left} with ${right}`,
            );
          }
          return 'boolean';
        }
        return 'boolean';
      }

      case 'call': {
        const fn = registry.get(node.fn.toUpperCase());
        if (!fn) {
          throw FormulaParseError.of(`Unknown function "${node.fn}"`);
        }
        const { min, max } = fn.arity;
        if (node.args.length < min || (max !== null && node.args.length > max)) {
          throw FormulaParseError.of(
            `${fn.name} takes ${describeArity(min, max)} argument${
              max === 1 && min === 1 ? '' : 's'
            }, but got ${node.args.length}`,
          );
        }
        const argTypes = node.args.map(walk);
        argTypes.forEach((argType, index) => {
          const declared =
            fn.paramTypes[Math.min(index, fn.paramTypes.length - 1)] ?? 'any';
          if (!accepts(declared, argType)) {
            throw FormulaParseError.of(
              `${fn.name} argument ${index + 1} must be ${declared}, not ${argType}`,
            );
          }
        });
        return typeof fn.resultType === 'function'
          ? fn.resultType(argTypes)
          : fn.resultType;
      }
    }
  };

  return { resultType: walk(ast) };
}
