import { useMemo, useState } from "react";
import { Button, Popover, ScrollArea, Switch } from "@mantine/core";
import { IconColumns, IconEyeOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { describeType } from "../../model/property-types";
import { viewOrderedProperties } from "../../model/view-config";
import { useBase } from "../base-context";
import classes from "../../styles/views.module.css";

/** Table view: which properties the grid shows. */
export function PropertyVisibilityPopover() {
  const { t } = useTranslation();
  const { base, config, patchConfig } = useBase();
  const [opened, setOpened] = useState(false);

  const ordered = useMemo(() => viewOrderedProperties(base, config), [base, config]);
  const hideable = useMemo(() => ordered.filter((p) => !p.isPrimary), [ordered]);

  // Only count ids that still name a hideable property.
  const hidden = useMemo(() => {
    const ids = new Set(config.hiddenPropertyIds ?? []);
    return new Set(hideable.filter((p) => ids.has(p.id)).map((p) => p.id));
  }, [config.hiddenPropertyIds, hideable]);

  const write = (ids: Set<string>) => {
    // Keep view order so the stored list stays stable and readable.
    const list = hideable.filter((p) => ids.has(p.id)).map((p) => p.id);
    patchConfig({ hiddenPropertyIds: list.length > 0 ? list : null });
  };

  const toggle = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    write(next);
  };

  const active = hidden.size > 0;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      withinPortal
      shadow="md"
      position="bottom-end"
      width={320}
      trapFocus={false}
    >
      <Popover.Target>
        <Button
          size="compact-xs"
          variant={active ? "light" : "subtle"}
          color={active ? "blue" : "gray"}
          leftSection={active ? <IconEyeOff size={14} /> : <IconColumns size={14} />}
          className={classes.toolButton}
          onClick={() => setOpened((o) => !o)}
          aria-expanded={opened}
        >
          {active ? `${t("Properties")} · ${hidden.size}` : t("Properties")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>
        <div className={classes.header}>
          <span className={classes.title}>{t("Properties")}</span>
        </div>

        <ScrollArea.Autosize mah={360} type="auto">
          <div className={classes.visibilityList}>
            {ordered.map((p) => {
              const Icon = describeType(p.type).icon;
              const visible = p.isPrimary || !hidden.has(p.id);
              return (
                <label
                  key={p.id}
                  className={classes.visibilityRow}
                  data-primary={p.isPrimary || undefined}
                >
                  <Icon size={14} className={classes.optionIcon} />
                  <span className={classes.visibilityName} title={p.name}>
                    {p.name || t("Untitled")}
                  </span>
                  <Switch
                    size="xs"
                    checked={visible}
                    disabled={p.isPrimary}
                    onChange={(e) => toggle(p.id, e.currentTarget.checked)}
                    aria-label={p.name || t("Untitled")}
                  />
                </label>
              );
            })}
          </div>
        </ScrollArea.Autosize>

        {hideable.length > 0 && (
          <div className={classes.footer}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => patchConfig({ hiddenPropertyIds: null })}
              disabled={hidden.size === 0}
            >
              {t("Show all")}
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => write(new Set(hideable.map((p) => p.id)))}
              disabled={hidden.size === hideable.length}
            >
              {t("Hide all")}
            </Button>
          </div>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
