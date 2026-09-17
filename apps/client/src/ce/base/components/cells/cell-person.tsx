import type { PersonTypeOptions } from "../../types";
import { asIdList } from "../../model/cell-read";
import { useBase } from "../base-context";
import type { CellProps } from "./cell-types";
import { EditorPopover } from "./editor-popover";
import { PersonPicker } from "./person-picker";
import { UserChip } from "./user-chip";
import classes from "../../styles/cells.module.css";

export function PersonCell(props: CellProps) {
  const { prop, value, variant, editing, editable, onCommit, onChange, onCancel, onRequestEdit } = props;
  const { refs } = useBase();
  const multiple = !!(prop.typeOptions as PersonTypeOptions)?.allowMultiple;
  const ids = asIdList(value);

  const display = (
    <span
      className={classes.chipRow}
      data-variant={variant}
      data-empty={ids.length === 0 || undefined}
      onClick={(e) => {
        if (editable && !editing && variant !== "card") {
          e.stopPropagation();
          onRequestEdit();
        }
      }}
    >
      {ids.map((id) => (
        <UserChip key={id} id={id} user={refs.users[id]} compact={variant === "card" && ids.length > 2} />
      ))}
    </span>
  );

  if (!editable || variant === "card") return display;

  return (
    <EditorPopover opened={editing} onClose={onCancel} target={display}>
      {editing && (
        <PersonPicker
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
