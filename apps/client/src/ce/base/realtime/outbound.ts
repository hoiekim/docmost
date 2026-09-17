/**
 * Request ids this client attached to mutations. The realtime handler drops
 * events carrying one of them because the mutation already reconciled the
 * cache from the HTTP response. Entries expire so the set stays small.
 */
const TTL_MS = 60_000;
const outbound = new Map<string, number>();

export function markOutbound(requestId: string): string {
  const now = Date.now();
  outbound.set(requestId, now);
  if (outbound.size > 500) {
    for (const [id, at] of outbound) if (now - at > TTL_MS) outbound.delete(id);
  }
  return requestId;
}

export function isOutbound(requestId: string | null | undefined): boolean {
  if (!requestId) return false;
  const at = outbound.get(requestId);
  if (at === undefined) return false;
  if (Date.now() - at > TTL_MS) {
    outbound.delete(requestId);
    return false;
  }
  return true;
}
