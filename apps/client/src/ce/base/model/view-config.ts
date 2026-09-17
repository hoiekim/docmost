import type { IBase, IBaseProperty, IBaseView, ViewConfig } from "../types";
import { sortByPosition } from "../positions";

export const DEFAULT_COLUMN_WIDTH = 180;
export const PRIMARY_COLUMN_WIDTH = 260;
export const MIN_COLUMN_WIDTH = 80;
export const MAX_COLUMN_WIDTH = 1200;

/** Properties sorted by their global position, primary first. */
export function orderedProperties(base: Pick<IBase, "properties">): IBaseProperty[] {
  const sorted = sortByPosition(base.properties);
  const primary = sorted.filter((p) => p.isPrimary);
  const rest = sorted.filter((p) => !p.isPrimary);
  return [...primary, ...rest];
}

/**
 * Properties in the order a view shows them. `propertyOrder` wins for ids it
 * lists; unknown ids are ignored and unlisted properties keep their global
 * order at the end. The primary property is always first.
 */
export function viewOrderedProperties(
  base: Pick<IBase, "properties">,
  config: ViewConfig | undefined,
): IBaseProperty[] {
  const global = orderedProperties(base);
  const order = config?.propertyOrder ?? [];
  if (order.length === 0) return global;
  const byId = new Map(global.map((p) => [p.id, p]));
  const primary = global.find((p) => p.isPrimary);
  const out: IBaseProperty[] = primary ? [primary] : [];
  if (primary) byId.delete(primary.id);
  for (const id of order) {
    const p = byId.get(id);
    if (p) {
      out.push(p);
      byId.delete(id);
    }
  }
  return [...out, ...byId.values()];
}

/** Table columns: ordered, minus hidden ones. */
export function visibleTableProperties(
  base: Pick<IBase, "properties">,
  config: ViewConfig | undefined,
): IBaseProperty[] {
  const hidden = new Set(config?.hiddenPropertyIds ?? []);
  return viewOrderedProperties(base, config).filter((p) => p.isPrimary || !hidden.has(p.id));
}

/** Kanban card fields: listed ids only (never the primary; it is the title). */
export function kanbanCardProperties(
  base: Pick<IBase, "properties">,
  config: ViewConfig | undefined,
): IBaseProperty[] {
  const visible = new Set(config?.visiblePropertyIds ?? []);
  return viewOrderedProperties(base, config).filter((p) => !p.isPrimary && visible.has(p.id));
}

export function columnWidth(prop: IBaseProperty, config: ViewConfig | undefined): number {
  const w = config?.propertyWidths?.[prop.id];
  if (typeof w === "number" && Number.isFinite(w)) {
    return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, w));
  }
  return prop.isPrimary ? PRIMARY_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH;
}

export function orderedViews(base: Pick<IBase, "views">): IBaseView[] {
  return sortByPosition(base.views);
}

/** Apply a client-side patch with the server's null-deletes semantics. */
export function applyConfigPatch(
  current: ViewConfig | undefined,
  patch: { [K in keyof ViewConfig]?: ViewConfig[K] | null },
): ViewConfig {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as ViewConfig;
}

/** Group-by candidates for kanban: single-choice and single-person properties. */
export function kanbanGroupCandidates(base: Pick<IBase, "properties">): IBaseProperty[] {
  return orderedProperties(base).filter(
    (p) => p.type === "select" || p.type === "status",
  );
}
