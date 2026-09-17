import type {
  BasePropertyType,
  Choice,
  FileValue,
  FormulaErrorCell,
  IBaseProperty,
  IBaseRow,
  SelectTypeOptions,
} from "../types";
import { SYSTEM_PROPERTY_TYPES } from "../types";

/** Value of a property for a row; system properties come from row metadata. */
export function readCell(row: IBaseRow, prop: IBaseProperty): unknown {
  switch (prop.type) {
    case "createdAt":
      return row.createdAt;
    case "lastEditedAt":
      return row.updatedAt;
    case "lastEditedBy":
      return row.lastUpdatedById ?? row.creatorId;
    default:
      return row.cells?.[prop.id];
  }
}

export function isSystemType(type: BasePropertyType): boolean {
  return SYSTEM_PROPERTY_TYPES.includes(type);
}

/** Whether users may type into cells of this property. */
export function isWritableType(type: BasePropertyType): boolean {
  return type !== "formula" && !isSystemType(type);
}

export function isChoiceType(type: BasePropertyType): boolean {
  return type === "select" || type === "status" || type === "multiSelect";
}

export function getChoices(prop: IBaseProperty): Choice[] {
  const opts = prop.typeOptions as Partial<SelectTypeOptions> | undefined;
  const choices = Array.isArray(opts?.choices) ? opts.choices : [];
  const order = Array.isArray(opts?.choiceOrder) ? opts.choiceOrder : [];
  if (order.length === 0) return choices;
  const byId = new Map(choices.map((c) => [c.id, c]));
  const ordered: Choice[] = [];
  for (const id of order) {
    const c = byId.get(id);
    if (c) {
      ordered.push(c);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}

export function getChoice(prop: IBaseProperty, id: unknown): Choice | undefined {
  if (typeof id !== "string") return undefined;
  return getChoices(prop).find((c) => c.id === id);
}

export function asIdList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value !== "") return [value];
  return [];
}

export function asFileList(value: unknown): FileValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (f): f is FileValue => !!f && typeof f === "object" && typeof f.id === "string",
  );
}

export function isFormulaError(value: unknown): value is FormulaErrorCell {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as FormulaErrorCell).__err === "string"
  );
}

export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Structural equality good enough for cell values (JSON-ish data). */
export function sameCellValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}
