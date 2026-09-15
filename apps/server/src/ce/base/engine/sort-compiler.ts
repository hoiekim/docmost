import { BadRequestException } from '@nestjs/common';
import { RawBuilder, sql } from 'kysely';
import { ViewSortConfig } from '../types/base.types';
import { columnExpr, columnKind, PropLike } from './column-expr';

export type CompiledSort = {
  propertyId: string;
  direction: 'asc' | 'desc';
  /** ORDER BY fragment including direction and NULLS LAST. */
  orderBy: RawBuilder<unknown>;
};

export function compileSorts(
  sorts: ViewSortConfig[] | undefined,
  propsById: ReadonlyMap<string, PropLike>,
): CompiledSort[] {
  if (!sorts || sorts.length === 0) return [];
  const seen = new Set<string>();
  const out: CompiledSort[] = [];
  for (const s of sorts) {
    if (seen.has(s.propertyId)) continue;
    seen.add(s.propertyId);
    const prop = propsById.get(s.propertyId);
    if (!prop) {
      throw new BadRequestException(
        `Sort references unknown property ${s.propertyId}`,
      );
    }
    let expr = columnExpr(prop);
    if (columnKind(prop) === 'array') {
      // Sort multi-valued cells by their JSON text; good enough for grouping.
      expr = sql`${expr}::text`;
    }
    const orderBy =
      s.direction === 'desc'
        ? sql`${expr} desc nulls last`
        : sql`${expr} asc nulls last`;
    out.push({ propertyId: s.propertyId, direction: s.direction, orderBy });
  }
  return out;
}
