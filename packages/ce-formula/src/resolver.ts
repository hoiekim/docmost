import { FormulaParseError, type ParseError } from './errors';
import type { Ast, RawAst } from './types';

export type ResolveResult = {
  /** Storage-shaped AST: no spans, property names replaced by ids. */
  ast: Ast;
  /** Property ids referenced, in first-seen order, deduplicated. */
  dependencies: string[];
};

/**
 * Bind prop("Name") references to property ids. Names are matched
 * case-insensitively after trimming, because that is how people retype them,
 * but an exact match always wins so two properties differing only in case
 * stay addressable.
 */
export function resolve(
  raw: RawAst,
  nameToId: ReadonlyMap<string, string>,
): ResolveResult {
  const lowered = new Map<string, string[]>();
  for (const [name, id] of nameToId) {
    const key = name.trim().toLowerCase();
    const bucket = lowered.get(key);
    if (bucket) bucket.push(id);
    else lowered.set(key, [id]);
  }

  const errors: ParseError[] = [];
  const dependencies: string[] = [];
  const seen = new Set<string>();

  const lookup = (name: string): string | null => {
    const exact = nameToId.get(name);
    if (exact) return exact;
    const bucket = lowered.get(name.trim().toLowerCase());
    if (!bucket || bucket.length === 0) return null;
    return bucket[0];
  };

  const walk = (node: RawAst): Ast => {
    switch (node.k) {
      case 'lit':
        return { k: 'lit', v: node.v };
      case 'name': {
        const id = lookup(node.name);
        if (!id) {
          errors.push({
            message: `No property named "${node.name}"`,
            span: node.span,
          });
          return { k: 'lit', v: null };
        }
        if (!seen.has(id)) {
          seen.add(id);
          dependencies.push(id);
        }
        return { k: 'prop', id };
      }
      case 'call':
        return { k: 'call', fn: node.fn, args: node.args.map(walk) };
      case 'un':
        return { k: 'un', op: node.op, a: walk(node.a) };
      case 'bin':
        return { k: 'bin', op: node.op, l: walk(node.l), r: walk(node.r) };
    }
  };

  const ast = walk(raw);
  if (errors.length > 0) throw new FormulaParseError(errors);
  return { ast, dependencies };
}
