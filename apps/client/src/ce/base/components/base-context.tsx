import { createContext, useContext } from "react";
import type {
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  RowReferences,
  ViewConfig,
  ViewConfigPatch,
} from "../types";

export type BaseContextValue = {
  pageId: string;
  base: IBase;
  /** Every live property in global order, primary first. */
  properties: IBaseProperty[];
  propsById: ReadonlyMap<string, IBaseProperty>;
  primary: IBaseProperty | undefined;
  /** The current user may change data and schema. */
  editable: boolean;
  /** Rendered inside a document rather than as the page itself. */
  embedded: boolean;

  view: IBaseView;
  config: ViewConfig;
  patchConfig: (patch: ViewConfigPatch) => void;
  draft: ViewConfigPatch | null;
  discardDraft: () => void;

  refs: RowReferences;
  rows: IBaseRow[];
  rowsStatus: "pending" | "error" | "success";
  isFetchingRows: boolean;
  hasMoreRows: boolean;
  loadMoreRows: () => void;

  updateCells: (rowId: string, cells: Record<string, unknown>) => void;
  createRow: (input?: {
    cells?: Record<string, unknown>;
    afterRowId?: string;
    position?: string;
  }) => Promise<IBaseRow>;
  deleteRows: (rowIds: string[]) => void;
  reorderRow: (rowId: string, position: string) => void;

  openRowId: string | null;
  openRow: (rowId: string | null) => void;

  /** Formula property ids a background job is recomputing. */
  recomputing: ReadonlySet<string>;
};

export const BaseContext = createContext<BaseContextValue | null>(null);

export function useBase(): BaseContextValue {
  const ctx = useContext(BaseContext);
  if (!ctx) throw new Error("useBase must be used inside <BaseView>");
  return ctx;
}
