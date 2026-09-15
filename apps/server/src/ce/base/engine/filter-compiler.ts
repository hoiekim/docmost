import { BadRequestException } from '@nestjs/common';
import { RawBuilder, sql, SqlBool } from 'kysely';
import {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
} from '../types/base.types';
import { columnExpr, columnKind, ColumnKind, PropLike } from './column-expr';
import { resolveDateFilter } from './date-presets';

export type FilterSql = RawBuilder<SqlBool>;

const NO_VALUE_OPS: ReadonlySet<FilterOperator> = new Set([
  'isEmpty',
  'isNotEmpty',
]);

/**
 * Compile a client FilterNode into a single SQL boolean expression over
 * base_rows. Returns null when the tree contains no conditions.
 * Throws BadRequestException on unknown properties or type/operator mismatches.
 */
export function compileFilter(
  node: FilterNode | null | undefined,
  propsById: ReadonlyMap<string, PropLike>,
  now: Date = new Date(),
): FilterSql | null {
  if (!node) return null;
  if (isGroup(node)) return compileGroup(node, propsById, now);
  return compileCondition(node, propsById, now);
}

function isGroup(node: FilterNode): node is FilterGroup {
  return (
    (node as FilterGroup).children !== undefined &&
    ((node as FilterGroup).op === 'and' || (node as FilterGroup).op === 'or')
  );
}

function compileGroup(
  group: FilterGroup,
  propsById: ReadonlyMap<string, PropLike>,
  now: Date,
): FilterSql | null {
  const parts: FilterSql[] = [];
  for (const child of group.children ?? []) {
    const compiled = isGroup(child)
      ? compileGroup(child, propsById, now)
      : compileCondition(child, propsById, now);
    if (compiled) parts.push(compiled);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const joiner = group.op === 'or' ? sql` or ` : sql` and `;
  return sql<SqlBool>`(${sql.join(parts, joiner)})`;
}

function compileCondition(
  cond: FilterCondition,
  propsById: ReadonlyMap<string, PropLike>,
  now: Date,
): FilterSql {
  const prop = propsById.get(cond.propertyId);
  if (!prop) {
    throw new BadRequestException(
      `Filter references unknown property ${cond.propertyId}`,
    );
  }
  const op = cond.op;
  const kind = columnKind(prop);
  const expr = columnExpr(prop);

  if (op === 'isEmpty') return isEmpty(expr, kind);
  if (op === 'isNotEmpty') return sql<SqlBool>`not ${isEmpty(expr, kind)}`;

  if (NO_VALUE_OPS.has(op)) {
    throw new BadRequestException(`Operator ${op} takes no value`);
  }

  switch (kind) {
    case 'text':
      return compileText(expr, op, cond.value);
    case 'number':
      return compileNumber(expr, op, cond.value);
    case 'bool':
      return compileBool(expr, op, cond.value);
    case 'timestamp':
      return compileTimestamp(expr, op, cond.value, now);
    case 'array':
      return compileArray(expr, op, cond.value);
  }
}

function isEmpty(expr: RawBuilder<unknown>, kind: ColumnKind): FilterSql {
  switch (kind) {
    case 'text':
      return sql<SqlBool>`(${expr} is null or ${expr} = '')`;
    case 'array':
      return sql<SqlBool>`coalesce(jsonb_array_length(${expr}), 0) = 0`;
    default:
      return sql<SqlBool>`${expr} is null`;
  }
}

function unsupported(op: FilterOperator, kind: ColumnKind): never {
  throw new BadRequestException(
    `Operator ${op} is not supported for ${kind} properties`,
  );
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v !== '');
  }
  if (typeof value === 'string' && value !== '') return [value];
  return [];
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function compileText(
  expr: RawBuilder<unknown>,
  op: FilterOperator,
  value: unknown,
): FilterSql {
  const str = value == null ? '' : String(value);
  switch (op) {
    case 'eq':
      return sql<SqlBool>`${expr} = ${str}`;
    case 'neq':
      return sql<SqlBool>`${expr} is distinct from ${str}`;
    case 'contains':
      return sql<SqlBool>`${expr} ilike ${'%' + escapeLike(str) + '%'}`;
    case 'ncontains':
      return sql<SqlBool>`not coalesce(${expr} ilike ${'%' + escapeLike(str) + '%'}, false)`;
    case 'startsWith':
      return sql<SqlBool>`${expr} ilike ${escapeLike(str) + '%'}`;
    case 'endsWith':
      return sql<SqlBool>`${expr} ilike ${'%' + escapeLike(str)}`;
    case 'gt':
      return sql<SqlBool>`${expr} > ${str}`;
    case 'gte':
      return sql<SqlBool>`${expr} >= ${str}`;
    case 'lt':
      return sql<SqlBool>`${expr} < ${str}`;
    case 'lte':
      return sql<SqlBool>`${expr} <= ${str}`;
    case 'any': {
      const list = asStringList(value);
      if (list.length === 0) return sql<SqlBool>`false`;
      return sql<SqlBool>`${expr} in (${sql.join(list)})`;
    }
    case 'none': {
      const list = asStringList(value);
      if (list.length === 0) return sql<SqlBool>`true`;
      return sql<SqlBool>`(${expr} is null or ${expr} not in (${sql.join(list)}))`;
    }
    case 'all': {
      const list = asStringList(value);
      if (list.length === 0) return sql<SqlBool>`true`;
      if (list.length > 1) return sql<SqlBool>`false`;
      return sql<SqlBool>`${expr} = ${list[0]}`;
    }
    default:
      return unsupported(op, 'text');
  }
}

function compileNumber(
  expr: RawBuilder<unknown>,
  op: FilterOperator,
  value: unknown,
): FilterSql {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(num)) {
    if (op === 'neq') return sql<SqlBool>`true`;
    return sql<SqlBool>`false`;
  }
  switch (op) {
    case 'eq':
      return sql<SqlBool>`${expr} = ${num}`;
    case 'neq':
      return sql<SqlBool>`${expr} is distinct from ${num}::numeric`;
    case 'gt':
      return sql<SqlBool>`${expr} > ${num}`;
    case 'gte':
      return sql<SqlBool>`${expr} >= ${num}`;
    case 'lt':
      return sql<SqlBool>`${expr} < ${num}`;
    case 'lte':
      return sql<SqlBool>`${expr} <= ${num}`;
    default:
      return unsupported(op, 'number');
  }
}

function compileBool(
  expr: RawBuilder<unknown>,
  op: FilterOperator,
  value: unknown,
): FilterSql {
  const truthy =
    value === true ||
    (typeof value === 'string' && /^(true|1|yes|on)$/i.test(value.trim()));
  switch (op) {
    case 'eq':
      // An unchecked checkbox is usually a missing key; treat it as false.
      return truthy
        ? sql<SqlBool>`${expr} = true`
        : sql<SqlBool>`coalesce(${expr}, false) = false`;
    case 'neq':
      return truthy
        ? sql<SqlBool>`coalesce(${expr}, false) = false`
        : sql<SqlBool>`${expr} = true`;
    default:
      return unsupported(op, 'bool');
  }
}

function compileTimestamp(
  expr: RawBuilder<unknown>,
  op: FilterOperator,
  value: unknown,
  now: Date,
): FilterSql {
  const range = resolveDateFilter(value, now);
  if (!range) return sql<SqlBool>`false`;
  const start = range.start.toISOString();
  const end = range.end.toISOString();
  switch (op) {
    case 'eq':
    case 'isWithin':
      return sql<SqlBool>`(${expr} >= ${start}::timestamptz and ${expr} < ${end}::timestamptz)`;
    case 'neq':
      return sql<SqlBool>`not coalesce(${expr} >= ${start}::timestamptz and ${expr} < ${end}::timestamptz, false)`;
    case 'before':
    case 'lt':
      return sql<SqlBool>`${expr} < ${start}::timestamptz`;
    case 'onOrBefore':
    case 'lte':
      return sql<SqlBool>`${expr} < ${end}::timestamptz`;
    case 'after':
    case 'gt':
      return sql<SqlBool>`${expr} >= ${end}::timestamptz`;
    case 'onOrAfter':
    case 'gte':
      return sql<SqlBool>`${expr} >= ${start}::timestamptz`;
    default:
      return unsupported(op, 'timestamp');
  }
}

function textArray(list: string[]): RawBuilder<unknown> {
  return sql`array[${sql.join(list)}]::text[]`;
}

function compileArray(
  expr: RawBuilder<unknown>,
  op: FilterOperator,
  value: unknown,
): FilterSql {
  const list = asStringList(value);
  switch (op) {
    case 'eq':
      if (list.length === 0) return sql<SqlBool>`false`;
      return sql<SqlBool>`coalesce(${expr} ? ${list[0]}, false)`;
    case 'neq':
      if (list.length === 0) return sql<SqlBool>`true`;
      return sql<SqlBool>`not coalesce(${expr} ? ${list[0]}, false)`;
    case 'any':
      if (list.length === 0) return sql<SqlBool>`false`;
      return sql<SqlBool>`coalesce(${expr} ?| ${textArray(list)}, false)`;
    case 'none':
      if (list.length === 0) return sql<SqlBool>`true`;
      return sql<SqlBool>`not coalesce(${expr} ?| ${textArray(list)}, false)`;
    case 'all':
      if (list.length === 0) return sql<SqlBool>`true`;
      return sql<SqlBool>`coalesce(${expr} ?& ${textArray(list)}, false)`;
    case 'contains':
      if (list.length === 0) return sql<SqlBool>`false`;
      return sql<SqlBool>`coalesce(${expr}::text ilike ${'%' + escapeLike(list[0]) + '%'}, false)`;
    case 'ncontains':
      if (list.length === 0) return sql<SqlBool>`true`;
      return sql<SqlBool>`not coalesce(${expr}::text ilike ${'%' + escapeLike(list[0]) + '%'}, false)`;
    default:
      return unsupported(op, 'array');
  }
}
