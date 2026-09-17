import { useState } from "react";
import { ActionIcon, Button, Group, Menu, Tooltip } from "@mantine/core";
import { IconDots, IconDownload, IconPlus } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { exportBaseCsv } from "../../api";
import { useBase } from "../base-context";
import { FilterPopover } from "../views/filter-popover";
import { SortPopover } from "../views/sort-popover";
import { PropertyVisibilityPopover } from "../views/property-visibility-popover";
import { KanbanCardPropertiesPopover, KanbanGroupByMenu } from "../kanban/kanban-settings";
import { ViewTabs } from "./view-tabs";
import classes from "../../styles/toolbar.module.css";

type Props = { onSelectView: (id: string) => void };

export function BaseToolbar({ onSelectView }: Props) {
  const { t } = useTranslation();
  const { base, view, editable, createRow, openRow } = useBase();
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await exportBaseCsv(base.id, base.name || t("Untitled base"));
    } catch (err) {
      notifications.show({ message: getApiErrorMessage(err, t("Export failed")), color: "red" });
    } finally {
      setExporting(false);
    }
  };

  const addRow = async () => {
    setCreating(true);
    try {
      const row = await createRow();
      if (view.type === "kanban") openRow(row.id);
    } catch {
      // reported by the mutation
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={classes.toolbar} data-view-type={view.type}>
      <ViewTabs onSelectView={onSelectView} />
      <Group gap={4} wrap="nowrap" className={classes.actions}>
        {view.type === "kanban" && <KanbanGroupByMenu />}
        <FilterPopover />
        <SortPopover />
        {view.type === "kanban" ? <KanbanCardPropertiesPopover /> : <PropertyVisibilityPopover />}
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Tooltip label={t("More")} openDelay={400}>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("More")}>
                <IconDots size={16} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconDownload size={14} />}
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              {t("Export CSV")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        {editable && (
          <Button
            size="compact-xs"
            variant="filled"
            leftSection={<IconPlus size={14} />}
            onClick={() => void addRow()}
            loading={creating}
          >
            {t("New")}
          </Button>
        )}
      </Group>
    </div>
  );
}
