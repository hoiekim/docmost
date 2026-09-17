import type { BasePropertyType } from "../types";
import { isChoiceType } from "./cell-read";

/**
 * Human explanation of what happens to existing cells when a property
 * changes type. Mirrors convertCell() in
 * apps/server/src/ce/base/engine/cell-converter.ts. Returns null when the
 * conversion keeps every value.
 */
export function conversionWarning(from: BasePropertyType, to: BasePropertyType): string | null {
  if (from === to) return null;
  const textLike = (t: BasePropertyType) =>
    t === "text" || t === "longText" || t === "url" || t === "email";

  switch (to) {
    case "text":
    case "longText":
      if (textLike(from)) return null;
      return "Existing values will be converted to their text form.";
    case "url":
    case "email":
      return `Values that are not valid ${to === "url" ? "URLs" : "email addresses"} will be cleared.`;
    case "select":
    case "status":
      if (isChoiceType(from)) {
        return from === "multiSelect"
          ? "Only the first option of each cell will be kept."
          : null;
      }
      return "Existing values cannot become options and will be cleared.";
    case "multiSelect":
      if (isChoiceType(from)) return null;
      return "Existing values cannot become options and will be cleared.";
    case "number":
      return "Values that cannot be read as a number will be cleared.";
    case "date":
      return "Values that cannot be read as a date will be cleared.";
    case "checkbox":
      return "Values will become checked when they read as true, yes or a non-zero number.";
    case "person":
      if (from === "person") return null;
      return "Existing values will be cleared.";
    case "page":
    case "file":
      return "Existing values will be cleared.";
    default:
      return "Existing values may be changed or cleared.";
  }
}
