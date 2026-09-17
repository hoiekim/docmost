import { useEffect, useRef, useState } from "react";
import { Badge, Menu, Modal, Tooltip, UnstyledButton } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconEyeOff,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import type { IBaseProperty, SortDirection } from "../../types";
import { describeType } from "../../model/property-types";
import { useDeletePropertyMutation } from "../../queries/property-query";
import { useBase } from "../base-context";
import { PropertyEditor } from "../property/property-editor";
import classes from "../../styles/table.module.css";

export const COLUMN_DRAG_TYPE = "base-column";

type Props = {
  prop: IBaseProperty;
  width: number;
  sortDirection: SortDirection | null;
  onResizeStart: (e: React.PointerEvent) => void;
  onSort: (direction: SortDirection | null) => void;
  onHide: () => void;
  onReorder: (draggedId: string, targetId: string, edge: "before" | "after") => void;
};

export function HeaderCell({ prop, width, sortDirection, onResizeStart, onSort, onHide, onReorder }: Props) {
  const { t } = useTranslation();
  const { editable, pageId } = useBase();
  const deleteProperty = useDeletePropertyMutation(pageId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropEdge, setDropEdge] = useState<Edge | null>(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const desc = describeType(prop.type);
  const Icon = desc.icon;
  const canReorder = editable && !prop.isPrimary;

  useEffect(() => {
    const el = ref.current;
    if (!el || !canReorder) return;
    return combine(
      draggable({
        element: el,
        getInitialData: () => ({ type: COLUMN_DRAG_TYPE, propertyId: prop.id }),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === COLUMN_DRAG_TYPE && source.data.propertyId !== prop.id,
        getData: ({ input, element }) =>
          attachClosestEdge({ propertyId: prop.id }, { input, element, allowedEdges: ["left", "right"] }),
        onDrag: ({ self }) => setDropEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setDropEdge(null),
        onDrop: ({ self, source }) => {
          const edge = extractClosestEdge(self.data);
          setDropEdge(null);
          if (!edge) return;
          onReorder(source.data.propertyId as string, prop.id, edge === "left" ? "before" : "after");
        },
      }),
    );
  }, [canReorder, prop.id, onReorder]);

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: t("Delete property"),
      children: t('Delete "{{name}}" and all of its values? This cannot be undone.', { name: prop.name }),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteProperty.mutate({ propertyId: prop.id }),
    });
  };

  return (
    <div
      ref={ref}
      className={classes.headerCell}
      role="columnheader"
      data-dragging={dragging || undefined}
      data-drop-edge={dropEdge ?? undefined}
      data-menu-open={menuOpen || editorOpen || undefined}
      style={{ width, minWidth: width }}
    >
      <Menu
        opened={menuOpen}
        onChange={setMenuOpen}
        position="bottom-start"
        withinPortal
        disabled={!editable}
      >
        <Menu.Target>
          <UnstyledButton
            className={classes.headerButton}
            title={prop.name}
            aria-label={prop.name}
          >
            <Icon size={14} className={classes.headerIcon} />
            <span className={classes.headerLabel}>{prop.name}</span>
            {prop.pendingType && (
              <Tooltip label={t("Converting to {{type}}…", { type: t(describeType(prop.pendingType).label) })}>
                <Badge size="xs" variant="light" color="yellow" className={classes.headerBadge}>
                  …
                </Badge>
              </Tooltip>
            )}
            {sortDirection === "asc" && <IconArrowUp size={12} className={classes.headerSort} />}
            {sortDirection === "desc" && <IconArrowDown size={12} className={classes.headerSort} />}
            {editable && <IconChevronDown size={12} className={classes.headerCaret} />}
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setEditorOpen(true)}>
            {t("Edit property")}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconArrowUp size={14} />}
            onClick={() => onSort(sortDirection === "asc" ? null : "asc")}
            disabled={!desc.sortable}
          >
            {sortDirection === "asc" ? t("Remove sort") : t("Sort ascending")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconArrowDown size={14} />}
            onClick={() => onSort(sortDirection === "desc" ? null : "desc")}
            disabled={!desc.sortable}
          >
            {sortDirection === "desc" ? t("Remove sort") : t("Sort descending")}
          </Menu.Item>
          {!prop.isPrimary && (
            <>
              <Menu.Item leftSection={<IconEyeOff size={14} />} onClick={onHide}>
                {t("Hide in view")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={confirmDelete}>
                {t("Delete property")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={t("Edit property")}
        size={380}
        centered
        withinPortal
        trapFocus
        closeOnEscape
      >
        {editorOpen && <PropertyEditor property={prop} onClose={() => setEditorOpen(false)} />}
      </Modal>
      {editable && (
        <div
          className={classes.resizeHandle}
          onPointerDown={onResizeStart}
          onDoubleClick={(e) => e.stopPropagation()}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
