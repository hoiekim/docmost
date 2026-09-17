import { formatTimestamp } from "../../model/cell-format";
import { useBase } from "../base-context";
import type { CellProps } from "./cell-types";
import { UserChip } from "./user-chip";
import classes from "../../styles/cells.module.css";

/** createdAt / lastEditedAt: read-only timestamps from row metadata. */
export function TimestampCell({ value, variant }: CellProps) {
  const text = formatTimestamp(value);
  return (
    <span className={classes.textValue} data-variant={variant} title={text}>
      {text}
    </span>
  );
}

/** lastEditedBy: read-only user chip. */
export function LastEditedByCell({ value, variant }: CellProps) {
  const { refs } = useBase();
  const id = typeof value === "string" ? value : null;
  return (
    <span className={classes.chipRow} data-variant={variant} data-empty={!id || undefined}>
      {id && <UserChip id={id} user={refs.users[id]} />}
    </span>
  );
}
