import { isErrorCell, valueToString } from '@docmost/ce-formula/server';
import {
  BasePropertyType,
  Choice,
  FileValue,
  IBaseProperty,
  IBaseRow,
  ResolvedPage,
  UserRef,
} from '../types/base.types';

export type RenderRefs = {
  users: ReadonlyMap<string, UserRef>;
  pages: ReadonlyMap<string, Pick<ResolvedPage, 'id' | 'title'>>;
};

export const EMPTY_REFS: RenderRefs = { users: new Map(), pages: new Map() };

function choiceName(prop: IBaseProperty, id: unknown): string {
  if (typeof id !== 'string') return '';
  const choices = ((prop.typeOptions as any)?.choices ?? []) as Choice[];
  return choices.find((c) => c.id === id)?.name ?? '';
}

function userName(refs: RenderRefs, id: unknown): string {
  if (typeof id !== 'string') return '';
  return refs.users.get(id)?.name ?? '';
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

/** Value read for a property, taking system properties from the row itself. */
export function readCell(row: IBaseRow, prop: IBaseProperty): unknown {
  switch (prop.type as BasePropertyType) {
    case 'createdAt':
      return row.createdAt;
    case 'lastEditedAt':
      return row.updatedAt;
    case 'lastEditedBy':
      return row.lastUpdatedById ?? row.creatorId;
    default:
      return row.cells?.[prop.id];
  }
}

function dateToText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return value == null ? '' : String(value);
}

/**
 * Human-readable text for a cell: choice names instead of ids, user names
 * instead of user ids, page titles instead of page ids, file names.
 */
export function cellToText(
  value: unknown,
  prop: IBaseProperty,
  refs: RenderRefs = EMPTY_REFS,
): string {
  if (value === null || value === undefined) return '';
  switch (prop.type as BasePropertyType) {
    case 'select':
    case 'status':
      return choiceName(prop, Array.isArray(value) ? value[0] : value);
    case 'multiSelect':
      return asList(value)
        .map((id) => choiceName(prop, id))
        .filter(Boolean)
        .join(', ');
    case 'person':
    case 'lastEditedBy':
      return asList(value)
        .map((id) => userName(refs, id))
        .filter(Boolean)
        .join(', ');
    case 'page': {
      if (typeof value !== 'string') return '';
      const page = refs.pages.get(value);
      return page ? (page.title ?? 'untitled') : '';
    }
    case 'file':
      return asList(value)
        .map((f) => (f as FileValue)?.fileName ?? '')
        .filter(Boolean)
        .join(', ');
    case 'checkbox':
      return value === true ? 'true' : 'false';
    case 'number':
      return typeof value === 'number' ? valueToString(value) : String(value);
    case 'date':
    case 'createdAt':
    case 'lastEditedAt':
      return dateToText(value);
    case 'formula':
      if (isErrorCell(value)) return '#ERROR';
      return valueToString(value);
    default:
      return typeof value === 'string' ? value : valueToString(value);
  }
}
