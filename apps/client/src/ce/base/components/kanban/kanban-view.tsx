import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Button, Loader, Menu, Text, UnstyledButton } from "@mantine/core";
import { IconDotsVertical, IconEye, IconEyeOff, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import type { Choice, IBaseProperty, IBaseRow, SelectTypeOptions } from "../../types";
import { NO_VALUE_CHOICE_ID } from "../../types";
import { kanbanCardProperties } from "../../model/view-config";
import { asIdList, getChoices, isEmptyValue, readCell } from "../../model/cell-read";
import { cellToText } from "../../model/cell-format";
import { moveInList, positionBetween, sortByPosition } from "../../positions";
import { useBase } from "../base-context";
import { Cell } from "../cells/cell-registry";
import { ChoiceBadge } from "../cells/choice-badge";
import { resolveGroupProperty } from "./kanban-settings";
import classes from "../../styles/kanban.module.css";

const CARD_DRAG_TYPE = "base-kanban-card";
const COLUMN_DRAG_TYPE = "base-kanban-column";

type KanbanColumn = {
  id: string;
  /** `null` for the trailing "No value" column. */
  choice: Choice | null;
  rows: IBaseRow[];
};

type CardDrop = {
  rowId: string;
  sourceColumnId: string;
  targetColumnId: string;
  /** Card the drag ended over, if any; otherwise the column itself. */
  targetRowId: string | null;
  edge: "before" | "after";
};

const noop = () => undefined;

export function KanbanView() {
  const { t } = useTranslation();
  const {
    base,
    config,
    patchConfig,
    editable,
    embedded,
    rows,
    rowsStatus,
    hasMoreRows,
    isFetchingRows,
    loadMoreRows,
    updateCells,
    createRow,
    reorderRow,
    openRow,
  } = useBase();

  const groupProp = useMemo(() => resolveGroupProperty(base, config), [base, config]);
  const cardProps = useMemo(() => kanbanCardProperties(base, config), [base, config]);
  const canReorder = editable && (config.sorts?.length ?? 0) === 0;

  // Grouping needs every row; drain the pages as soon as they are available.
  useEffect(() => {
    if (hasMoreRows && !isFetchingRows) loadMoreRows();
  }, [hasMoreRows, isFetchingRows, loadMoreRows]);

  // Choice ids in board order: configured order first, then the rest as the
  // property lists them. Unknown ids in the config are dropped.
  const choiceIds = useMemo(() => {
    if (!groupProp) return [];
    const known = new Set(getChoices(groupProp).map((c) => c.id));
    const out: string[] = [];
    for (const id of config.choiceOrder ?? []) {
      if (known.has(id) && !out.includes(id)) out.push(id);
    }
    for (const id of known) if (!out.includes(id)) out.push(id);
    return out;
  }, [groupProp, config.choiceOrder]);

  const columns = useMemo<KanbanColumn[]>(() => {
    if (!groupProp) return [];
    const choicesById = new Map(getChoices(groupProp).map((c) => [c.id, c]));
    const buckets = new Map<string, IBaseRow[]>();
    for (const id of choiceIds) buckets.set(id, []);
    buckets.set(NO_VALUE_CHOICE_ID, []);
    for (const row of rows) {
      const id = asIdList(readCell(row, groupProp))[0];
      const bucket = id !== undefined ? buckets.get(id) : undefined;
      (bucket ?? buckets.get(NO_VALUE_CHOICE_ID)!).push(row);
    }
    const sorted = config.sorts?.length ? (list: IBaseRow[]) => list : sortByPosition;
    return [...choiceIds, NO_VALUE_CHOICE_ID].map((id) => ({
      id,
      choice: choicesById.get(id) ?? null,
      rows: sorted(buckets.get(id) ?? []),
    }));
  }, [groupProp, choiceIds, rows, config.sorts]);

  const hiddenIds = useMemo(() => new Set(config.hiddenChoiceIds ?? []), [config.hiddenChoiceIds]);
  const visibleColumns = columns.filter((c) => !hiddenIds.has(c.id));
  const hiddenColumns = columns.filter((c) => hiddenIds.has(c.id));

  const hideColumn = useCallback(
    (id: string) => {
      if (hiddenIds.has(id)) return;
      patchConfig({ hiddenChoiceIds: [...hiddenIds, id] });
    },
    [hiddenIds, patchConfig],
  );
  const showColumn = useCallback(
    (id: string) => {
      const rest = [...hiddenIds].filter((x) => x !== id);
      patchConfig({ hiddenChoiceIds: rest.length ? rest : null });
    },
    [hiddenIds, patchConfig],
  );

  const reorderColumn = useCallback(
    (draggedId: string, targetId: string, edge: "before" | "after") => {
      patchConfig({ choiceOrder: moveInList(choiceIds, draggedId, targetId, edge) });
    },
    [choiceIds, patchConfig],
  );

  const dropCard = useCallback(
    ({ rowId, sourceColumnId, targetColumnId, targetRowId, edge }: CardDrop) => {
      if (!groupProp) return;
      const column = columns.find((c) => c.id === targetColumnId);
      if (!column) return;
      if (sourceColumnId !== targetColumnId) {
        updateCells(rowId, {
          [groupProp.id]: targetColumnId === NO_VALUE_CHOICE_ID ? null : targetColumnId,
        });
      }
      if (!canReorder) return;
      const others = column.rows.filter((r) => r.id !== rowId);
      let index = others.length;
      if (targetRowId) {
        const i = others.findIndex((r) => r.id === targetRowId);
        if (i !== -1) index = edge === "before" ? i : i + 1;
      }
      if (sourceColumnId === targetColumnId) {
        const current = column.rows.findIndex((r) => r.id === rowId);
        if (current === index) return;
      }
      reorderRow(rowId, positionBetween(others[index - 1]?.position, others[index]?.position));
    },
    [groupProp, columns, canReorder, updateCells, reorderRow],
  );

  const addCard = useCallback(
    async (columnId: string) => {
      if (!groupProp) return;
      const cells = columnId === NO_VALUE_CHOICE_ID ? undefined : { [groupProp.id]: columnId };
      const row = await createRow(cells ? { cells } : undefined);
      openRow(row.id);
    },
    [groupProp, createRow, openRow],
  );

  if (!groupProp) {
    return (
      <div className={classes.root} data-embedded={embedded || undefined}>
        <div className={classes.empty}>
          <Text size="sm" c="dimmed">
            {t("Add a select or status property to use the kanban view")}
          </Text>
        </div>
      </div>
    );
  }

  if (rowsStatus === "pending") {
    return (
      <div className={classes.root} data-embedded={embedded || undefined}>
        <div className={classes.empty}>
          <Loader size="sm" />
        </div>
      </div>
    );
  }

  const disableColors = !!(groupProp.typeOptions as SelectTypeOptions)?.disableColors;

  return (
    <div className={classes.root} data-embedded={embedded || undefined}>
      <div className={classes.board}>
        {visibleColumns.map((column) => (
          <ColumnView
            key={column.id}
            column={column}
            groupProp={groupProp}
            cardProps={cardProps}
            disableColors={disableColors}
            editable={editable}
            onHide={hideColumn}
            onReorderColumn={reorderColumn}
            onDropCard={dropCard}
            onAddCard={addCard}
          />
        ))}
        {hiddenColumns.length > 0 && (
          <div className={classes.hiddenColumns}>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<IconEyeOff size={14} />}
                >
                  {t("Hidden columns ({{count}})", { count: hiddenColumns.length })}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t("Hidden columns")}</Menu.Label>
                {hiddenColumns.map((column) => (
                  <Menu.Item
                    key={column.id}
                    leftSection={<IconEye size={14} />}
                    onClick={() => showColumn(column.id)}
                  >
                    <span className={classes.hiddenColumnLabel}>
                      {column.choice ? (
                        <ChoiceBadge choice={column.choice} disableColors={disableColors} size="xs" />
                      ) : (
                        <Text size="sm" c="dimmed" span>
                          {t("No value")}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed" span>
                        {column.rows.length}
                      </Text>
                    </span>
                  </Menu.Item>
                ))}
                {hiddenColumns.length > 1 && (
                  <>
                    <Menu.Divider />
                    <Menu.Item onClick={() => patchConfig({ hiddenChoiceIds: null })}>
                      {t("Show all columns")}
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </div>
        )}
      </div>
      {hasMoreRows && (
        <div className={classes.loadingMore}>
          <Loader size="xs" />
          <Text size="xs" c="dimmed">
            {t("Loading rows…")}
          </Text>
        </div>
      )}
    </div>
  );
}

// ---- column ----

type ColumnProps = {
  column: KanbanColumn;
  groupProp: IBaseProperty;
  cardProps: IBaseProperty[];
  disableColors: boolean;
  editable: boolean;
  onHide: (columnId: string) => void;
  onReorderColumn: (draggedId: string, targetId: string, edge: "before" | "after") => void;
  onDropCard: (drop: CardDrop) => void;
  onAddCard: (columnId: string) => Promise<void>;
};

function ColumnView({
  column,
  cardProps,
  disableColors,
  editable,
  onHide,
  onReorderColumn,
  onDropCard,
  onAddCard,
}: ColumnProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dropEdge, setDropEdge] = useState<Edge | null>(null);
  const [cardOver, setCardOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const isNoValue = column.id === NO_VALUE_CHOICE_ID;
  const canDragColumn = editable && !isNoValue;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const cleanups = [
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          if (source.data.type === CARD_DRAG_TYPE) return editable;
          if (source.data.type === COLUMN_DRAG_TYPE) {
            return canDragColumn && source.data.choiceId !== column.id;
          }
          return false;
        },
        getData: ({ source, input, element }) => {
          const data = { type: "column", columnId: column.id };
          if (source.data.type !== COLUMN_DRAG_TYPE) return data;
          return attachClosestEdge(data, { input, element, allowedEdges: ["left", "right"] });
        },
        onDragEnter: ({ source }) => {
          if (source.data.type === CARD_DRAG_TYPE) setCardOver(true);
        },
        onDrag: ({ self, source }) => {
          if (source.data.type === COLUMN_DRAG_TYPE) setDropEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => {
          setCardOver(false);
          setDropEdge(null);
        },
        onDrop: ({ self, source, location }) => {
          setCardOver(false);
          setDropEdge(null);
          if (source.data.type === COLUMN_DRAG_TYPE) {
            const edge = extractClosestEdge(self.data);
            if (!edge) return;
            onReorderColumn(source.data.choiceId as string, column.id, edge === "left" ? "before" : "after");
            return;
          }
          if (source.data.type !== CARD_DRAG_TYPE) return;
          // The innermost target is a card when the pointer ended over one.
          const cardTarget = location.current.dropTargets.find((tgt) => tgt.data.type === "card");
          const cardEdge = cardTarget ? extractClosestEdge(cardTarget.data) : null;
          onDropCard({
            rowId: source.data.rowId as string,
            sourceColumnId: source.data.columnId as string,
            targetColumnId: column.id,
            targetRowId: cardTarget ? (cardTarget.data.rowId as string) : null,
            edge: cardEdge === "top" ? "before" : "after",
          });
        },
      }),
    ];
    const handle = headerRef.current;
    if (canDragColumn && handle) {
      cleanups.push(
        draggable({
          element: el,
          dragHandle: handle,
          getInitialData: () => ({ type: COLUMN_DRAG_TYPE, choiceId: column.id }),
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false),
        }),
      );
    }
    return combine(...cleanups);
  }, [column.id, editable, canDragColumn, onReorderColumn, onDropCard]);

  const add = async () => {
    setCreating(true);
    try {
      await onAddCard(column.id);
    } catch {
      // reported by the mutation
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={classes.column}
      data-dragging={dragging || undefined}
      data-drop-edge={dropEdge ?? undefined}
      data-card-over={cardOver || undefined}
      data-menu-open={menuOpen || undefined}
    >
      <div ref={headerRef} className={classes.columnHeader} data-draggable={canDragColumn || undefined}>
        <span className={classes.columnTitle}>
          {column.choice ? (
            <ChoiceBadge choice={column.choice} disableColors={disableColors} />
          ) : (
            <span className={classes.noValueLabel}>{t("No value")}</span>
          )}
        </span>
        <span className={classes.columnCount}>{column.rows.length}</span>
        {editable && (
          <Menu opened={menuOpen} onChange={setMenuOpen} position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                className={classes.columnMenuButton}
                aria-label={t("Column options")}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEyeOff size={14} />} onClick={() => onHide(column.id)}>
                {t("Hide column")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </div>
      <div className={classes.columnBody}>
        {column.rows.map((row) => (
          <KanbanCard
            key={row.id}
            row={row}
            columnId={column.id}
            cardProps={cardProps}
            canDrag={editable}
          />
        ))}
        {column.rows.length === 0 && (
          <div className={classes.columnEmpty} aria-hidden="true" />
        )}
      </div>
      {editable && (
        <UnstyledButton className={classes.addCard} onClick={() => void add()} disabled={creating}>
          {creating ? <Loader size={12} /> : <IconPlus size={14} />}
          <span>{t("New")}</span>
        </UnstyledButton>
      )}
    </div>
  );
}

// ---- card ----

type CardProps = {
  row: IBaseRow;
  columnId: string;
  cardProps: IBaseProperty[];
  canDrag: boolean;
};

function KanbanCard({ row, columnId, cardProps, canDrag }: CardProps) {
  const { t } = useTranslation();
  const { primary, refs, openRow } = useBase();
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dropEdge, setDropEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !canDrag) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: CARD_DRAG_TYPE, rowId: row.id, columnId }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === CARD_DRAG_TYPE && source.data.rowId !== row.id,
        getData: ({ input, element }) =>
          attachClosestEdge({ type: "card", rowId: row.id }, { input, element, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setDropEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setDropEdge(null),
        onDrop: () => setDropEdge(null),
      }),
    );
  }, [canDrag, row.id, columnId]);

  const title = primary ? cellToText(readCell(row, primary), primary, refs) : "";
  const fields = cardProps
    .map((prop) => ({ prop, value: readCell(row, prop) }))
    .filter(({ prop, value }) => !isEmptyValue(value) && !(prop.type === "checkbox" && value !== true));

  return (
    <div
      ref={ref}
      className={classes.card}
      role="button"
      tabIndex={0}
      data-dragging={dragging || undefined}
      data-drop-edge={dropEdge ?? undefined}
      onClick={() => openRow(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRow(row.id);
        }
      }}
    >
      <div className={classes.cardTitle} data-empty={!title || undefined}>
        {title || t("Untitled")}
      </div>
      {fields.map(({ prop, value }) => (
        <div key={prop.id} className={classes.cardField} title={prop.name}>
          <Cell
            prop={prop}
            row={row}
            value={value}
            variant="card"
            editable={false}
            editing={false}
            onCommit={noop}
            onChange={noop}
            onCancel={noop}
            onRequestEdit={noop}
          />
        </div>
      ))}
    </div>
  );
}
