import type { CellProps } from "./cell-types";
import { InlineInput } from "./cell-text";
import classes from "../../styles/cells.module.css";

export function LongTextCell({ value, variant, editing, editable, onCommit, onCancel, seedText }: CellProps) {
  const text = value === null || value === undefined ? "" : String(value);

  if (editing && editable) {
    return (
      <div className={variant === "grid" ? classes.longTextOverlay : classes.longTextField}>
        <InlineInput
          initial={seedText !== undefined ? seedText : text}
          multiline
          onCommit={(v) => onCommit(v === "" ? null : v)}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return (
    <span className={classes.longTextValue} data-variant={variant} title={variant === "grid" ? text : undefined}>
      {text}
    </span>
  );
}
