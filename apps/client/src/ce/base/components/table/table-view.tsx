import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Checkbox, Loader, Text, UnstyledButton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { IBaseProperty, SortDirection } from "../../types";
import { columnWidth, visibleTableProperties, viewOrderedProperties } from "../../model/view-config";
import { moveInList, positionBetween, sortByPosition } from "../../positions";
import { editingCellAtom, focusedCellAtom, selectedRowsAtom, type CellAddress } from "../../state/atoms";
import { useBase } from "../base-context";
import { AddPropertyButton } from "./add-property-button";
import { GridCell } from "./grid-cell";
import { HeaderCell } from "./header-cell";
import { RowNumberCell } from "./row-number-cell";
import { SelectionBar } from "./selection-bar";
import { useColumnResize } from "./use-column-resize";
import { useGridKeyboard } from "./use-grid-keyboard";
import { ADD_COLUMN_WIDTH, HEADER_HEIGHT, ROW_HEIGHT, ROW_NUMBER_WIDTH } from "./grid-constants";
import classes from "../../styles/table.module.css";

export function TableView() {
  const { t } = useTranslation();
  const {
    pageId,
    base,
    config,
    patchConfig,
    editable,
    embedded,
    refs,
    rows,
    rowsStatus,
    isFetchingRows,
    hasMoreRows,
    loadMoreRows,
    updateCells,
    createRow,
    deleteRows,
    reorderRow,
    openRow,
  } = useBase();

  const columns = useMemo(() => visibleTableProperties(base, config), [base, config]);
  const [focused, setFocused] = useAtom(focusedCellAtom(pageId));
  const [editing, setEditing] = useAtom(editingCellAtom(pageId));
  const [selected, setSelected] = useAtom(selectedRowsAtom(pageId));
  const [seed, setSeed] = useState<{ cell: CellAddress; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSelectedRef = useRef<string | null>(null);

  // Drop stale focus/selection when rows or columns disappear.
  useEffect(() => {
    if (focused && (!rows.some((r) => r.id === focused.rowId) || !columns.some((c) => c.id === focused.propertyId))) {
      setFocused(null);
      setEditing(null);
    }
  }, [rows, columns, focused, setFocused, setEditing]);

  useEffect(() => {
    if (selected.size === 0) return;
    const ids = new Set(rows.map((r) => r.id));
    if ([...selected].some((id) => !ids.has(id))) {
      setSelected(new Set([...selected].filter((id) => ids.has(id))));
    }
  }, [rows, selected, setSelected]);

  // ---- column widths / resize ----
  const commitWidth = useCallback(
    (propertyId: string, width: number) =>
      patchConfig({ propertyWidths: { ...(config.propertyWidths ?? {}), [propertyId]: width } }),
    [patchConfig, config.propertyWidths],
  );
  const { override, startResize, resizing } = useColumnResize(commitWidth);
  const widthOf = useCallback(
    (prop: IBaseProperty) => (override?.id === prop.id ? override.width : columnWidth(prop, config)),
    [override, config],
  );
  const totalWidth = ROW_NUMBER_WIDTH + columns.reduce((sum, c) => sum + widthOf(c), 0) + (editable ? ADD_COLUMN_WIDTH : 0);

  // ---- sorting / hiding / reordering columns ----
  const sortOf = (prop: IBaseProperty): SortDirection | null =>
    config.sorts?.find((s) => s.propertyId === prop.id)?.direction ?? null;
  const setSort = (prop: IBaseProperty, direction: SortDirection | null) => {
    const others = (config.sorts ?? []).filter((s) => s.propertyId !== prop.id);
    const next = direction ? [{ propertyId: prop.id, direction }, ...others] : others;
    patchConfig({ sorts: next.length ? next : null });
  };
  const hideColumn = (prop: IBaseProperty) =>
    patchConfig({ hiddenPropertyIds: [...(config.hiddenPropertyIds ?? []), prop.id] });
  const reorderColumn = useCallback(
    (draggedId: string, targetId: string, edge: "before" | "after") => {
      const ids = viewOrderedProperties(base, config)
        .filter((p) => !p.isPrimary)
        .map((p) => p.id);
      patchConfig({ propertyOrder: moveInList(ids, draggedId, targetId, edge) });
    },
    [base, config, patchConfig],
  );

  // ---- rows: selection, reorder, create ----
  const toggleSelected = useCallback(
    (rowId: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedRef.current) {
          const a = rows.findIndex((r) => r.id === lastSelectedRef.current);
          const b = rows.findIndex((r) => r.id === rowId);
          if (a !== -1 && b !== -1) {
            for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(rows[i].id);
            return next;
          }
        }
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
        lastSelectedRef.current = rowId;
        return next;
      });
    },
    [rows, setSelected],
  );
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const canDragRows = editable && !(config.sorts?.length) && !config.filter;
  const dropRow = useCallback(
    (draggedId: string, targetId: string, edge: "before" | "after") => {
      const ordered = sortByPosition(rows).filter((r) => r.id !== draggedId);
      const idx = ordered.findIndex((r) => r.id === targetId);
      if (idx === -1) return;
      const insertAt = edge === "before" ? idx : idx + 1;
      const before = insertAt > 0 ? ordered[insertAt - 1].position : null;
      const after = insertAt < ordered.length ? ordered[insertAt].position : null;
      reorderRow(draggedId, positionBetween(before, after));
    },
    [rows, reorderRow],
  );

  const [creating, setCreating] = useState(false);
  const addRow = async () => {
    setCreating(true);
    try {
      const row = await createRow();
      const primary = columns.find((c) => c.isPrimary) ?? columns[0];
      if (primary) {
        setFocused({ rowId: row.id, propertyId: primary.id });
        setEditing({ rowId: row.id, propertyId: primary.id });
      }
    } catch {
      // reported by the mutation
    } finally {
      setCreating(false);
    }
  };

  // ---- keyboard ----
  const startEdit = useCallback(
    (cell: CellAddress, seedText?: string) => {
      setSeed(seedText !== undefined ? { cell, text: seedText } : null);
      setEditing(cell);
    },
    [setEditing],
  );
  const stopEdit = useCallback(() => {
    setEditing(null);
    setSeed(null);
    scrollRef.current?.focus({ preventScroll: true });
  }, [setEditing]);
  const onKeyDown = useGridKeyboard({
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
  });

  // ---- virtualization (full-page mode only; embeds grow with content) ----
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: !embedded,
  });
  const virtualItems = embedded ? null : virtualizer.getVirtualItems();
  const bodyHeight = embedded ? undefined : virtualizer.getTotalSize();

  // Auto-load the next page when the virtual window nears the end.
  useEffect(() => {
    if (embedded || !hasMoreRows || isFetchingRows) return;
    const last = virtualItems?.[virtualItems.length - 1];
    if (last && last.index >= rows.length - 20) loadMoreRows();
  }, [virtualItems, embedded, hasMoreRows, isFetchingRows, rows.length, loadMoreRows]);

  // Keep the focused cell in view when navigating by keyboard.
  useEffect(() => {
    if (!focused || embedded) return;
    const idx = rows.findIndex((r) => r.id === focused.rowId);
    if (idx !== -1) virtualizer.scrollToIndex(idx, { align: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused?.rowId]);

  const renderRow = (rowIndex: number, style?: React.CSSProperties) => {
    const row = rows[rowIndex];
    return (
      <GridRow
        key={row.id}
        rowId={row.id}
        index={rowIndex}
        style={style}
        selected={selected.has(row.id)}
        onToggleSelected={(shift) => toggleSelected(row.id, shift)}
        canDrag={canDragRows}
        onDropRow={dropRow}
      >
        {columns.map((prop) => {
          const isFocused = focused?.rowId === row.id && focused.propertyId === prop.id;
          const isEditing = isFocused && editing?.rowId === row.id && editing.propertyId === prop.id;
          return (
            <GridCell
              key={prop.id}
              row={row}
              prop={prop}
              width={widthOf(prop)}
              editable={editable}
              focused={isFocused}
              editing={isEditing}
              seedText={isEditing && seed?.cell.rowId === row.id && seed.cell.propertyId === prop.id ? seed.text : undefined}
              onFocus={() => {
                if (!isFocused) {
                  setEditing(null);
                  setFocused({ rowId: row.id, propertyId: prop.id });
                }
                scrollRef.current?.focus({ preventScroll: true });
              }}
              onStartEdit={() => startEdit({ rowId: row.id, propertyId: prop.id })}
              onStopEdit={stopEdit}
              onCommit={(v) => updateCells(row.id, { [prop.id]: v })}
              onChange={(v) => updateCells(row.id, { [prop.id]: v })}
              onOpenRow={() => openRow(row.id)}
            />
          );
        })}
        {editable && <div className={classes.addColumnSpacer} style={{ width: ADD_COLUMN_WIDTH }} />}
      </GridRow>
    );
  };

  return (
    <div className={classes.root} data-embedded={embedded || undefined} data-resizing={resizing || undefined}>
      <SelectionBar
        count={selected.size}
        editable={editable}
        onClear={() => setSelected(new Set())}
        onDelete={() => {
          deleteRows([...selected]);
          setSelected(new Set());
        }}
      />
      <div
        ref={scrollRef}
        className={classes.scrollport}
        tabIndex={0}
        role="grid"
        aria-rowcount={rows.length}
        aria-colcount={columns.length}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          // Clicking empty space clears the focus ring.
          if (e.target === e.currentTarget) {
            setFocused(null);
            setEditing(null);
          }
        }}
      >
        <div className={classes.table} style={{ width: totalWidth, minWidth: "100%" }}>
          <div className={classes.headerRow} style={{ height: HEADER_HEIGHT }} role="row">
            <div className={classes.rowNumberHeader} style={{ width: ROW_NUMBER_WIDTH }}>
              <Checkbox
                size="xs"
                checked={allSelected}
                indeterminate={!allSelected && selected.size > 0}
                onChange={toggleAll}
                aria-label={t("Select all rows")}
              />
            </div>
            {columns.map((prop) => (
              <HeaderCell
                key={prop.id}
                prop={prop}
                width={widthOf(prop)}
                sortDirection={sortOf(prop)}
                onResizeStart={startResize(prop.id, widthOf(prop))}
                onSort={(d) => setSort(prop, d)}
                onHide={() => hideColumn(prop)}
                onReorder={reorderColumn}
              />
            ))}
            {editable && <AddPropertyButton />}
          </div>

          <div className={classes.body} style={bodyHeight !== undefined ? { height: bodyHeight } : undefined}>
            {virtualItems
              ? virtualItems.map((item) =>
                  renderRow(item.index, {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                  }),
                )
              : rows.map((_, i) => renderRow(i))}
          </div>

          {rowsStatus === "pending" && (
            <div className={classes.footerRow}>
              <Loader size="xs" />
            </div>
          )}
          {rowsStatus === "error" && (
            <div className={classes.footerRow}>
              <Text size="sm" c="red">
                {t("Failed to load rows.")}
              </Text>
            </div>
          )}
          {rowsStatus === "success" && rows.length === 0 && (
            <div className={classes.footerRow}>
              <Text size="sm" c="dimmed">
                {config.filter ? t("No rows match the current filter.") : t("No rows yet.")}
              </Text>
            </div>
          )}
          {editable && (
            <UnstyledButton className={classes.addRow} onClick={() => void addRow()} disabled={creating}>
              {creating ? <Loader size={12} /> : <IconPlus size={14} />}
              <span>{t("New row")}</span>
            </UnstyledButton>
          )}
          {hasMoreRows && (
            <div className={classes.footerRow}>
              <Button size="compact-xs" variant="subtle" onClick={loadMoreRows} loading={isFetchingRows}>
                {t("Load more")}
              </Button>
            </div>
          )}
          {rowsStatus === "success" && rows.length > 0 && (
            <div className={classes.countRow}>
              <Text size="xs" c="dimmed">
                {hasMoreRows
                  ? t("{{count}}+ rows", { count: rows.length })
                  : t("{{count}} rows", { count: rows.length })}
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type GridRowProps = {
  rowId: string;
  index: number;
  style?: React.CSSProperties;
  selected: boolean;
  onToggleSelected: (shiftKey: boolean) => void;
  canDrag: boolean;
  onDropRow: (draggedId: string, targetId: string, edge: "before" | "after") => void;
  children: React.ReactNode;
};

function GridRow({ rowId, index, style, selected, onToggleSelected, canDrag, onDropRow, children }: GridRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={classes.row}
      role="row"
      aria-rowindex={index + 1}
      data-selected={selected || undefined}
      style={{ height: ROW_HEIGHT, ...style }}
    >
      <RowNumberCell
        rowId={rowId}
        index={index}
        selected={selected}
        onToggleSelected={onToggleSelected}
        canDrag={canDrag}
        onDropRow={onDropRow}
        rowRef={ref}
      />
      {children}
    </div>
  );
}
