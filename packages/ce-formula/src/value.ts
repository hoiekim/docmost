import { ErrorCode, fail, isErrorCell } from './errors';
import { FormulaDate, type StoredValue, type Value } from './types';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Significant digits kept before trailing-zero stripping. */
const PRECISION = 12;

/**
 * Render a number without binary-float artifacts: 0.1 + 0.2 prints as "0.3",
 * not "0.30000000000000004". Values too large or small for a plain decimal
 * keep exponent notation.
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? 'Infinity' : n < 0 ? '-Infinity' : 'NaN';
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e21 || abs < 1e-7)) return String(n);
  return String(Number(n.toPrecision(PRECISION)));
}

/** Snap away float noise while keeping the value a number. */
export function snapNumber(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return n;
  return Number(n.toPrecision(PRECISION));
}

function pad(n: number, width: number): string {
  return String(Math.abs(n)).padStart(width, '0');
}

/** Serialize a date the way it is stored: `YYYY-MM-DD` or an ISO instant. */
export function dateToString(d: FormulaDate): string {
  const date = new Date(d.ms);
  if (Number.isNaN(date.getTime())) return '';
  if (d.dateOnly) {
    return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(
      date.getUTCDate(),
      2,
    )}`;
  }
  return date.toISOString();
}

/**
 * Text rendering used for CSV export, text-type conversion and TOTEXT().
 * Empty for null so exported cells are blank rather than "null".
 */
export function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (isErrorCell(value)) return '#ERROR';
  if (value instanceof FormulaDate) return dateToString(value);
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return String(value);
}

/** Flatten an evaluated value to something JSON-storable. */
export function toStored(value: Value): StoredValue {
  if (value instanceof FormulaDate) return dateToString(value);
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }
  return value as StoredValue;
}

export function isBlank(value: Value): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Parse a cell value into a date. Date-only strings stay date-only so a
 * formula over them renders the same day in every timezone.
 */
export function toDate(value: Value): FormulaDate | null {
  if (value instanceof FormulaDate) return value;
  if (isBlank(value)) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new FormulaDate(value, false) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (DATE_ONLY_RE.test(trimmed)) {
      const ms = Date.parse(`${trimmed}T00:00:00.000Z`);
      return Number.isNaN(ms) ? null : new FormulaDate(ms, true);
    }
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : new FormulaDate(ms, false);
  }
  return null;
}

export function requireDate(value: Value, fn: string): FormulaDate {
  const d = toDate(value);
  if (!d) fail(ErrorCode.TYPE, `${fn} expects a date`);
  return d;
}

/**
 * Numeric coercion. Blank is 0 so SUM over empty cells behaves like a
 * spreadsheet; text that is not a number is an error rather than NaN.
 */
export function toNumber(value: Value): number {
  if (typeof value === 'number') return value;
  if (isBlank(value)) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof FormulaDate) return value.ms;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (trimmed === '') return 0;
    const n = Number(trimmed);
    if (Number.isNaN(n)) fail(ErrorCode.VALUE, `"${value}" is not a number`);
    return n;
  }
  fail(ErrorCode.TYPE, 'Expected a number');
}

export function toText(value: Value): string {
  return valueToString(value);
}

/** Truthiness: blank, 0 and "" are false, as are the words "false"/"no". */
export function toBoolean(value: Value): boolean {
  if (typeof value === 'boolean') return value;
  if (isBlank(value)) return false;
  if (typeof value === 'number') return value !== 0;
  if (value instanceof FormulaDate) return true;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'false' || t === 'no' || t === '0' || t === '') return false;
    return true;
  }
  return false;
}

/**
 * Ordering shared by comparison operators, MIN/MAX and sorting. Returns null
 * when the two values are not comparable.
 */
export function compareValues(a: Value, b: Value): number | null {
  if (a instanceof FormulaDate || b instanceof FormulaDate) {
    const da = toDate(a);
    const db = toDate(b);
    if (!da || !db) return null;
    return da.ms === db.ms ? 0 : da.ms < db.ms ? -1 : 1;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (isBlank(a) && isBlank(b)) return 0;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return null;
  return na === nb ? 0 : na < nb ? -1 : 1;
}

/** Equality for `=` / `!=`; blank equals blank, dates compare by instant. */
export function valuesEqual(a: Value, b: Value): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (isBlank(a) !== isBlank(b)) return false;
  if (a instanceof FormulaDate || b instanceof FormulaDate) {
    const da = toDate(a);
    const db = toDate(b);
    return !!da && !!db && da.ms === db.ms;
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return toBoolean(a) === toBoolean(b);
  }
  if (typeof a === 'number' || typeof b === 'number') {
    return toNumber(a) === toNumber(b);
  }
  return toText(a) === toText(b);
}
