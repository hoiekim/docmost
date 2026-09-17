import { useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Loader, Menu, Modal, ScrollArea, Text, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconChevronDown, IconChevronUp, IconDots, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { IBaseProperty, IBaseRow } from "../../types";
import { formatTimestamp } from "../../model/cell-format";
import { readCell } from "../../model/cell-read";
import { describeType } from "../../model/property-types";
import { viewOrderedProperties } from "../../model/view-config";
import { useRowQuery } from "../../queries/row-query";
import { useBase } from "../base-context";
import { FieldCell } from "./field-cell";
import classes from "../../styles/row-detail.module.css";

/** Full-row editor opened from the grid/kanban; driven by `openRowId` in the base context. */
export function RowDetailModal() {
  const { t } = useTranslation();
  const { pageId, openRowId, openRow, rows } = useBase();
  const query = useRowQuery(pageId, openRowId);
  const row = openRowId ? query.data : undefined;

  const index = useMemo(
    () => (openRowId ? rows.findIndex((r) => r.id === openRowId) : -1),
    [rows, openRowId],
  );
  const prev = index > 0 ? rows[index - 1] : undefined;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : undefined;

  return (
    <Modal
      opened={!!openRowId}
      onClose={() => openRow(null)}
      size={720}
      withinPortal
      centered={false}
      yOffset="6vh"
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        <div className={classes.headerTools}>
          <Tooltip label={t("Previous row")} openDelay={500} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Previous row")}
              disabled={!prev}
              onClick={() => prev && openRow(prev.id)}
            >
              <IconChevronUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("Next row")} openDelay={500} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Next row")}
              disabled={!next}
              onClick={() => next && openRow(next.id)}
            >
              <IconChevronDown size={16} />
            </ActionIcon>
          </Tooltip>
          {index >= 0 && (
            <span className={classes.headerCount}>
              {t("{{current}} of {{total}}", { current: index + 1, total: rows.length })}
            </span>
          )}
          {row && <RowMenu row={row} />}
        </div>
      }
    >
      {row ? (
        <RowDetailBody row={row} />
      ) : query.isError ? (
        <div className={classes.state}>
          <Text size="sm" c="dimmed">
            {t("This row is no longer available.")}
          </Text>
        </div>
      ) : (
        <div className={classes.state}>
          <Loader size="sm" />
        </div>
      )}
    </Modal>
  );
}

function RowMenu({ row }: { row: IBaseRow }) {
  const { t } = useTranslation();
  const { editable, deleteRows, openRow } = useBase();
  if (!editable) return null;

  const confirmDelete = () => {
    modals.openConfirmModal({
      title: t("Delete row"),
      children: t("Delete this row? This cannot be undone."),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteRows([row.id]);
        openRow(null);
      },
    });
  };

  return (
    <Menu position="bottom-start" withinPortal shadow="md" width={180}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("Row actions")}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={confirmDelete}>
          {t("Delete row")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function RowDetailBody({ row }: { row: IBaseRow }) {
  const { t } = useTranslation();
  const { base, config, primary } = useBase();
  const fields = useMemo(
    () => viewOrderedProperties(base, config).filter((p) => !p.isPrimary),
    [base, config],
  );

  return (
    <>
      {primary ? (
        <TitleField row={row} primary={primary} />
      ) : (
        <Text size="xl" fw={600} mb="sm" c="dimmed">
          {t("Untitled")}
        </Text>
      )}
      <div className={classes.fields}>
        {fields.map((prop) => {
          const Icon = describeType(prop.type).icon;
          return (
            <div key={prop.id} className={classes.fieldRow}>
              <div className={classes.fieldLabel} title={prop.name}>
                <Icon size={14} className={classes.fieldLabelIcon} />
                <span className={classes.fieldLabelText}>{prop.name}</span>
              </div>
              <FieldCell prop={prop} row={row} />
            </div>
          );
        })}
      </div>
      <div className={classes.meta}>
        <Text size="xs" c="dimmed">
          {t("Created {{time}}", { time: formatTimestamp(row.createdAt) })}
        </Text>
        <Text size="xs" c="dimmed">
          {t("Last edited {{time}}", { time: formatTimestamp(row.updatedAt) })}
        </Text>
      </div>
    </>
  );
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

/** The primary property as a large editable heading. Commits on blur/Enter. */
function TitleField({ row, primary }: { row: IBaseRow; primary: IBaseProperty }) {
  const { t } = useTranslation();
  const { editable, updateCells } = useBase();
  const current = asText(readCell(row, primary));
  const [text, setText] = useState(current);
  const ref = useRef<HTMLTextAreaElement>(null);
  const focused = useRef(false);

  // Follow remote/optimistic changes unless the user is typing.
  useEffect(() => {
    if (!focused.current) setText(current);
  }, [current]);

  useEffect(() => {
    autosize(ref.current);
  }, [text]);

  const commit = () => {
    if (!editable) return;
    if (text !== current) updateCells(row.id, { [primary.id]: text || null });
  };

  return (
    <textarea
      ref={ref}
      className={classes.title}
      rows={1}
      value={text}
      readOnly={!editable}
      placeholder={t("Untitled")}
      aria-label={primary.name}
      spellCheck={false}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setText(e.currentTarget.value)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
        } else if (e.key === "Escape" && text !== current) {
          // First Escape reverts; a second one (unchanged) reaches the modal.
          e.preventDefault();
          e.stopPropagation();
          setText(current);
        }
      }}
    />
  );
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
