import { ErrorCode, fail } from '../errors';
import { FormulaDate, type FormulaFn, type Value } from '../types';
import { requireDate, toNumber, toText } from '../value';

const MS = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
} as const;

type Unit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

/** Accepts singular, plural and common short spellings. */
const UNITS: Record<string, Unit> = {
  s: 'second',
  sec: 'second',
  second: 'second',
  seconds: 'second',
  m: 'minute',
  min: 'minute',
  minute: 'minute',
  minutes: 'minute',
  h: 'hour',
  hour: 'hour',
  hours: 'hour',
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  week: 'week',
  weeks: 'week',
  mo: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  year: 'year',
  years: 'year',
};

function unitOf(value: Value, fn: string): Unit {
  const key = toText(value).trim().toLowerCase();
  const unit = UNITS[key];
  if (!unit) {
    fail(
      ErrorCode.VALUE,
      `${fn} does not know the unit "${key}". Use days, weeks, months, years, hours, minutes or seconds.`,
    );
  }
  return unit;
}

/** Add whole months, clamping to the end of the target month. */
function addMonths(ms: number, amount: number): number {
  const d = new Date(ms);
  const day = d.getUTCDate();
  const target = new Date(ms);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + amount);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.getTime();
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

export const dateFunctions: FormulaFn[] = [
  {
    name: 'NOW',
    category: 'date',
    doc: 'The current date and time.',
    arity: { min: 0, max: 0 },
    paramTypes: [],
    resultType: 'date',
    call: (_args, ctx) => new FormulaDate(ctx.now, false),
  },
  {
    name: 'TODAY',
    category: 'date',
    doc: "Today's date, without a time.",
    arity: { min: 0, max: 0 },
    paramTypes: [],
    resultType: 'date',
    call: (_args, ctx) => {
      const d = new Date(ctx.now);
      return new FormulaDate(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
        true,
      );
    },
  },
  {
    name: 'DATE',
    category: 'date',
    doc: 'Builds a date from year, month and day.',
    arity: { min: 3, max: 3 },
    paramTypes: ['number', 'number', 'number'],
    resultType: 'date',
    call: (args) => {
      const ms = Date.UTC(
        Math.trunc(toNumber(args[0])),
        Math.trunc(toNumber(args[1])) - 1,
        Math.trunc(toNumber(args[2])),
      );
      if (Number.isNaN(ms)) fail(ErrorCode.VALUE, 'DATE received an invalid date');
      return new FormulaDate(ms, true);
    },
  },
  {
    name: 'YEAR',
    category: 'date',
    doc: 'Year of a date.',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'YEAR').ms).getUTCFullYear(),
  },
  {
    name: 'MONTH',
    category: 'date',
    doc: 'Month of a date, 1 to 12.',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'MONTH').ms).getUTCMonth() + 1,
  },
  {
    name: 'DAY',
    category: 'date',
    doc: 'Day of the month.',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'DAY').ms).getUTCDate(),
  },
  {
    name: 'HOUR',
    category: 'date',
    doc: 'Hour of a date, 0 to 23.',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'HOUR').ms).getUTCHours(),
  },
  {
    name: 'MINUTE',
    category: 'date',
    doc: 'Minute of a date, 0 to 59.',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'MINUTE').ms).getUTCMinutes(),
  },
  {
    name: 'WEEKDAY',
    category: 'date',
    doc: 'Day of the week, 1 (Sunday) to 7 (Saturday).',
    arity: { min: 1, max: 1 },
    paramTypes: ['date'],
    resultType: 'number',
    call: (args) => new Date(requireDate(args[0], 'WEEKDAY').ms).getUTCDay() + 1,
  },
  {
    name: 'DATEADD',
    category: 'date',
    doc: 'Adds an amount of a unit to a date, e.g. DATEADD(prop("Due"), 7, "days").',
    arity: { min: 3, max: 3 },
    paramTypes: ['date', 'number', 'string'],
    resultType: 'date',
    call: (args) => {
      const date = requireDate(args[0], 'DATEADD');
      const amount = Math.trunc(toNumber(args[1]));
      const unit = unitOf(args[2], 'DATEADD');
      if (unit === 'month') return new FormulaDate(addMonths(date.ms, amount), date.dateOnly);
      if (unit === 'year') return new FormulaDate(addMonths(date.ms, amount * 12), date.dateOnly);
      return new FormulaDate(date.ms + amount * MS[unit], date.dateOnly);
    },
  },
  {
    name: 'DATESUBTRACT',
    category: 'date',
    doc: 'Subtracts an amount of a unit from a date.',
    arity: { min: 3, max: 3 },
    paramTypes: ['date', 'number', 'string'],
    resultType: 'date',
    call: (args) => {
      const date = requireDate(args[0], 'DATESUBTRACT');
      const amount = Math.trunc(toNumber(args[1]));
      const unit = unitOf(args[2], 'DATESUBTRACT');
      if (unit === 'month') return new FormulaDate(addMonths(date.ms, -amount), date.dateOnly);
      if (unit === 'year') return new FormulaDate(addMonths(date.ms, -amount * 12), date.dateOnly);
      return new FormulaDate(date.ms - amount * MS[unit], date.dateOnly);
    },
  },
  {
    name: 'DATEDIFF',
    category: 'date',
    doc: 'Whole units from the first date to the second; negative when the second is earlier.',
    arity: { min: 2, max: 3 },
    paramTypes: ['date', 'date', 'string'],
    resultType: 'number',
    call: (args) => {
      const from = requireDate(args[0], 'DATEDIFF');
      const to = requireDate(args[1], 'DATEDIFF');
      const unit = args[2] === undefined ? 'day' : unitOf(args[2], 'DATEDIFF');
      if (unit === 'month' || unit === 'year') {
        const a = new Date(from.ms);
        const b = new Date(to.ms);
        let months =
          (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
          (b.getUTCMonth() - a.getUTCMonth());
        // Not a whole month until the day of month is reached.
        if (months > 0 && b.getUTCDate() < a.getUTCDate()) months--;
        else if (months < 0 && b.getUTCDate() > a.getUTCDate()) months++;
        return unit === 'month' ? months : Math.trunc(months / 12);
      }
      return Math.trunc((to.ms - from.ms) / MS[unit]);
    },
  },
  {
    name: 'FORMATDATE',
    category: 'date',
    doc: 'Formats a date with YYYY, MM, DD, HH, mm and ss placeholders.',
    arity: { min: 2, max: 2 },
    paramTypes: ['date', 'string'],
    resultType: 'string',
    call: (args) => {
      const d = new Date(requireDate(args[0], 'FORMATDATE').ms);
      const parts: Record<string, string> = {
        YYYY: pad(d.getUTCFullYear(), 4),
        YY: pad(d.getUTCFullYear() % 100, 2),
        MM: pad(d.getUTCMonth() + 1, 2),
        DD: pad(d.getUTCDate(), 2),
        HH: pad(d.getUTCHours(), 2),
        mm: pad(d.getUTCMinutes(), 2),
        ss: pad(d.getUTCSeconds(), 2),
      };
      return toText(args[1]).replace(
        /YYYY|YY|MM|DD|HH|mm|ss/g,
        (token) => parts[token] ?? token,
      );
    },
  },
];
