import { memo } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { IBaseProperty, IBaseRow } from "../../types";
import { readCell } from "../../model/cell-read";
import { Cell } from "../cells/cell-registry";
import { editModeFor } from "../cells/cell-registry";
import classes from "../../styles/table.module.css";

type Props = {
  row: IBaseRow;
  prop: IBaseProperty;
  width: number;
  editable: boolean;
  focused: boolean;
  editing: boolean;
  seedText?: string;
  onFocus: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onCommit: (value: unknown) => void;
  onChange: (value: unknown) => void;
  onOpenRow: () => void;
};

function GridCellImpl({
  row,
  prop,
  width,
  editable,
  focused,
  editing,
  seedText,
  onFocus,
  onStartEdit,
  onStopEdit,
  onCommit,
  onChange,
  onOpenRow,
}: Props) {
  const { t } = useTranslation();
  const mode = editModeFor(prop);
  const canWrite = editable && mode !== "none";
  const value = readCell(row, prop);

  return (
    <div
      className={classes.cell}
      role="gridcell"
      data-focused={focused || undefined}
      data-editing={editing || undefined}
      data-primary={prop.isPrimary || undefined}
      data-type={prop.type}
      style={{ width, minWidth: width }}
      onMouseDown={(e) => {
        // Let inputs/popovers keep their own handling.
        if (editing) return;
        if (e.button !== 0) return;
        onFocus();
      }}
      onDoubleClick={() => {
        if (canWrite && !editing && mode !== "toggle") onStartEdit();
      }}
    >
      <Cell
        prop={prop}
        row={row}
        value={value}
        variant="grid"
        editable={canWrite}
        editing={editing}
        seedText={seedText}
        onCommit={(v) => {
          onCommit(v);
          onStopEdit();
        }}
        onChange={onChange}
        onCancel={onStopEdit}
        onRequestEdit={() => {
          onFocus();
          if (canWrite) onStartEdit();
        }}
      />
      {prop.isPrimary && !editing && (
        <Tooltip label={t("Open")} openDelay={500} withArrow>
          <ActionIcon
            variant="default"
            size="xs"
            className={classes.expandButton}
            aria-label={t("Open row")}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onOpenRow();
            }}
          >
            <IconArrowsMaximize size={12} />
          </ActionIcon>
        </Tooltip>
      )}
    </div>
  );
}

export const GridCell = memo(GridCellImpl);
