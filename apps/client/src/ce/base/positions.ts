import { generateJitteredKeyBetween } from "fractional-indexing-jittered";

/** Items ordered by a fractional-index `position` string (C collation). */
export type Positioned = { position: string };

export function comparePosition(a: Positioned, b: Positioned): number {
  if (a.position < b.position) return -1;
  if (a.position > b.position) return 1;
  return 0;
}

export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort(comparePosition);
}

export function positionBetween(
  before: string | null | undefined,
  after: string | null | undefined,
): string {
  return generateJitteredKeyBetween(before ?? null, after ?? null);
}

export function positionAfterLast(items: readonly Positioned[]): string {
  const last = sortByPosition(items).at(-1);
  return positionBetween(last?.position ?? null, null);
}

export function positionBeforeFirst(items: readonly Positioned[]): string {
  const first = sortByPosition(items)[0];
  return positionBetween(null, first?.position ?? null);
}

/**
 * Position that places an item at `targetIndex` within `ordered` (already
 * sorted, and not containing the moving item).
 */
export function positionAtIndex(
  ordered: readonly Positioned[],
  targetIndex: number,
): string {
  const idx = Math.max(0, Math.min(targetIndex, ordered.length));
  const before = idx > 0 ? ordered[idx - 1].position : null;
  const after = idx < ordered.length ? ordered[idx].position : null;
  return positionBetween(before, after);
}

/** Move `id` in an id list so it lands before/after `targetId`. */
export function moveInList(
  list: readonly string[],
  id: string,
  targetId: string,
  edge: "before" | "after",
): string[] {
  if (id === targetId) return [...list];
  const without = list.filter((x) => x !== id);
  const targetIdx = without.indexOf(targetId);
  if (targetIdx === -1) return [...without, id];
  const insertAt = edge === "before" ? targetIdx : targetIdx + 1;
  return [...without.slice(0, insertAt), id, ...without.slice(insertAt)];
}
