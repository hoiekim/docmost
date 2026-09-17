import { getDefaultStore, useAtomValue } from "jotai";
import type { ResolvedPage, RowReferences, UserRef } from "../types";
import { referencesAtom } from "./atoms";

const store = getDefaultStore();

function isSame(a: RowReferences, users: Record<string, UserRef>, pages: Record<string, ResolvedPage>) {
  for (const [id, u] of Object.entries(users)) {
    const cur = a.users[id];
    if (!cur || cur.name !== u.name || cur.avatarUrl !== u.avatarUrl) return false;
  }
  for (const [id, p] of Object.entries(pages)) {
    const cur = a.pages[id];
    if (!cur || cur.title !== p.title || cur.icon !== p.icon || cur.slugId !== p.slugId) {
      return false;
    }
  }
  return true;
}

/** Merge newly learned users/pages into a base's reference store. */
export function mergeReferences(pageId: string, refs: Partial<RowReferences>): void {
  const users = refs.users ?? {};
  const pages = refs.pages ?? {};
  if (Object.keys(users).length === 0 && Object.keys(pages).length === 0) return;
  const a = referencesAtom(pageId);
  const current = store.get(a);
  if (isSame(current, users, pages)) return;
  store.set(a, {
    users: { ...current.users, ...users },
    pages: { ...current.pages, ...pages },
  });
}

export function mergeUsers(pageId: string, users: UserRef[]): void {
  mergeReferences(pageId, {
    users: Object.fromEntries(users.map((u) => [u.id, u])),
  });
}

export function mergePages(pageId: string, pages: ResolvedPage[]): void {
  mergeReferences(pageId, {
    pages: Object.fromEntries(pages.map((p) => [p.id, p])),
  });
}

export function getReferences(pageId: string): RowReferences {
  return store.get(referencesAtom(pageId));
}

export function useReferences(pageId: string): RowReferences {
  return useAtomValue(referencesAtom(pageId));
}
