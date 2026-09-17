import { useState } from "react";
import { ActionIcon, Menu, TextInput, UnstyledButton } from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconChevronDown,
  IconLayoutKanban,
  IconPencil,
  IconPlus,
  IconTable,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { orderedViews } from "../../model/view-config";
import { kanbanGroupCandidates } from "../../model/view-config";
import {
  useCreateViewMutation,
  useDeleteViewMutation,
  useUpdateViewMutation,
} from "../../queries/view-query";
import type { BaseViewType, IBaseView } from "../../types";
import { useBase } from "../base-context";
import classes from "../../styles/toolbar.module.css";

export function viewTypeIcon(type: BaseViewType, size = 14) {
  return type === "kanban" ? <IconLayoutKanban size={size} /> : <IconTable size={size} />;
}

type Props = { onSelectView: (id: string) => void };

export function ViewTabs({ onSelectView }: Props) {
  const { t } = useTranslation();
  const { base, view, editable, pageId } = useBase();
  const views = orderedViews(base);
  const createView = useCreateViewMutation(pageId);
  const updateView = useUpdateViewMutation(pageId);
  const deleteView = useDeleteViewMutation(pageId);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const addView = (type: BaseViewType) => {
    const config =
      type === "kanban"
        ? { groupByPropertyId: kanbanGroupCandidates(base)[0]?.id }
        : {};
    const name = type === "kanban" ? t("Kanban") : t("Table");
    createView.mutate(
      { name, type, config: config.groupByPropertyId ? config : {} },
      { onSuccess: (v) => onSelectView(v.id) },
    );
  };

  const confirmDelete = (v: IBaseView) => {
    modals.openConfirmModal({
      title: t("Delete view"),
      children: t('Delete the view "{{name}}"? Rows are not affected.', { name: v.name }),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => deleteView.mutate({ viewId: v.id }),
    });
  };

  const commitRename = () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    const current = views.find((v) => v.id === renaming.id);
    if (name && current && name !== current.name) {
      updateView.mutate({ viewId: renaming.id, name });
    }
    setRenaming(null);
  };

  return (
    <div className={classes.tabs} role="tablist">
      {views.map((v) => {
        const active = v.id === view.id;
        if (renaming?.id === v.id) {
          return (
            <TextInput
              key={v.id}
              size="xs"
              value={renaming.name}
              autoFocus
              onChange={(e) => setRenaming({ id: v.id, name: e.currentTarget.value })}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(null);
              }}
              className={classes.tabInput}
            />
          );
        }
        return (
          <Menu key={v.id} position="bottom-start" withinPortal disabled={!active || !editable}>
            <Menu.Target>
              <UnstyledButton
                role="tab"
                aria-selected={active}
                className={classes.tab}
                data-active={active || undefined}
                onClick={() => {
                  if (!active) onSelectView(v.id);
                }}
              >
                {viewTypeIcon(v.type)}
                <span className={classes.tabLabel}>{v.name}</span>
                {active && editable && <IconChevronDown size={12} className={classes.tabCaret} />}
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconPencil size={14} />}
                onClick={() => setRenaming({ id: v.id, name: v.name })}
              >
                {t("Rename")}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTrash size={14} />}
                color="red"
                disabled={views.length <= 1}
                onClick={() => confirmDelete(v)}
              >
                {t("Delete view")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        );
      })}
      {editable && (
        <Menu position="bottom-start" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Add view")}
              loading={createView.isPending}
            >
              <IconPlus size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{t("New view")}</Menu.Label>
            <Menu.Item leftSection={<IconTable size={14} />} onClick={() => addView("table")}>
              {t("Table")}
            </Menu.Item>
            <Menu.Item
              leftSection={<IconLayoutKanban size={14} />}
              onClick={() => addView("kanban")}
            >
              {t("Kanban")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}
