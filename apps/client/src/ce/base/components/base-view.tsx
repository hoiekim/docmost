import { useCallback, useMemo, type ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Alert, Button, Text } from "@mantine/core";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useBaseQuery } from "../queries/base-query";
import {
  useCreateRowMutation,
  useDeleteRowsMutation,
  useReorderRowMutation,
  useRowsQuery,
  useUpdateRowMutation,
  findCachedRow,
} from "../queries/row-query";
import { useCreateViewMutation } from "../queries/view-query";
import { useBaseSocket } from "../realtime/use-base-socket";
import { useActiveView } from "../hooks/use-active-view";
import { useViewConfig } from "../hooks/use-view-config";
import { compactFilter } from "../model/filters";
import { sameCellValue } from "../model/cell-read";
import { orderedProperties } from "../model/view-config";
import { openRowAtom, recomputingPropertiesAtom } from "../state/atoms";
import { useReferences } from "../state/references";
import type { IBase, IBaseRow, IBaseView } from "../types";
import { BaseContext, type BaseContextValue } from "./base-context";
import { BaseTableSkeleton } from "./base-table-skeleton";
import { BaseToolbar } from "./toolbar/base-toolbar";
import { DraftBanner } from "./toolbar/draft-banner";
import { TableView } from "./table/table-view";
import { KanbanView } from "./kanban/kanban-view";
import { RowDetailModal } from "./row-detail/row-detail-modal";
import classes from "../styles/base.module.css";

export type BaseViewProps = {
  pageId: string;
  /** The caller's verdict (feature flag + page permission + editor mode). */
  editable: boolean;
  /** Rendered inside a document instead of as the page body. */
  embedded?: boolean;
  /** Full-page mode renders the page title above the toolbar. */
  titleSlot?: ReactNode;
};

export function BaseView({ pageId, editable, embedded = false, titleSlot }: BaseViewProps) {
  const { t } = useTranslation();
  const { data: base, isLoading, isError, refetch } = useBaseQuery(pageId);
  useBaseSocket(pageId);

  if (isLoading) return <BaseTableSkeleton rows={3} columns={3} />;
  if (isError || !base) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
        <Text size="sm">{t("Failed to load this base.")}</Text>
        <Button size="compact-xs" variant="subtle" mt={6} onClick={() => refetch()}>
          {t("Try again")}
        </Button>
      </Alert>
    );
  }
  return <LoadedBase base={base} editable={editable} embedded={embedded} titleSlot={titleSlot} />;
}

type LoadedProps = { base: IBase; editable: boolean; embedded: boolean; titleSlot?: ReactNode };

function LoadedBase({ base, editable, embedded, titleSlot }: LoadedProps) {
  const { t } = useTranslation();
  const [view, setActiveView] = useActiveView(base);
  const createView = useCreateViewMutation(base.id);
  const canEdit = editable && (base.permissions?.canEdit ?? true);

  if (!view) {
    return (
      <div className={classes.root}>
        {titleSlot}
        <Text size="sm" c="dimmed">
          {t("This base has no views.")}
        </Text>
        {canEdit && (
          <Button
            size="xs"
            variant="light"
            mt="xs"
            leftSection={<IconPlus size={14} />}
            loading={createView.isPending}
            onClick={() => createView.mutate({ name: t("Table"), type: "table" })}
          >
            {t("Add view")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <ViewBody
      key={view.id}
      base={base}
      view={view}
      editable={canEdit}
      embedded={embedded}
      titleSlot={titleSlot}
      onSelectView={setActiveView}
    />
  );
}

type ViewBodyProps = LoadedProps & { view: IBaseView; onSelectView: (id: string) => void };

function ViewBody({ base, view, editable, embedded, titleSlot, onSelectView }: ViewBodyProps) {
  const pageId = base.id;
  const { config, patchConfig, draft, discardDraft } = useViewConfig(pageId, view, editable);

  const properties = useMemo(() => orderedProperties(base), [base]);
  const propsById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const primary = useMemo(() => properties.find((p) => p.isPrimary), [properties]);

  const rowsParams = useMemo(
    () => ({
      filter: compactFilter(config.filter, propsById),
      sorts: (config.sorts ?? []).filter((s) => propsById.has(s.propertyId)),
    }),
    [config.filter, config.sorts, propsById],
  );
  const rowsQuery = useRowsQuery(pageId, rowsParams);
  const refs = useReferences(pageId);
  const [openRowId, setOpenRowId] = useAtom(openRowAtom(pageId));
  const recomputing = useAtomValue(recomputingPropertiesAtom(pageId));

  const updateRow = useUpdateRowMutation(pageId);
  const createRow = useCreateRowMutation(pageId);
  const deleteRows = useDeleteRowsMutation(pageId);
  const reorderRow = useReorderRowMutation(pageId);

  const updateCells = useCallback(
    (rowId: string, cells: Record<string, unknown>) => {
      const current = findCachedRow(pageId, rowId);
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cells)) {
        if (!current || !sameCellValue(current.cells[k], v)) patch[k] = v ?? null;
      }
      if (Object.keys(patch).length === 0) return;
      updateRow.mutate({ rowId, cells: patch });
    },
    [pageId, updateRow],
  );

  const createRowFn = useCallback(
    (input?: { cells?: Record<string, unknown>; afterRowId?: string; position?: string }) =>
      createRow.mutateAsync(input ?? {}) as Promise<IBaseRow>,
    [createRow],
  );
  const deleteRowsFn = useCallback(
    (rowIds: string[]) => {
      if (rowIds.length > 0) deleteRows.mutate({ rowIds });
    },
    [deleteRows],
  );
  const reorderRowFn = useCallback(
    (rowId: string, position: string) => reorderRow.mutate({ rowId, position }),
    [reorderRow],
  );
  const loadMoreRows = useCallback(() => {
    if (rowsQuery.hasNextPage && !rowsQuery.isFetchingNextPage) void rowsQuery.fetchNextPage();
  }, [rowsQuery]);

  const value = useMemo<BaseContextValue>(
    () => ({
      pageId,
      base,
      properties,
      propsById,
      primary,
      editable,
      embedded,
      view,
      config,
      patchConfig,
      draft,
      discardDraft,
      refs,
      rows: rowsQuery.rows,
      rowsStatus: rowsQuery.status,
      isFetchingRows: rowsQuery.isFetching,
      hasMoreRows: !!rowsQuery.hasNextPage,
      loadMoreRows,
      updateCells,
      createRow: createRowFn,
      deleteRows: deleteRowsFn,
      reorderRow: reorderRowFn,
      openRowId,
      openRow: setOpenRowId,
      recomputing,
    }),
    [
      pageId,
      base,
      properties,
      propsById,
      primary,
      editable,
      embedded,
      view,
      config,
      patchConfig,
      draft,
      discardDraft,
      refs,
      rowsQuery.rows,
      rowsQuery.status,
      rowsQuery.isFetching,
      rowsQuery.hasNextPage,
      loadMoreRows,
      updateCells,
      createRowFn,
      deleteRowsFn,
      reorderRowFn,
      openRowId,
      setOpenRowId,
      recomputing,
    ],
  );

  return (
    <BaseContext.Provider value={value}>
      <div className={classes.root} data-embedded={embedded || undefined}>
        {titleSlot}
        <BaseToolbar onSelectView={onSelectView} />
        {draft && <DraftBanner />}
        <div className={classes.body}>
          {view.type === "kanban" ? <KanbanView /> : <TableView />}
        </div>
        <RowDetailModal />
      </div>
    </BaseContext.Provider>
  );
}
