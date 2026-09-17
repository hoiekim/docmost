import { useState } from "react";
import { Button, Checkbox, Group, Menu, Popover, ScrollArea, Text } from "@mantine/core";
import { IconCheck, IconEye, IconLayoutKanban } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { IBase, IBaseProperty, ViewConfig } from "../../types";
import { kanbanGroupCandidates, viewOrderedProperties } from "../../model/view-config";
import { describeType } from "../../model/property-types";
import { useBase } from "../base-context";
import classes from "../../styles/kanban.module.css";

/**
 * The property a kanban view groups by: the configured one when it is still a
 * single-choice property, otherwise the first candidate (or none).
 */
export function resolveGroupProperty(
  base: Pick<IBase, "properties">,
  config: ViewConfig | undefined,
): IBaseProperty | undefined {
  const candidates = kanbanGroupCandidates(base);
  const configured = candidates.find((p) => p.id === config?.groupByPropertyId);
  return configured ?? candidates[0];
}

export function KanbanGroupByMenu() {
  const { t } = useTranslation();
  const { base, config, patchConfig } = useBase();
  const candidates = kanbanGroupCandidates(base);
  const current = resolveGroupProperty(base, config);

  return (
    <Menu position="bottom-end" withinPortal disabled={candidates.length === 0}>
      <Menu.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconLayoutKanban size={14} />}
          className={classes.toolButton}
        >
          {current ? t("Group: {{name}}", { name: current.name }) : t("Group by")}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t("Group by")}</Menu.Label>
        {candidates.map((p) => {
          const Icon = describeType(p.type).icon;
          const active = p.id === current?.id;
          return (
            <Menu.Item
              key={p.id}
              leftSection={<Icon size={14} />}
              rightSection={active ? <IconCheck size={14} /> : undefined}
              onClick={() => {
                if (!active) patchConfig({ groupByPropertyId: p.id });
              }}
            >
              {p.name}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

export function KanbanCardPropertiesPopover() {
  const { t } = useTranslation();
  const { base, config, patchConfig } = useBase();
  const [opened, setOpened] = useState(false);
  const properties = viewOrderedProperties(base, config).filter((p) => !p.isPrimary);
  const visible = new Set(config.visiblePropertyIds ?? []);
  const shownCount = properties.filter((p) => visible.has(p.id)).length;

  const commit = (ids: string[]) => patchConfig({ visiblePropertyIds: ids.length ? ids : null });
  const toggle = (id: string, on: boolean) =>
    commit(properties.map((p) => p.id).filter((pid) => (pid === id ? on : visible.has(pid))));

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      width={260}
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconEye size={14} />}
          className={classes.toolButton}
          onClick={() => setOpened((o) => !o)}
        >
          {t("Properties")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" px="sm" py={6} className={classes.propertiesHeader}>
          <Text size="xs" c="dimmed">
            {t("{{count}} shown on cards", { count: shownCount })}
          </Text>
          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={shownCount === properties.length}
              onClick={() => commit(properties.map((p) => p.id))}
            >
              {t("Show all")}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              disabled={shownCount === 0}
              onClick={() => commit([])}
            >
              {t("Hide all")}
            </Button>
          </Group>
        </Group>
        <ScrollArea.Autosize mah={320} type="auto">
          <div className={classes.propertiesList}>
            {properties.length === 0 && (
              <Text size="sm" c="dimmed" px="sm" py={6}>
                {t("No properties to show.")}
              </Text>
            )}
            {properties.map((p) => {
              const Icon = describeType(p.type).icon;
              return (
                <Checkbox
                  key={p.id}
                  size="xs"
                  className={classes.propertyRow}
                  checked={visible.has(p.id)}
                  onChange={(e) => toggle(p.id, e.currentTarget.checked)}
                  label={
                    <span className={classes.propertyLabel}>
                      <Icon size={14} className={classes.propertyIcon} />
                      <span className={classes.propertyName}>{p.name}</span>
                    </span>
                  }
                />
              );
            })}
          </div>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
