import type { SelectTypeOptions } from "../../types";
import { asIdList, getChoice } from "../../model/cell-read";
import type { CellProps } from "./cell-types";
import { ChoiceBadge } from "./choice-badge";
import { ChoicePicker } from "./choice-picker";
import { EditorPopover } from "./editor-popover";
import classes from "../../styles/cells.module.css";

/** select, status and multiSelect cells. */
export function ChoiceCell(props: CellProps) {
  const { prop, value, variant, editing, editable, onCommit, onChange, onCancel, onRequestEdit } = props;
  const multiple = prop.type === "multiSelect";
  const ids = asIdList(value);
  const disableColors = !!(prop.typeOptions as SelectTypeOptions)?.disableColors;

  const display = (
    <span
      className={classes.badgeRow}
      data-variant={variant}
      data-empty={ids.length === 0 || undefined}
      onClick={(e) => {
        if (editable && !editing && variant !== "card") {
          e.stopPropagation();
          onRequestEdit();
        }
      }}
    >
      {ids.map((id) => {
        const choice = getChoice(prop, id);
        return choice ? <ChoiceBadge key={id} choice={choice} disableColors={disableColors} /> : null;
      })}
    </span>
  );

  if (!editable || variant === "card") return display;

  return (
    <EditorPopover opened={editing} onClose={onCancel} target={display}>
      {editing && (
        <ChoicePicker
          prop={prop}
          selected={ids}
          multiple={multiple}
          onPick={(id) => onCommit(id)}
          onToggle={(next) => onChange(next.length ? next : null)}
          onClose={onCancel}
        />
      )}
    </EditorPopover>
  );
}
