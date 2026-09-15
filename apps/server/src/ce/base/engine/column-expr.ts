import { RawBuilder, sql } from 'kysely';
import { BasePropertyType, IBaseProperty } from '../types/base.types';

/**
 * How a property's value is exposed to SQL. Cells are jsonb, so every
 * property type maps to one typed extraction helper created by the bases
 * migration (base_cell_text / _numeric / _timestamptz / _bool) or, for
 * multi-valued properties, to a normalized jsonb array.
 */
export type ColumnKind = 'text' | 'number' | 'timestamp' | 'bool' | 'array';

export type PropLike = Pick<IBaseProperty, 'id' | 'type' | 'typeOptions'>;

export function columnKind(prop: PropLike): ColumnKind {
  const type = prop.type as BasePropertyType;
  switch (type) {
    case 'number':
      return 'number';
    case 'date':
    case 'createdAt':
    case 'lastEditedAt':
      return 'timestamp';
    case 'checkbox':
      return 'bool';
    case 'multiSelect':
    case 'file':
      return 'array';
    case 'person':
      return (prop.typeOptions as any)?.allowMultiple ? 'array' : 'text';
    case 'formula': {
      const rt = (prop.typeOptions as any)?.resultType;
      if (rt === 'number') return 'number';
      if (rt === 'boolean') return 'bool';
      if (rt === 'date') return 'timestamp';
      return 'text';
    }
    default:
      return 'text';
  }
}

/** SQL expression yielding the property's value for the current base_rows row. */
export function columnExpr(prop: PropLike): RawBuilder<unknown> {
  const type = prop.type as BasePropertyType;
  if (type === 'createdAt') return sql`created_at`;
  if (type === 'lastEditedAt') return sql`updated_at`;
  if (type === 'lastEditedBy') {
    return sql`coalesce(last_updated_by_id, creator_id)::text`;
  }
  const id = prop.id;
  switch (columnKind(prop)) {
    case 'number':
      return sql`base_cell_numeric(cells, ${id})`;
    case 'timestamp':
      return sql`base_cell_timestamptz(cells, ${id})`;
    case 'bool':
      return sql`base_cell_bool(cells, ${id})`;
    case 'array':
      // A person cell may hold a bare string even when allowMultiple is on
      // (property converted later), so wrap scalars into a one-item array.
      return sql`(case jsonb_typeof(cells -> ${id})
        when 'array' then cells -> ${id}
        when 'string' then jsonb_build_array(cells -> ${id})
        else null end)`;
    default:
      return sql`base_cell_text(cells, ${id})`;
  }
}
