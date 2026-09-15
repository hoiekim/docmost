import {
  BasePropertyType,
  Choice,
  IBaseProperty,
  TypeOptions,
} from '../types/base.types';
import { cellToText, RenderRefs, EMPTY_REFS } from './cell-renderer';

const MAX_SHORT_TEXT = 2000;
const URL_RE = /^(https?:\/\/|mailto:|tel:)[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ConvertContext = {
  refs: RenderRefs;
  /** ids of pages known to exist (for → page conversions). */
  knownPageIds?: ReadonlySet<string>;
};

function targetChoiceIds(toTypeOptions: TypeOptions | undefined): Set<string> {
  const choices = ((toTypeOptions as any)?.choices ?? []) as Choice[];
  return new Set(choices.map((c) => c.id));
}

function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return typeof value === 'string' && value !== '' ? [value] : [];
}

/**
 * Convert one stored cell value from `fromProp`'s type to `toType`.
 * Returns the new value, or null when the value has no sensible
 * representation (the cell key is then removed). Mirrors the behaviour the
 * client describes in components/property/conversion-warning.ts.
 */
export function convertCell(
  value: unknown,
  fromProp: IBaseProperty,
  toType: BasePropertyType,
  toTypeOptions: TypeOptions | undefined,
  ctx: ConvertContext = { refs: EMPTY_REFS },
): unknown {
  if (value === null || value === undefined) return null;
  const fromType = fromProp.type as BasePropertyType;
  if (fromType === toType) return value;

  const isChoiceType = (t: BasePropertyType) =>
    t === 'select' || t === 'status' || t === 'multiSelect';

  switch (toType) {
    case 'text':
    case 'longText': {
      let text =
        typeof value === 'string' && (fromType === 'text' || fromType === 'longText')
          ? value
          : cellToText(value, fromProp, ctx.refs);
      if (toType === 'text' && text.length > MAX_SHORT_TEXT) {
        text = text.slice(0, MAX_SHORT_TEXT);
      }
      return text === '' ? null : text;
    }

    case 'select':
    case 'status': {
      if (isChoiceType(fromType)) {
        const ids = targetChoiceIds(toTypeOptions);
        const first = asIdList(value)[0];
        return first && ids.has(first) ? first : null;
      }
      return null;
    }

    case 'multiSelect': {
      if (isChoiceType(fromType)) {
        const ids = targetChoiceIds(toTypeOptions);
        const list = asIdList(value).filter((id) => ids.has(id));
        return list.length ? list : null;
      }
      return null;
    }

    case 'number': {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'boolean') return value ? 1 : 0;
      const text = cellToText(value, fromProp, ctx.refs).trim();
      if (text === '') return null;
      const n = Number(text.replace(/[,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    case 'date': {
      const text =
        typeof value === 'string' ? value : cellToText(value, fromProp, ctx.refs);
      const t = Date.parse(text.trim());
      if (isNaN(t)) return null;
      // Keep the original text when it already parses; it may carry a time.
      return text.trim();
    }

    case 'checkbox': {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      const text = cellToText(value, fromProp, ctx.refs).trim();
      if (/^(yes|true|1|y|on|checked)$/i.test(text)) return true;
      if (/^(no|false|0|n|off)$/i.test(text)) return false;
      return null;
    }

    case 'url': {
      const text = cellToText(value, fromProp, ctx.refs).trim();
      return URL_RE.test(text) ? text : null;
    }

    case 'email': {
      const text = cellToText(value, fromProp, ctx.refs).trim();
      return EMAIL_RE.test(text) ? text : null;
    }

    case 'page': {
      if (typeof value !== 'string') return null;
      if (ctx.knownPageIds && !ctx.knownPageIds.has(value)) return null;
      return fromType === 'page' ? value : null;
    }

    case 'person': {
      if (fromType !== 'person') return null;
      const ids = asIdList(value);
      if (ids.length === 0) return null;
      return (toTypeOptions as any)?.allowMultiple ? ids : ids[0];
    }

    case 'file':
      return fromType === 'file' ? value : null;

    default:
      // createdAt / lastEditedAt / lastEditedBy / formula are not conversion
      // targets; anything reaching here clears the cell.
      return null;
  }
}
