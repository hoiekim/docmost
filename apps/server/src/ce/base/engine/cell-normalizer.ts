import { BadRequestException } from '@nestjs/common';
import {
  BasePropertyType,
  Choice,
  IBaseProperty,
  SYSTEM_PROPERTY_TYPES,
} from '../types/base.types';
import { fileValueSchema } from './schema.zod';

export type NormalizeOptions = {
  /** Apply typeOptions.defaultValue for properties absent from the patch. */
  applyDefaults?: boolean;
};

const URL_RE = /^(https?:\/\/|mailto:|tel:)[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 100_000;

function bad(prop: IBaseProperty, detail: string): never {
  throw new BadRequestException(`Invalid value for "${prop.name}": ${detail}`);
}

function choiceIds(prop: IBaseProperty): Set<string> {
  const choices = ((prop.typeOptions as any)?.choices ?? []) as Choice[];
  return new Set(choices.map((c) => c.id));
}

/**
 * Validate and coerce one cell value for the given property. `null` always
 * means "clear the cell". Returns the value to store.
 */
export function normalizeCell(prop: IBaseProperty, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const type = prop.type as BasePropertyType;
  switch (type) {
    case 'text':
    case 'longText': {
      const s = typeof value === 'string' ? value : String(value);
      if (s.length > MAX_TEXT) return bad(prop, 'text too long');
      return s;
    }
    case 'url': {
      const s = typeof value === 'string' ? value.trim() : String(value);
      if (s === '') return null;
      if (s.length > 2048 || /\s/.test(s)) return bad(prop, 'not a URL');
      return s;
    }
    case 'email': {
      const s = typeof value === 'string' ? value.trim() : String(value);
      if (s === '') return null;
      if (s.length > 320 || !EMAIL_RE.test(s)) return bad(prop, 'not an email');
      return s;
    }
    case 'number': {
      const n =
        typeof value === 'number'
          ? value
          : typeof value === 'string' && value.trim() !== ''
            ? Number(value)
            : NaN;
      if (!Number.isFinite(n)) return bad(prop, 'not a number');
      return n;
    }
    case 'checkbox': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        if (/^(true|1|yes|on)$/i.test(value.trim())) return true;
        if (/^(false|0|no|off|)$/i.test(value.trim())) return false;
      }
      if (typeof value === 'number') return value !== 0;
      return bad(prop, 'not a boolean');
    }
    case 'date': {
      if (value instanceof Date) return value.toISOString();
      if (typeof value !== 'string') return bad(prop, 'not a date');
      const s = value.trim();
      if (s === '') return null;
      if (isNaN(Date.parse(s))) return bad(prop, 'not a date');
      return s;
    }
    case 'select':
    case 'status': {
      const ids = choiceIds(prop);
      const id = Array.isArray(value) ? value[0] : value;
      if (id == null || id === '') return null;
      if (typeof id !== 'string' || !ids.has(id)) {
        return bad(prop, 'unknown option');
      }
      return id;
    }
    case 'multiSelect': {
      const ids = choiceIds(prop);
      const list = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? [value]
          : null;
      if (!list) return bad(prop, 'expected a list of options');
      const out: string[] = [];
      for (const id of list) {
        if (typeof id !== 'string' || !ids.has(id)) {
          return bad(prop, 'unknown option');
        }
        if (!out.includes(id)) out.push(id);
      }
      return out.length ? out : null;
    }
    case 'person': {
      const multi = !!(prop.typeOptions as any)?.allowMultiple;
      const list = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? [value]
          : null;
      if (!list) return bad(prop, 'expected a user id');
      const out: string[] = [];
      for (const id of list) {
        if (typeof id !== 'string' || id.length === 0 || id.length > 64) {
          return bad(prop, 'invalid user id');
        }
        if (!out.includes(id)) out.push(id);
      }
      if (out.length === 0) return null;
      return multi ? out : out[0];
    }
    case 'page': {
      if (typeof value !== 'string') return bad(prop, 'expected a page id');
      const s = value.trim();
      if (s === '') return null;
      if (s.length > 64) return bad(prop, 'invalid page id');
      return s;
    }
    case 'file': {
      const list = Array.isArray(value) ? value : null;
      if (!list) return bad(prop, 'expected a list of files');
      if (list.length > 100) return bad(prop, 'too many files');
      const out = list.map((f) => {
        const parsed = fileValueSchema.safeParse(f);
        if (!parsed.success) return bad(prop, 'invalid file');
        return parsed.data;
      });
      return out.length ? out : null;
    }
    case 'formula':
    case 'createdAt':
    case 'lastEditedAt':
    case 'lastEditedBy':
      // Never user-writable; the caller strips these before we get here.
      return undefined;
    default:
      return value;
  }
}

export function isWritableProperty(prop: IBaseProperty): boolean {
  return (
    prop.type !== 'formula' &&
    !SYSTEM_PROPERTY_TYPES.includes(prop.type as BasePropertyType)
  );
}

/**
 * Normalize a cells patch coming from the client. Unknown, formula and system
 * property keys are dropped silently; invalid values throw.
 */
export function normalizeCells(
  patch: Record<string, unknown> | null | undefined,
  propsById: ReadonlyMap<string, IBaseProperty>,
  opts: NormalizeOptions = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [propertyId, raw] of Object.entries(patch ?? {})) {
    const prop = propsById.get(propertyId);
    if (!prop || !isWritableProperty(prop)) continue;
    const normalized = normalizeCell(prop, raw);
    if (normalized === undefined) continue;
    out[propertyId] = normalized;
  }

  if (opts.applyDefaults) {
    for (const prop of propsById.values()) {
      if (!isWritableProperty(prop)) continue;
      if (prop.id in out) continue;
      const def = (prop.typeOptions as any)?.defaultValue;
      if (def === undefined || def === null || def === '') continue;
      try {
        const normalized = normalizeCell(prop, def);
        if (normalized !== undefined && normalized !== null) {
          out[prop.id] = normalized;
        }
      } catch {
        // A stale default (e.g. removed choice) must not block row creation.
      }
    }
  }

  return out;
}
