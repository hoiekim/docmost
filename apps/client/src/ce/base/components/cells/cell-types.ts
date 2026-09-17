import type { ComponentType } from "react";
import type { IBaseProperty, IBaseRow } from "../../types";

/** Where a cell is rendered; affects density and truncation. */
export type CellVariant = "grid" | "field" | "card";

export type CellProps = {
  prop: IBaseProperty;
  row: IBaseRow;
  value: unknown;
  variant: CellVariant;
  /** The user may change this value. */
  editable: boolean;
  /** Edit mode is active (inline input or picker popover). */
  editing: boolean;
  /** Save and leave edit mode. */
  onCommit: (value: unknown) => void;
  /** Save but stay in edit mode (multi-value pickers). */
  onChange: (value: unknown) => void;
  /** Leave edit mode without saving. */
  onCancel: () => void;
  /** Ask the host to enter edit mode (e.g. click on a badge). */
  onRequestEdit: () => void;
  /** Text typed while the cell was focused, used to seed inline editors. */
  seedText?: string;
};

export type CellComponent = ComponentType<CellProps>;

/**
 * How the grid enters edit mode for a type:
 * - inline: an input replaces the display; typing a character seeds it
 * - popover: a picker opens next to the display
 * - toggle: Enter flips the value, no edit mode
 * - none: read-only
 */
export type EditMode = "inline" | "popover" | "toggle" | "none";
