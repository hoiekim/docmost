import { atom, type PrimitiveAtom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { RowReferences, ViewConfigPatch } from "../types";

/** Active view per base. Empty string means "first view". */
export const activeViewIdAtom = atomFamily((_pageId: string) => atom<string>(""));

/**
 * Unsaved view-config changes made by someone who cannot edit the base (or
 * who chose not to persist). Keyed by view id; null means no draft.
 */
export const viewDraftAtom = atomFamily((_viewId: string) =>
  atom(null) as PrimitiveAtom<ViewConfigPatch | null>,
);

export type CellAddress = { rowId: string; propertyId: string };

/** Selected row ids per base (table view). */
export const selectedRowsAtom = atomFamily((_pageId: string) =>
  atom<ReadonlySet<string>>(new Set<string>()),
);

/** Keyboard-focused cell per base. */
export const focusedCellAtom = atomFamily((_pageId: string) =>
  atom(null) as PrimitiveAtom<CellAddress | null>,
);

/** Cell currently in edit mode per base. */
export const editingCellAtom = atomFamily((_pageId: string) =>
  atom(null) as PrimitiveAtom<CellAddress | null>,
);

/** Row open in the detail modal per base. */
export const openRowAtom = atomFamily(
  (_pageId: string) => atom(null) as PrimitiveAtom<string | null>,
);

/** Formula properties currently being recomputed by a server job. */
export const recomputingPropertiesAtom = atomFamily((_pageId: string) =>
  atom<ReadonlySet<string>>(new Set<string>()),
);

/** Users and pages referenced by cells, merged from every rows response. */
export const referencesAtom = atomFamily((_pageId: string) =>
  atom<RowReferences>({ users: {}, pages: {} }),
);
