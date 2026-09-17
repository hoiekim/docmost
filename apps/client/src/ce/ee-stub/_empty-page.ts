import type { IPagination } from "@/lib/types.ts";

/** An empty, well-formed page for list endpoints CE does not serve. */
export function emptyPage<T>(): IPagination<T> {
  return {
    items: [],
    meta: {
      limit: 0,
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: null,
      prevCursor: null,
    },
  };
}
