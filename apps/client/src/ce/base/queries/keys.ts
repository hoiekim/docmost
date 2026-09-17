import type { FilterNode, ViewSortConfig } from "../types";

export type RowsParams = {
  filter: FilterNode | null;
  sorts: ViewSortConfig[];
};

export const baseKeys = {
  all: ["bases"] as const,
  base: (pageId: string) => ["bases", pageId] as const,
  rowsRoot: (pageId: string) => ["bases", pageId, "rows"] as const,
  rows: (pageId: string, params: RowsParams) =>
    ["bases", pageId, "rows", params] as const,
  row: (pageId: string, rowId: string) => ["bases", pageId, "row", rowId] as const,
};
