import type { BasePropertyType, IBaseProperty } from "../../types";
import { isWritableType } from "../../model/cell-read";
import { CheckboxCell } from "./cell-checkbox";
import { ChoiceCell } from "./cell-choice";
import { DateCell } from "./cell-date";
import { FileCell } from "./cell-file";
import { FormulaCell } from "./cell-formula";
import { LongTextCell } from "./cell-long-text";
import { NumberCell } from "./cell-number";
import { PageCell } from "./cell-page";
import { PersonCell } from "./cell-person";
import { LastEditedByCell, TimestampCell } from "./cell-system";
import { TextCell } from "./cell-text";
import type { CellComponent, CellProps, EditMode } from "./cell-types";

const COMPONENTS: Record<BasePropertyType, CellComponent> = {
  text: TextCell,
  url: TextCell,
  email: TextCell,
  longText: LongTextCell,
  number: NumberCell,
  checkbox: CheckboxCell,
  select: ChoiceCell,
  status: ChoiceCell,
  multiSelect: ChoiceCell,
  date: DateCell,
  person: PersonCell,
  page: PageCell,
  file: FileCell,
  formula: FormulaCell,
  createdAt: TimestampCell,
  lastEditedAt: TimestampCell,
  lastEditedBy: LastEditedByCell,
};

const EDIT_MODES: Record<BasePropertyType, EditMode> = {
  text: "inline",
  url: "inline",
  email: "inline",
  longText: "inline",
  number: "inline",
  checkbox: "toggle",
  select: "popover",
  status: "popover",
  multiSelect: "popover",
  date: "popover",
  person: "popover",
  page: "popover",
  file: "popover",
  formula: "none",
  createdAt: "none",
  lastEditedAt: "none",
  lastEditedBy: "none",
};

export function cellComponentFor(type: BasePropertyType): CellComponent {
  return COMPONENTS[type] ?? TextCell;
}

export function editModeFor(prop: IBaseProperty): EditMode {
  if (!isWritableType(prop.type)) return "none";
  return EDIT_MODES[prop.type] ?? "none";
}

/** Convenience wrapper so callers do not need the registry. */
export function Cell(props: CellProps) {
  const Component = cellComponentFor(props.prop.type);
  return <Component {...props} />;
}
