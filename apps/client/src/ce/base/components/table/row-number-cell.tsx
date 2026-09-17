import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import classes from "../../styles/table.module.css";

export const ROW_DRAG_TYPE = "base-row";

type Props = {
  rowId: string;
  index: number;
  selected: boolean;
  onToggleSelected: (shiftKey: boolean) => void;
  canDrag: boolean;
  onDropRow: (draggedId: string, targetId: string, edge: "before" | "after") => void;
  /** Row element to use as the drop target (the whole row, not just this cell). */
  rowRef: React.RefObject<HTMLDivElement>;
};

export function RowNumberCell({ rowId, index, selected, onToggleSelected, canDrag, onDropRow, rowRef }: Props) {
  const handleRef = useRef<HTMLSpanElement>(null);
  const [dropEdge, setDropEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const rowEl = rowRef.current;
    if (!rowEl) return;
    const cleanups = [
      dropTargetForElements({
        element: rowEl,
        canDrop: ({ source }) => source.data.type === ROW_DRAG_TYPE && source.data.rowId !== rowId,
        getData: ({ input, element }) =>
          attachClosestEdge({ rowId }, { input, element, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setDropEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setDropEdge(null),
        onDrop: ({ self, source }) => {
          const edge = extractClosestEdge(self.data);
          setDropEdge(null);
          if (!edge) return;
          onDropRow(source.data.rowId as string, rowId, edge === "top" ? "before" : "after");
        },
      }),
    ];
    const handle = handleRef.current;
    if (canDrag && handle) {
      cleanups.push(
        draggable({
          element: rowEl,
          dragHandle: handle,
          getInitialData: () => ({ type: ROW_DRAG_TYPE, rowId }),
        }),
      );
    }
    return combine(...cleanups);
  }, [rowId, canDrag, onDropRow, rowRef]);

  useEffect(() => {
    const rowEl = rowRef.current;
    if (!rowEl) return;
    if (dropEdge) rowEl.setAttribute("data-drop-edge", dropEdge);
    else rowEl.removeAttribute("data-drop-edge");
  }, [dropEdge, rowRef]);

  return (
    <div className={classes.rowNumberCell} data-selected={selected || undefined}>
      {canDrag && (
        <span ref={handleRef} className={classes.dragHandle} aria-hidden="true">
          <IconGripVertical size={14} />
        </span>
      )}
      <span className={classes.rowIndex}>{index + 1}</span>
      <Checkbox
        size="xs"
        className={classes.rowCheckbox}
        checked={selected}
        onChange={() => undefined}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelected(e.shiftKey);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Select row"
      />
    </div>
  );
}
