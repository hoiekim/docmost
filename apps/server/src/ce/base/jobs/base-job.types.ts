export type BaseTypeConversionJob = {
  pageId: string;
  propertyId: string;
  /** Must match base_properties.pending_token; stale jobs are ignored. */
  token: string;
};

export type BaseCellGcJob = {
  pageId: string;
  propertyId: string;
};

export type BaseFormulaRecomputeJob = {
  pageId: string;
  propertyIds: string[];
};

/** Bases with at most this many rows convert / backfill inline. */
export const INLINE_ROW_THRESHOLD = 2000;
