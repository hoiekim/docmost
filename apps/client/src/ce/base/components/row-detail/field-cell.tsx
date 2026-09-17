import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { IBaseProperty, IBaseRow } from "../../types";
import { isEmptyValue, readCell } from "../../model/cell-read";
import { useBase } from "../base-context";
import { Cell, editModeFor } from "../cells/cell-registry";
import classes from "../../styles/row-detail.module.css";

type Props = {
  prop: IBaseProperty;
  row: IBaseRow;
};

/**
 * One property value inside the row detail modal. Hosts a `field` variant
 * cell and owns its edit state; clicking the field area enters edit mode.
 */
export function FieldCell({ prop, row }: Props) {
  const { t } = useTranslation();
  const { editable, updateCells } = useBase();
  const [editing, setEditing] = useState(false);
  // Set on mousedown while an editor is open so the click that closed it
  // (picker outside-click, input blur) does not immediately reopen it.
  const closingClick = useRef(false);

  const mode = editModeFor(prop);
  const canWrite = editable && mode !== "none";
  const clickable = canWrite && mode !== "toggle";
  const value = readCell(row, prop);
  const showEmpty = !editing && mode !== "toggle" && isEmptyValue(value);

  const commit = (v: unknown) => {
    updateCells(row.id, { [prop.id]: v });
    setEditing(false);
  };

  return (
    <div
      className={classes.fieldValue}
      data-clickable={clickable || undefined}
      data-editing={editing || undefined}
      data-type={prop.type}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        closingClick.current = editing;
      }}
      onClick={() => {
        if (closingClick.current) {
          closingClick.current = false;
          return;
        }
        if (clickable && !editing) setEditing(true);
      }}
    >
      {showEmpty && <span className={classes.empty}>{t("Empty")}</span>}
      <Cell
        prop={prop}
        row={row}
        value={value}
        variant="field"
        editable={canWrite}
        editing={editing}
        onCommit={commit}
        onChange={(v) => updateCells(row.id, { [prop.id]: v })}
        onCancel={() => setEditing(false)}
        onRequestEdit={() => {
          if (clickable) setEditing(true);
        }}
      />
    </div>
  );
}
