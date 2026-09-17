import { useEffect } from "react";
import { expandPages } from "../api";
import { getReferences, mergePages } from "../state/references";

/**
 * Page cells store ids; the rows response resolves the ones the reader may
 * see, but a page picked moments ago (or referenced by a row that arrived
 * over the socket) may be missing. Requests are batched per animation frame.
 */
const pending = new Map<string, Set<string>>();
const inFlight = new Map<string, Set<string>>();
let scheduled = false;

function flush() {
  scheduled = false;
  for (const [pageId, ids] of pending) {
    pending.delete(pageId);
    const known = getReferences(pageId).pages;
    const flying = inFlight.get(pageId) ?? new Set<string>();
    const want = [...ids].filter((id) => !known[id] && !flying.has(id));
    if (want.length === 0) continue;
    for (const id of want) flying.add(id);
    inFlight.set(pageId, flying);
    expandPages(want)
      .then((pages) => mergePages(pageId, pages))
      .catch(() => undefined)
      .finally(() => {
        for (const id of want) flying.delete(id);
      });
  }
}

export function requestPageReferences(pageId: string, ids: Iterable<string>): void {
  const known = getReferences(pageId).pages;
  let added = false;
  for (const id of ids) {
    if (!id || known[id]) continue;
    let set = pending.get(pageId);
    if (!set) pending.set(pageId, (set = new Set()));
    set.add(id);
    added = true;
  }
  if (added && !scheduled) {
    scheduled = true;
    requestAnimationFrame(flush);
  }
}

export function usePageReferences(pageId: string, ids: string[]): void {
  const key = ids.join("|");
  useEffect(() => {
    if (ids.length > 0) requestPageReferences(pageId, ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, key]);
}
