import { Checkbox } from "@mantine/core";
import type { CellProps } from "./cell-types";
import classes from "../../styles/cells.module.css";

export function CheckboxCell({ value, editable, onCommit, variant }: CellProps) {
  const checked = value === true;
  return (
    <span className={classes.checkboxValue} data-variant={variant}>
      <Checkbox
        size="sm"
        checked={checked}
        readOnly={!editable}
        disabled={!editable && variant === "card"}
        onChange={(e) => {
          if (editable) onCommit(e.currentTarget.checked);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        aria-label={checked ? "Checked" : "Unchecked"}
        styles={{ input: { cursor: editable ? "pointer" : "default" } }}
      />
    </span>
  );
}
