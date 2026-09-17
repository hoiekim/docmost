import type {
  DateFilterAnchor,
  DateFilterRange,
  DateFilterValue,
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  FormulaTypeOptions,
  IBaseProperty,
  PersonTypeOptions,
} from "../types";

/**
 * How a property is filtered and sorted. Mirrors columnKind() in
 * apps/server/src/ce/base/engine/column-expr.ts.
 */
export type ColumnKind = "text" | "number" | "timestamp" | "bool" | "array";

export function columnKind(prop: IBaseProperty): ColumnKind {
  switch (prop.type) {
    case "number":
      return "number";
    case "date":
    case "createdAt":
    case "lastEditedAt":
      return "timestamp";
    case "checkbox":
      return "bool";
    case "multiSelect":
    case "file":
      return "array";
    case "person":
      return (prop.typeOptions as PersonTypeOptions)?.allowMultiple ? "array" : "text";
    case "formula": {
      const rt = (prop.typeOptions as FormulaTypeOptions)?.resultType;
      if (rt === "number") return "number";
      if (rt === "boolean") return "bool";
      if (rt === "date") return "timestamp";
      return "text";
    }
    default:
      return "text";
  }
}

/** Which input the value editor shows for a condition. */
export type FilterValueKind =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "choices"
  | "people"
  | "none";

export function filterValueKind(prop: IBaseProperty, op: FilterOperator): FilterValueKind {
  if (op === "isEmpty" || op === "isNotEmpty") return "none";
  switch (prop.type) {
    case "select":
    case "status":
    case "multiSelect":
      return op === "contains" || op === "ncontains" ? "text" : "choices";
    case "person":
    case "lastEditedBy":
      return "people";
    case "checkbox":
      return "boolean";
    case "number":
      return "number";
    case "date":
    case "createdAt":
    case "lastEditedAt":
      return "date";
    case "formula": {
      const kind = columnKind(prop);
      if (kind === "number") return "number";
      if (kind === "bool") return "boolean";
      if (kind === "timestamp") return "date";
      return "text";
    }
    case "file":
      return "text";
    default:
      return "text";
  }
}

const TEXT_OPS: FilterOperator[] = [
  "contains",
  "ncontains",
  "eq",
  "neq",
  "startsWith",
  "endsWith",
  "isEmpty",
  "isNotEmpty",
];
const NUMBER_OPS: FilterOperator[] = ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"];
const BOOL_OPS: FilterOperator[] = ["eq", "neq"];
const DATE_OPS: FilterOperator[] = [
  "isWithin",
  "eq",
  "neq",
  "before",
  "after",
  "onOrBefore",
  "onOrAfter",
  "isEmpty",
  "isNotEmpty",
];
const SINGLE_CHOICE_OPS: FilterOperator[] = ["any", "none", "isEmpty", "isNotEmpty"];
const MULTI_CHOICE_OPS: FilterOperator[] = ["any", "all", "none", "isEmpty", "isNotEmpty"];
const FILE_OPS: FilterOperator[] = ["contains", "ncontains", "isEmpty", "isNotEmpty"];

export function operatorsFor(prop: IBaseProperty): FilterOperator[] {
  switch (prop.type) {
    case "select":
    case "status":
      return SINGLE_CHOICE_OPS;
    case "multiSelect":
      return MULTI_CHOICE_OPS;
    case "person":
      return (prop.typeOptions as PersonTypeOptions)?.allowMultiple
        ? MULTI_CHOICE_OPS
        : SINGLE_CHOICE_OPS;
    case "lastEditedBy":
      return SINGLE_CHOICE_OPS;
    case "file":
      return FILE_OPS;
    default:
      break;
  }
  switch (columnKind(prop)) {
    case "number":
      return NUMBER_OPS;
    case "bool":
      return BOOL_OPS;
    case "timestamp":
      return DATE_OPS;
    case "array":
      return MULTI_CHOICE_OPS;
    default:
      return TEXT_OPS;
  }
}

/** English labels; passed through t() by the UI. */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "is",
  neq: "is not",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  contains: "contains",
  ncontains: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
  before: "is before",
  after: "is after",
  onOrBefore: "is on or before",
  onOrAfter: "is on or after",
  any: "is any of",
  none: "is none of",
  all: "is all of",
  isWithin: "is within",
};

export const DATE_ANCHORS: Array<{ value: DateFilterAnchor; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "yesterday", label: "Yesterday" },
  { value: "oneWeekAgo", label: "One week ago" },
  { value: "oneWeekFromNow", label: "One week from now" },
  { value: "oneMonthAgo", label: "One month ago" },
  { value: "oneMonthFromNow", label: "One month from now" },
];

export const DATE_RANGES: Array<{ value: DateFilterRange; label: string }> = [
  { value: "pastWeek", label: "Past week" },
  { value: "pastMonth", label: "Past month" },
  { value: "pastYear", label: "Past year" },
  { value: "thisWeek", label: "This week" },
  { value: "thisMonth", label: "This month" },
  { value: "thisYear", label: "This year" },
  { value: "nextWeek", label: "Next week" },
  { value: "nextMonth", label: "Next month" },
  { value: "nextYear", label: "Next year" },
];

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return Array.isArray((node as FilterGroup).children);
}

export function emptyFilterGroup(op: "and" | "or" = "and"): FilterGroup {
  return { op, children: [] };
}

export function defaultOperator(prop: IBaseProperty): FilterOperator {
  return operatorsFor(prop)[0];
}

export function defaultDateFilterValue(): DateFilterValue {
  return { mode: "relative", preset: "today" };
}

/** A condition is "complete" when the server can act on it. */
export function isConditionComplete(cond: FilterCondition, prop: IBaseProperty | undefined): boolean {
  if (!prop) return false;
  const kind = filterValueKind(prop, cond.op);
  if (kind === "none") return true;
  const v = cond.value;
  if (v === undefined || v === null) return kind === "boolean";
  if (typeof v === "string") return kind === "date" ? v !== "" : v !== "" || kind === "text";
  if (Array.isArray(v)) return kind === "text" || v.length > 0;
  return true;
}

/** Drop incomplete conditions and empty groups so the request stays valid. */
export function compactFilter(
  group: FilterGroup | undefined,
  propsById: ReadonlyMap<string, IBaseProperty>,
): FilterGroup | null {
  if (!group) return null;
  const children: FilterNode[] = [];
  for (const child of group.children ?? []) {
    if (isFilterGroup(child)) {
      const inner = compactFilter(child, propsById);
      if (inner) children.push(inner);
    } else if (isConditionComplete(child, propsById.get(child.propertyId))) {
      children.push(child);
    }
  }
  if (children.length === 0) return null;
  return { op: group.op, children };
}

export function countConditions(group: FilterGroup | undefined | null): number {
  if (!group) return 0;
  let n = 0;
  for (const child of group.children ?? []) {
    n += isFilterGroup(child) ? countConditions(child) : 1;
  }
  return n;
}
