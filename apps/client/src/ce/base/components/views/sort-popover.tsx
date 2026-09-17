import { useMemo, useState } from "react";
import { ActionIcon, Button, Popover, SegmentedControl, Select } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconArrowsSort, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { IBaseProperty, SortDirection, ViewSortConfig } from "../../types";
import { describeType } from "../../model/property-types";
import { useBase } from "../base-context";
import classes from "../../styles/views.module.css";

const MAX_SORTS = 10;

export function SortPopover() {
  const { t } = useTranslation();
  const { config, patchConfig, properties, propsById } = useBase();
  const [opened, setOpened] = useState(false);

  const sortable = useMemo(
    () => properties.filter((p) => describeType(p.type).sortable),
    [properties],
  );

  // Ignore entries whose property no longer exists or cannot be sorted.
  const sorts = useMemo(
    () =>
      (config.sorts ?? []).filter((s) => {
        const p = propsById.get(s.propertyId);
        return !!p && describeType(p.type).sortable;
      }),
    [config.sorts, propsById],
  );

  const used = useMemo(() => new Set(sorts.map((s) => s.propertyId)), [sorts]);
  const unused = sortable.filter((p) => !used.has(p.id));

  const write = (next: ViewSortConfig[]) => {
    patchConfig({ sorts: next.length > 0 ? next : null });
  };

  const update = (index: number, patch: Partial<ViewSortConfig>) => {
    write(sorts.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const remove = (index: number) => write(sorts.filter((_, i) => i !== index));

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= sorts.length) return;
    const next = sorts.slice();
    [next[index], next[target]] = [next[target], next[index]];
    write(next);
  };

  const add = () => {
    const first = unused[0];
    if (!first || sorts.length >= MAX_SORTS) return;
    write([...sorts, { propertyId: first.id, direction: "asc" }]);
  };

  const active = sorts.length > 0;

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
          leftSection={<IconArrowsSort size={14} />}
          className={classes.toolButton}
          onClick={() => setOpened((o) => !o)}
          aria-expanded={opened}
        >
          {active ? `${t("Sort")} · ${sorts.length}` : t("Sort")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>
        <div className={classes.header}>
          <span className={classes.title}>{t("Sort")}</span>
        </div>

        {sorts.length === 0 ? (
          <div className={classes.empty}>{t("No sorts applied")}</div>
        ) : (
          <div className={classes.rows}>
            {sorts.map((sort, index) => (
              <SortRow
                key={sort.propertyId}
                sort={sort}
                options={sortable.filter((p) => p.id === sort.propertyId || !used.has(p.id))}
                isFirst={index === 0}
                isLast={index === sorts.length - 1}
                onChange={(patch) => update(index, patch)}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}

        <div className={classes.footer}>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconPlus size={14} />}
            onClick={add}
            disabled={unused.length === 0 || sorts.length >= MAX_SORTS}
          >
            {t("Add sort")}
          </Button>
          {sorts.length > 0 && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => patchConfig({ sorts: null })}
            >
              {t("Clear")}
            </Button>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

type SortRowProps = {
  sort: ViewSortConfig;
  options: IBaseProperty[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<ViewSortConfig>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function SortRow({
  sort,
  options,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SortRowProps) {
  const { t } = useTranslation();
  const { propsById } = useBase();
  const prop = propsById.get(sort.propertyId);

  const data = useMemo(
    () => options.map((p) => ({ value: p.id, label: p.name || t("Untitled") })),
    [options, t],
  );

  return (
    <div className={classes.row}>
      <div className={classes.rowLine}>
        <Select
          size="xs"
          className={classes.rowField}
          data={data}
          value={sort.propertyId}
          onChange={(id) => id && onChange({ propertyId: id })}
          allowDeselect={false}
          searchable
          nothingFoundMessage={t("No properties found")}
          leftSection={prop ? <TypeIcon prop={prop} /> : undefined}
          renderOption={({ option }) => (
            <PropertyOption prop={propsById.get(option.value)} label={option.label} />
          )}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Property")}
        />
        <div className={classes.rowActions}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t("Move up")}
          >
            <IconArrowUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t("Move down")}
          >
            <IconArrowDown size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={onRemove}
            aria-label={t("Remove")}
          >
            <IconX size={14} />
          </ActionIcon>
        </div>
      </div>
      <div className={classes.rowLine}>
        <SegmentedControl
          size="xs"
          fullWidth
          className={classes.rowField}
          value={sort.direction}
          onChange={(v) => onChange({ direction: (v === "desc" ? "desc" : "asc") as SortDirection })}
          data={[
            { value: "asc", label: t("Ascending") },
            { value: "desc", label: t("Descending") },
          ]}
        />
      </div>
    </div>
  );
}

function TypeIcon({ prop }: { prop: IBaseProperty }) {
  const Icon = describeType(prop.type).icon;
  return <Icon size={14} className={classes.optionIcon} />;
}

function PropertyOption({ prop, label }: { prop: IBaseProperty | undefined; label: string }) {
  return (
    <span className={classes.option}>
      {prop && <TypeIcon prop={prop} />}
      <span className={classes.optionLabel}>{label}</span>
    </span>
  );
}
