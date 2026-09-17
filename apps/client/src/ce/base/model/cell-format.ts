import { format as formatDate, isValid, parseISO } from "date-fns";
import type {
  DateTypeOptions,
  FormulaTypeOptions,
  IBaseProperty,
  NumberTypeOptions,
  RowReferences,
} from "../types";
import {
  asFileList,
  asIdList,
  getChoice,
  isFormulaError,
} from "./cell-read";

export const DEFAULT_DATE_FORMAT = "MMM d, yyyy";

export function parseDateValue(value: unknown): Date | null {
  if (value instanceof Date) return isValid(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  const loose = new Date(value);
  return isValid(loose) ? loose : null;
}

export function formatDateValue(
  value: unknown,
  opts: DateTypeOptions | undefined,
): string {
  const date = parseDateValue(value);
  if (!date) return "";
  const pattern = opts?.dateFormat || DEFAULT_DATE_FORMAT;
  let out: string;
  try {
    out = formatDate(date, pattern);
  } catch {
    out = formatDate(date, DEFAULT_DATE_FORMAT);
  }
  if (opts?.includeTime) {
    out += " " + formatDate(date, opts.timeFormat === "24h" ? "HH:mm" : "h:mm a");
  }
  return out;
}

export function formatTimestamp(value: unknown): string {
  const date = parseDateValue(value);
  if (!date) return "";
  return formatDate(date, "MMM d, yyyy h:mm a");
}

function withSeparators(n: number, precision: number | undefined): string {
  const opts: Intl.NumberFormatOptions = {};
  if (precision !== undefined) {
    opts.minimumFractionDigits = precision;
    opts.maximumFractionDigits = precision;
  } else {
    opts.maximumFractionDigits = 10;
  }
  return new Intl.NumberFormat(undefined, opts).format(n);
}

export function formatNumberValue(
  value: unknown,
  opts: NumberTypeOptions | undefined,
): string {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return "";
  const precision =
    typeof opts?.precision === "number" && opts.precision >= 0
      ? Math.min(opts.precision, 20)
      : undefined;
  switch (opts?.format) {
    case "currency": {
      const code = opts.currencyCode || "USD";
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: code,
          minimumFractionDigits: precision ?? 2,
          maximumFractionDigits: precision ?? 2,
        }).format(n);
      } catch {
        return `${opts.currencySymbol ?? code} ${withSeparators(n, precision ?? 2)}`;
      }
    }
    case "percent":
      return `${withSeparators(n, precision)}%`;
    case "progress":
      return `${withSeparators(Math.max(0, Math.min(100, n)), precision ?? 0)}%`;
    default:
      return withSeparators(n, precision);
  }
}

/** Formula results are typed by the server; format by result type. */
export function formatFormulaValue(value: unknown, prop: IBaseProperty): string {
  if (value === null || value === undefined) return "";
  if (isFormulaError(value)) return "#ERROR";
  const opts = prop.typeOptions as FormulaTypeOptions;
  switch (opts?.resultType) {
    case "number":
      return formatNumberValue(value, opts.formatOptions as NumberTypeOptions);
    case "date":
      return formatDateValue(value, opts.formatOptions as DateTypeOptions);
    case "boolean":
      return value ? "true" : "false";
    default:
      if (typeof value === "number") return formatNumberValue(value, undefined);
      if (typeof value === "boolean") return value ? "true" : "false";
      return String(value);
  }
}

/**
 * Plain-text rendering of any cell, used for search, copy, tooltips and
 * kanban card previews. Choice ids become names, user/page ids become
 * names/titles when the references are known.
 */
export function cellToText(
  value: unknown,
  prop: IBaseProperty,
  refs?: RowReferences,
): string {
  if (value === null || value === undefined) return "";
  switch (prop.type) {
    case "select":
    case "status":
      return getChoice(prop, asIdList(value)[0])?.name ?? "";
    case "multiSelect":
      return asIdList(value)
        .map((id) => getChoice(prop, id)?.name ?? "")
        .filter(Boolean)
        .join(", ");
    case "person":
    case "lastEditedBy":
      return asIdList(value)
        .map((id) => refs?.users[id]?.name ?? "")
        .filter(Boolean)
        .join(", ");
    case "page": {
      if (typeof value !== "string") return "";
      const page = refs?.pages[value];
      return page ? page.title || "Untitled" : "";
    }
    case "file":
      return asFileList(value)
        .map((f) => f.fileName)
        .join(", ");
    case "checkbox":
      return value === true ? "true" : "false";
    case "number":
      return formatNumberValue(value, prop.typeOptions as NumberTypeOptions);
    case "date":
      return formatDateValue(value, prop.typeOptions as DateTypeOptions);
    case "createdAt":
    case "lastEditedAt":
      return formatTimestamp(value);
    case "formula":
      return formatFormulaValue(value, prop);
    default:
      return typeof value === "string" ? value : String(value);
  }
}
