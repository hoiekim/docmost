/**
 * Dependency graph over a base's formula properties.
 *
 * Edges come from `typeOptions.dependencies`, the property ids resolve() found
 * in each formula's source. Two questions are asked of it: would saving this
 * formula create a cycle, and which formulas must be recomputed after some
 * properties changed.
 */

export type GraphProperty = {
  id: string;
  type: string;
  typeOptions?: unknown;
};

function dependenciesOf(prop: GraphProperty): string[] {
  if (prop.type !== 'formula') return [];
  const deps = (prop.typeOptions as { dependencies?: unknown } | undefined)
    ?.dependencies;
  if (!Array.isArray(deps)) return [];
  return deps.filter((id): id is string => typeof id === 'string');
}

export class BaseFormulaGraph {
  /** formula id → ids it reads */
  private readonly forward = new Map<string, string[]>();
  /** property id → formula ids that read it */
  private readonly reverse = new Map<string, string[]>();

  constructor(properties: readonly GraphProperty[]) {
    for (const prop of properties) {
      if (prop.type !== 'formula') continue;
      const deps = dependenciesOf(prop);
      this.forward.set(prop.id, deps);
      for (const dep of deps) {
        const bucket = this.reverse.get(dep);
        if (bucket) bucket.push(prop.id);
        else this.reverse.set(dep, [prop.id]);
      }
    }
  }

  /**
   * True when `candidate` can reach itself by following dependencies. The
   * candidate is usually a not-yet-saved property, so its edges are read from
   * the object passed in rather than from the graph.
   */
  detectCycle(candidate: GraphProperty): boolean {
    const start = dependenciesOf(candidate);
    if (start.length === 0) return false;

    const seen = new Set<string>();
    const stack = [...start];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (id === candidate.id) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const next = this.forward.get(id);
      if (next) stack.push(...next);
    }
    return false;
  }

  /**
   * Formula ids that read any of `changedIds`, directly or through other
   * formulas. The changed ids themselves are not included unless a cycle makes
   * one genuinely reachable from another; callers add them back when the
   * change was to the formula's own definition.
   */
  affectedFormulas(changedIds: readonly string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const stack = [...changedIds];

    while (stack.length > 0) {
      const id = stack.pop() as string;
      const dependents = this.reverse.get(id);
      if (!dependents) continue;
      for (const dependent of dependents) {
        if (seen.has(dependent)) continue;
        seen.add(dependent);
        out.push(dependent);
        stack.push(dependent);
      }
    }

    return out.filter((id) => !changedIds.includes(id));
  }

  /** Formula ids in an order where dependencies come first. */
  evaluationOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string, path: Set<string>) => {
      if (visited.has(id) || path.has(id)) return;
      path.add(id);
      for (const dep of this.forward.get(id) ?? []) {
        if (this.forward.has(dep)) visit(dep, path);
      }
      path.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.forward.keys()) visit(id, new Set());
    return order;
  }
}
