import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { queryClient } from "@/main.tsx";
import { getApiErrorMessage } from "@/lib/api-error";
import { createRow, deleteRows, getRow, listRows, reorderRow, updateRow } from "../api";
import { newRequestId } from "../ids";
import { comparePosition } from "../positions";
import { markOutbound } from "../realtime/outbound";
import { mergeReferences } from "../state/references";
import type { IBaseRow, RowsPage } from "../types";
import { baseKeys, type RowsParams } from "./keys";

export const ROW_PAGE_SIZE = 100;

type RowsData = InfiniteData<RowsPage, string | undefined>;

export function useRowsQuery(pageId: string, params: RowsParams) {
  const query = useInfiniteQuery({
    queryKey: baseKeys.rows(pageId, params),
    queryFn: async ({ pageParam }) => {
      const page = await listRows({
        pageId,
        cursor: pageParam,
        limit: ROW_PAGE_SIZE,
        filter: params.filter,
        sorts: params.sorts,
      });
      mergeReferences(pageId, page.references);
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasNextPage ? last.meta.nextCursor ?? undefined : undefined),
    enabled: !!pageId,
    staleTime: 30 * 1000,
  });

  const rows = useMemo<IBaseRow[]>(() => {
    const pages = query.data?.pages ?? [];
    const seen = new Set<string>();
    const out: IBaseRow[] = [];
    for (const p of pages) {
      for (const r of p.items) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
    }
    return out;
  }, [query.data]);

  return { ...query, rows };
}

export function useRowQuery(pageId: string, rowId: string | null) {
  return useQuery({
    queryKey: baseKeys.row(pageId, rowId ?? ""),
    queryFn: () => getRow(pageId, rowId as string),
    enabled: !!pageId && !!rowId,
    initialData: () => (rowId ? findCachedRow(pageId, rowId) : undefined),
    staleTime: 10 * 1000,
  });
}

// ---- cache helpers (shared with the realtime handler) ----

function rowsQueries(pageId: string) {
  return queryClient.getQueriesData<RowsData>({ queryKey: baseKeys.rowsRoot(pageId) });
}

function isSorted(key: readonly unknown[]): boolean {
  const params = key[3] as RowsParams | undefined;
  return !!params && Array.isArray(params.sorts) && params.sorts.length > 0;
}

function hasFilter(key: readonly unknown[]): boolean {
  const params = key[3] as RowsParams | undefined;
  return !!params && !!params.filter;
}

function mapRowsData(
  pageId: string,
  fn: (data: RowsData, key: readonly unknown[]) => RowsData,
): void {
  for (const [key, data] of rowsQueries(pageId)) {
    if (!data) continue;
    const next = fn(data, key);
    if (next !== data) queryClient.setQueryData(key, next);
  }
}

export function findCachedRow(pageId: string, rowId: string): IBaseRow | undefined {
  for (const [, data] of rowsQueries(pageId)) {
    for (const page of data?.pages ?? []) {
      const row = page.items.find((r) => r.id === rowId);
      if (row) return row;
    }
  }
  return queryClient.getQueryData<IBaseRow>(baseKeys.row(pageId, rowId));
}

export function patchCachedRow(
  pageId: string,
  rowId: string,
  patch: Partial<IBaseRow> & { cells?: Record<string, unknown> },
): void {
  const apply = (row: IBaseRow): IBaseRow => {
    if (row.id !== rowId) return row;
    const cells = { ...row.cells };
    for (const [k, v] of Object.entries(patch.cells ?? {})) {
      if (v === null || v === undefined) delete cells[k];
      else cells[k] = v;
    }
    const { cells: _c, ...rest } = patch;
    return { ...row, ...rest, cells };
  };
  mapRowsData(pageId, (data) => ({
    ...data,
    pages: data.pages.map((p) => ({ ...p, items: p.items.map(apply) })),
  }));
  queryClient.setQueryData<IBaseRow>(baseKeys.row(pageId, rowId), (prev) =>
    prev ? apply(prev) : prev,
  );
}

/** Swap a row object everywhere it is cached (same id, same slot). */
export function replaceCachedRow(pageId: string, row: IBaseRow): void {
  mapRowsData(pageId, (data) => ({
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.map((r) => (r.id === row.id ? row : r)),
    })),
  }));
  queryClient.setQueryData<IBaseRow>(baseKeys.row(pageId, row.id), (prev) =>
    prev ? row : prev,
  );
}

/** Insert a row into every rows query. Unsorted lists keep position order. */
export function insertCachedRow(pageId: string, row: IBaseRow): void {
  mapRowsData(pageId, (data, key) => {
    if (data.pages.some((p) => p.items.some((r) => r.id === row.id))) return data;
    if (hasFilter(key)) {
      // The filter cannot be evaluated locally; a refetch will settle it.
      queryClient.invalidateQueries({ queryKey: key });
      return data;
    }
    const pages = data.pages.map((p) => ({ ...p, items: [...p.items] }));
    if (pages.length === 0) {
      pages.push({
        items: [row],
        meta: { limit: ROW_PAGE_SIZE, hasNextPage: false, hasPrevPage: false, nextCursor: null, prevCursor: null },
        references: { users: {}, pages: {} },
      });
      return { ...data, pages, pageParams: [undefined] };
    }
    const last = pages[pages.length - 1];
    if (isSorted(key) || last.meta.hasNextPage) {
      // Not fully loaded (or server-sorted): append only when it belongs at the end.
      if (last.meta.hasNextPage) return data;
      last.items.push(row);
      return { ...data, pages };
    }
    // Unsorted and fully loaded: place by position.
    let placed = false;
    for (const p of pages) {
      const idx = p.items.findIndex((r) => comparePosition(row, r) < 0);
      if (idx !== -1) {
        p.items.splice(idx, 0, row);
        placed = true;
        break;
      }
    }
    if (!placed) last.items.push(row);
    return { ...data, pages };
  });
}

export function removeCachedRows(pageId: string, rowIds: string[]): void {
  const ids = new Set(rowIds);
  mapRowsData(pageId, (data) => ({
    ...data,
    pages: data.pages.map((p) => ({ ...p, items: p.items.filter((r) => !ids.has(r.id)) })),
  }));
  for (const id of rowIds) queryClient.removeQueries({ queryKey: baseKeys.row(pageId, id) });
}

/** Move a row to its new position (unsorted lists only; others just store it). */
export function repositionCachedRow(pageId: string, rowId: string, position: string): void {
  mapRowsData(pageId, (data, key) => {
    let moving: IBaseRow | undefined;
    const pages = data.pages.map((p) => {
      const found = p.items.find((r) => r.id === rowId);
      if (found) moving = { ...found, position };
      return { ...p, items: p.items.filter((r) => r.id !== rowId) };
    });
    if (!moving) return data;
    if (isSorted(key)) {
      return {
        ...data,
        pages: data.pages.map((p) => ({
          ...p,
          items: p.items.map((r) => (r.id === rowId ? { ...r, position } : r)),
        })),
      };
    }
    let placed = false;
    for (const p of pages) {
      const idx = p.items.findIndex((r) => comparePosition(moving as IBaseRow, r) < 0);
      if (idx !== -1) {
        p.items.splice(idx, 0, moving);
        placed = true;
        break;
      }
    }
    if (!placed) pages[pages.length - 1]?.items.push(moving);
    return { ...data, pages };
  });
}

// ---- mutations ----

export function useCreateRowMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<
    IBaseRow,
    Error,
    { cells?: Record<string, unknown>; afterRowId?: string; position?: string }
  >({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return createRow({ pageId, ...input, requestId });
    },
    onSuccess: (row) => insertCachedRow(pageId, row),
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create row")),
        color: "red",
      });
    },
  });
}

export function useUpdateRowMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<
    IBaseRow,
    Error,
    { rowId: string; cells: Record<string, unknown> },
    { previous?: IBaseRow }
  >({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return updateRow({ pageId, ...input, requestId });
    },
    onMutate: (input) => {
      const previous = findCachedRow(pageId, input.rowId);
      patchCachedRow(pageId, input.rowId, { cells: input.cells });
      return { previous };
    },
    // The server may have recomputed formulas and bumped lastUpdatedBy, so
    // take its copy of the row wholesale.
    onSuccess: (row) => replaceCachedRow(pageId, row),
    onError: (error, _input, ctx) => {
      if (ctx?.previous) replaceCachedRow(pageId, ctx.previous);
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update row")),
        color: "red",
      });
    },
  });
}

export function useDeleteRowsMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, { rowIds: string[] }>({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return deleteRows({ pageId, rowIds: input.rowIds, requestId });
    },
    onMutate: (input) => removeCachedRows(pageId, input.rowIds),
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: baseKeys.rowsRoot(pageId) });
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete rows")),
        color: "red",
      });
    },
  });
}

export function useReorderRowMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, { rowId: string; position: string }>({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return reorderRow({ pageId, ...input, requestId });
    },
    onMutate: (input) => repositionCachedRow(pageId, input.rowId, input.position),
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: baseKeys.rowsRoot(pageId) });
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to move row")),
        color: "red",
      });
    },
  });
}
