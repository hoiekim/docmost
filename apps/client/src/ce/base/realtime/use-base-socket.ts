import { useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import { socketAtom } from "@/features/websocket/atoms/socket-atom";
import { queryClient } from "@/main.tsx";
import {
  invalidateBase,
  invalidateRows,
  removeCachedProperty,
  removeCachedView,
  setCachedBase,
  upsertCachedProperty,
  upsertCachedView,
} from "../queries/base-query";
import { baseKeys } from "../queries/keys";
import {
  insertCachedRow,
  patchCachedRow,
  removeCachedRows,
  repositionCachedRow,
} from "../queries/row-query";
import { recomputingPropertiesAtom } from "../state/atoms";
import type { BaseSocketEvent } from "../types";
import { isOutbound } from "./outbound";

/**
 * Join the `base-<pageId>` room and fold server events into the query
 * cache. Events that echo this client's own mutations (matched by requestId)
 * are ignored; the mutation already applied them.
 */
export function useBaseSocket(pageId: string): void {
  const [socket] = useAtom(socketAtom);
  const setRecomputing = useSetAtom(recomputingPropertiesAtom(pageId));

  useEffect(() => {
    if (!socket || !pageId) return;

    const subscribe = () => socket.emit("message", { operation: "base:subscribe", pageId });

    const onMessage = (raw: unknown) => {
      const event = raw as BaseSocketEvent;
      if (!event || typeof event !== "object") return;
      if (!("operation" in event) || !String(event.operation).startsWith("base:")) return;
      if (event.pageId !== pageId) return;
      if ("requestId" in event && isOutbound(event.requestId)) return;

      switch (event.operation) {
        case "base:subscribed":
          break;
        case "base:row:created":
          insertCachedRow(pageId, event.row);
          break;
        case "base:row:updated":
          patchCachedRow(pageId, event.rowId, {
            cells: event.updatedCells,
            ...(event.position ? { position: event.position } : {}),
            updatedAt: new Date().toISOString(),
          });
          break;
        case "base:row:deleted":
          removeCachedRows(pageId, [event.rowId]);
          break;
        case "base:rows:deleted":
          removeCachedRows(pageId, event.rowIds);
          break;
        case "base:row:reordered":
          repositionCachedRow(pageId, event.rowId, event.position);
          break;
        case "base:rows:updated":
          // Batched formula writes: cheaper to refetch than to patch.
          invalidateRows(pageId);
          break;
        case "base:property:created":
        case "base:property:updated":
        case "base:property:reordered":
          if (event.property) upsertCachedProperty(pageId, event.property);
          else invalidateBase(pageId);
          if (event.operation === "base:property:updated" && event.property?.type === "formula") {
            invalidateRows(pageId);
          }
          break;
        case "base:property:deleted":
          if (event.propertyId) removeCachedProperty(pageId, event.propertyId);
          break;
        case "base:view:created":
        case "base:view:updated":
          if (event.view) upsertCachedView(pageId, event.view);
          break;
        case "base:view:deleted":
          if (event.viewId) removeCachedView(pageId, event.viewId);
          break;
        case "base:schema:bumped":
          setCachedBase(pageId, (base) => ({ ...base, baseSchemaVersion: event.schemaVersion }));
          invalidateBase(pageId);
          invalidateRows(pageId);
          break;
        case "base:formula:recompute:started":
          setRecomputing((prev) => {
            const next = new Set(prev);
            for (const id of event.propertyIds) next.add(id);
            return next;
          });
          break;
        case "base:formula:recompute:completed":
          setRecomputing((prev) => {
            const next = new Set(prev);
            for (const id of event.propertyIds) next.delete(id);
            return next;
          });
          invalidateRows(pageId);
          break;
        default:
          break;
      }
    };

    socket.on("message", onMessage);
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();

    return () => {
      socket.off("message", onMessage);
      socket.off("connect", subscribe);
      socket.emit("message", { operation: "base:unsubscribe", pageId });
      queryClient.cancelQueries({ queryKey: baseKeys.rowsRoot(pageId) }).catch(() => undefined);
    };
  }, [socket, pageId, setRecomputing]);
}
