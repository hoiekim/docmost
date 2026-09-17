import { useCallback } from "react";
import type { IBaseProperty, IBaseRow } from "../../types";
import { cellToText } from "../../model/cell-format";
import { readCell } from "../../model/cell-read";
import { editModeFor } from "../cells/cell-registry";
import type { CellAddress } from "../../state/atoms";
import type { RowReferences } from "../../types";

type Args = {
  rows: IBaseRow[];
  columns: IBaseProperty[];
  focused: CellAddress | null;
  editing: CellAddress | null;
  editable: boolean;
  refs: RowReferences;
  setFocused: (cell: CellAddress | null) => void;
  startEdit: (cell: CellAddress, seedText?: string) => void;
  updateCells: (rowId: string, cells: Record<string, unknown>) => void;
  openRow: (rowId: string) => void;
};

/** Spreadsheet-style navigation for the grid's scroll container. */
export function useGridKeyboard({
  rows,
  columns,
  focused,
  editing,
  editable,
  refs,
  setFocused,
  startEdit,
  updateCells,
  openRow,
}: Args) {
  return useCallback(
    (e: React.KeyboardEvent) => {
      if (editing) return; // editors stop propagation themselves; be safe
      if (!focused) return;
      const rowIdx = rows.findIndex((r) => r.id === focused.rowId);
      const colIdx = columns.findIndex((c) => c.id === focused.propertyId);
      if (rowIdx === -1 || colIdx === -1) return;
      const row = rows[rowIdx];
      const prop = columns[colIdx];
      const mode = editModeFor(prop);
      const canWrite = editable && mode !== "none";

      const move = (dr: number, dc: number) => {
        let r = rowIdx + dr;
        let c = colIdx + dc;
        if (c >= columns.length) {
          c = 0;
          r += 1;
        } else if (c < 0) {
          c = columns.length - 1;
          r -= 1;
        }
        r = Math.max(0, Math.min(rows.length - 1, r));
        c = Math.max(0, Math.min(columns.length - 1, c));
        setFocused({ rowId: rows[r].id, propertyId: columns[c].id });
      };

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          move(1, 0);
          return;
        case "ArrowUp":
          e.preventDefault();
          move(-1, 0);
          return;
        case "ArrowRight":
          e.preventDefault();
          move(0, 1);
          return;
        case "ArrowLeft":
          e.preventDefault();
          move(0, -1);
          return;
        case "Tab":
          e.preventDefault();
          move(0, e.shiftKey ? -1 : 1);
          return;
        case "Escape":
          e.preventDefault();
          setFocused(null);
          return;
        case "Enter":
          e.preventDefault();
          if (e.shiftKey) {
            openRow(row.id);
          } else if (canWrite && mode === "toggle") {
            updateCells(row.id, { [prop.id]: readCell(row, prop) !== true });
          } else if (canWrite) {
            startEdit(focused);
          } else {
            openRow(row.id);
          }
          return;
        case " ":
          if (canWrite && mode === "toggle") {
            e.preventDefault();
            updateCells(row.id, { [prop.id]: readCell(row, prop) !== true });
          } else if (!e.ctrlKey && !e.metaKey && !e.altKey && canWrite && mode === "inline") {
            e.preventDefault();
            startEdit(focused, " ");
          }
          return;
        case "Delete":
        case "Backspace":
          if (canWrite) {
            e.preventDefault();
            updateCells(row.id, { [prop.id]: null });
          }
          return;
        default:
          break;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        const text = cellToText(readCell(row, prop), prop, refs);
        void navigator.clipboard?.writeText(text);
        return;
      }

      // Printable character: start typing into inline editors.
      if (
        canWrite &&
        mode === "inline" &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        startEdit(focused, e.key);
      }
    },
    [rows, columns, focused, editing, editable, refs, setFocused, startEdit, updateCells, openRow],
  );
}
