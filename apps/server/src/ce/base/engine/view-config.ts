import { ViewConfig, ViewConfigPatch } from '../types/base.types';

/**
 * Same semantics as applyConfigPatch in the client's base-view-query.ts:
 * null deletes the key, undefined leaves it untouched, anything else replaces.
 */
export function applyViewConfigPatch(
  current: ViewConfig | null | undefined,
  patch: ViewConfigPatch | null | undefined,
): ViewConfig {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  if (!patch) return next as ViewConfig;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next as ViewConfig;
}
