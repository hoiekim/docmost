import { useCallback, useRef, useState } from "react";
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "../../model/view-config";

/**
 * Pointer-driven column resizing. Widths are tracked locally during the
 * drag and handed to `onCommit` once on release so the view config is
 * written a single time.
 */
export function useColumnResize(onCommit: (propertyId: string, width: number) => void) {
  const [override, setOverride] = useState<{ id: string; width: number } | null>(null);
  const drag = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  const start = useCallback(
    (propertyId: string, startWidth: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drag.current = { id: propertyId, startX: e.clientX, startWidth };
      setOverride({ id: propertyId, width: startWidth });
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture?.(e.pointerId);

      const move = (ev: PointerEvent) => {
        if (!drag.current) return;
        const width = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, drag.current.startWidth + (ev.clientX - drag.current.startX)),
        );
        setOverride({ id: drag.current.id, width });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!drag.current) return;
        const width = Math.max(
          MIN_COLUMN_WIDTH,
          Math.min(MAX_COLUMN_WIDTH, drag.current.startWidth + (ev.clientX - drag.current.startX)),
        );
        const id = drag.current.id;
        drag.current = null;
        setOverride(null);
        if (width !== startWidth) onCommit(id, Math.round(width));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onCommit],
  );

  return { override, startResize: start, resizing: !!override };
}
