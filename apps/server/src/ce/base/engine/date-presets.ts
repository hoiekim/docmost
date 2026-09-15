import { DateFilterValue } from '../types/base.types';

export type DateRange = { start: Date; end: Date }; // half-open [start, end)

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function addMonths(d: Date, months: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()),
  );
}

function addYears(d: Date, years: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Monday 00:00 UTC of the week containing `d`. */
function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfUtcYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function dayRange(dayStart: Date): DateRange {
  return { start: dayStart, end: addDays(dayStart, 1) };
}

/**
 * Parse an "exact" date value. Accepts YYYY-MM-DD (treated as a UTC day) or
 * any ISO-8601 instant (the UTC day containing it). Returns null if invalid.
 */
export function parseExactDay(value: string): Date | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(value);
  if (isNaN(t)) return null;
  return startOfUtcDay(new Date(t));
}

/**
 * Resolve a client DateFilterValue (or a bare date string) to a half-open UTC
 * range. Returns null when the value cannot be interpreted.
 */
export function resolveDateFilter(
  value: unknown,
  now: Date = new Date(),
): DateRange | null {
  if (typeof value === 'string') {
    const day = parseExactDay(value);
    return day ? dayRange(day) : null;
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as DateFilterValue;
  const today = startOfUtcDay(now);

  if (v.mode === 'exact') {
    const day = parseExactDay(v.date);
    return day ? dayRange(day) : null;
  }

  if (v.mode === 'relative') {
    switch (v.preset) {
      case 'today':
        return dayRange(today);
      case 'tomorrow':
        return dayRange(addDays(today, 1));
      case 'yesterday':
        return dayRange(addDays(today, -1));
      case 'oneWeekAgo':
        return dayRange(addDays(today, -7));
      case 'oneWeekFromNow':
        return dayRange(addDays(today, 7));
      case 'oneMonthAgo':
        return dayRange(addMonths(today, -1));
      case 'oneMonthFromNow':
        return dayRange(addMonths(today, 1));
      default:
        return null;
    }
  }

  if (v.mode === 'range') {
    const tomorrow = addDays(today, 1);
    switch (v.preset) {
      case 'pastWeek':
        return { start: addDays(today, -7), end: tomorrow };
      case 'pastMonth':
        return { start: addMonths(today, -1), end: tomorrow };
      case 'pastYear':
        return { start: addYears(today, -1), end: tomorrow };
      case 'thisWeek': {
        const start = startOfUtcWeek(today);
        return { start, end: addDays(start, 7) };
      }
      case 'thisMonth': {
        const start = startOfUtcMonth(today);
        return { start, end: addMonths(start, 1) };
      }
      case 'thisYear': {
        const start = startOfUtcYear(today);
        return { start, end: addYears(start, 1) };
      }
      case 'nextWeek':
        return { start: today, end: addDays(today, 7) };
      case 'nextMonth':
        return { start: today, end: addMonths(today, 1) };
      case 'nextYear':
        return { start: today, end: addYears(today, 1) };
      default:
        return null;
    }
  }

  return null;
}
