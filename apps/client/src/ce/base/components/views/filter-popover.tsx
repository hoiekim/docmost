import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Button,
  MultiSelect,
  NumberInput,
  Popover,
  SegmentedControl,
  Select,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconFilter, IconPlus, IconX } from "@tabler/icons-react";
import { format as formatDate, isValid, parse } from "date-fns";
import { useTranslation } from "react-i18next";
import type {
  DateFilterAnchor,
  DateFilterRange,
  DateFilterValue,
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOperator,
  IBaseProperty,
} from "../../types";
import {
  DATE_ANCHORS,
  DATE_RANGES,
  OPERATOR_LABELS,
  countConditions,
  defaultDateFilterValue,
  defaultOperator,
  emptyFilterGroup,
  filterValueKind,
  isFilterGroup,
  operatorsFor,
} from "../../model/filters";
import { asIdList, getChoices } from "../../model/cell-read";
import { describeType } from "../../model/property-types";
import { useBase } from "../base-context";
import { PersonPicker } from "../cells/person-picker";
import { UserChip } from "../cells/user-chip";
import classes from "../../styles/views.module.css";

const TEXT_DEBOUNCE_MS = 300;
const DAY_FORMAT = "yyyy-MM-dd";

export function FilterPopover() {
  const { t } = useTranslation();
  const { config, patchConfig, properties } = useBase();
  const [opened, setOpened] = useState(false);
  const [group, setGroup] = useState<FilterGroup>(() => config.filter ?? emptyFilterGroup());

  const count = countConditions(config.filter);
  const conditions = group.children;

  // Text and number inputs are debounced; everything else persists at once.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<FilterGroup | null>(null);
  // Latest patchConfig without making the callbacks below depend on its identity.
  const patchRef = useRef(patchConfig);
  patchRef.current = patchConfig;

  const persist = useCallback((next: FilterGroup) => {
    patchRef.current({ filter: next.children.length > 0 ? next : null });
  }, []);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const next = pending.current;
      pending.current = null;
      persist(next);
    }
  }, [persist]);

  // Never lose a debounced edit when the toolbar unmounts (e.g. view switch).
  useEffect(() => () => flush(), [flush]);

  const commit = useCallback(
    (next: FilterGroup, debounce = false) => {
      setGroup(next);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (!debounce) {
        pending.current = null;
        persist(next);
        return;
      }
      pending.current = next;
      timer.current = setTimeout(() => {
        timer.current = null;
        flush();
      }, TEXT_DEBOUNCE_MS);
    },
    [persist, flush],
  );

  const setOpen = (next: boolean) => {
    if (next) {
      // Local state lives only while the popover is open.
      setGroup(config.filter ?? emptyFilterGroup());
    } else {
      flush();
    }
    setOpened(next);
  };

  const updateChild = (index: number, child: FilterNode, debounce = false) => {
    const children = group.children.slice();
    children[index] = child;
    commit({ ...group, children }, debounce);
  };

  const removeChild = (index: number) => {
    commit({ ...group, children: group.children.filter((_, i) => i !== index) });
  };

  const addCondition = () => {
    const first = properties[0];
    if (!first) return;
    const cond: FilterCondition = { propertyId: first.id, op: defaultOperator(first), value: undefined };
    commit({ ...group, children: [...group.children, cond] });
  };

  const clearAll = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    setGroup(emptyFilterGroup(group.op));
    patchConfig({ filter: null });
  };

  const active = count > 0;

  return (
    <Popover
      opened={opened}
      onChange={setOpen}
      withinPortal
      shadow="md"
      position="bottom-end"
      width={380}
      trapFocus={false}
    >
      <Popover.Target>
        <Button
          size="compact-xs"
          variant={active ? "light" : "subtle"}
          color={active ? "blue" : "gray"}
          leftSection={<IconFilter size={14} />}
          className={classes.toolButton}
          onClick={() => setOpen(!opened)}
          aria-expanded={opened}
        >
          {active ? `${t("Filter")} · ${count}` : t("Filter")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown className={classes.dropdown}>
        <div className={classes.header}>
          <span className={classes.title}>{t("Filter")}</span>
          {conditions.length >= 2 && (
            <SegmentedControl
              size="xs"
              value={group.op}
              onChange={(v) => commit({ ...group, op: v === "or" ? "or" : "and" })}
              data={[
                { value: "and", label: t("All") },
                { value: "or", label: t("Any") },
              ]}
            />
          )}
        </div>

        {conditions.length === 0 ? (
          <div className={classes.empty}>{t("No filters applied")}</div>
        ) : (
          <div className={classes.rows}>
            {conditions.map((child, index) =>
              isFilterGroup(child) ? (
                <AdvancedGroupRow
                  key={index}
                  group={child}
                  onRemove={() => removeChild(index)}
                />
              ) : (
                <ConditionRow
                  key={index}
                  condition={child}
                  onChange={(next, debounce) => updateChild(index, next, debounce)}
                  onRemove={() => removeChild(index)}
                />
              ),
            )}
          </div>
        )}

        <div className={classes.footer}>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconPlus size={14} />}
            onClick={addCondition}
            disabled={properties.length === 0}
          >
            {t("Add filter")}
          </Button>
          {conditions.length > 0 && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={clearAll}>
              {t("Clear all")}
            </Button>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

/* ---- rows ---- */

function AdvancedGroupRow({ group, onRemove }: { group: FilterGroup; onRemove: () => void }) {
  const { t } = useTranslation();
  const n = countConditions(group);
  return (
    <div className={classes.row} data-disabled>
      <div className={classes.rowLine}>
        <span className={classes.rowLabel}>
          {t("Advanced group ({{count}} conditions)", { count: n })}
        </span>
        <div className={classes.rowActions}>
          <RemoveButton onClick={onRemove} />
        </div>
      </div>
    </div>
  );
}

type ConditionRowProps = {
  condition: FilterCondition;
  onChange: (next: FilterCondition, debounce?: boolean) => void;
  onRemove: () => void;
};

function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const { t } = useTranslation();
  const { properties, propsById } = useBase();
  const prop = propsById.get(condition.propertyId);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ value: p.id, label: p.name || t("Untitled") })),
    [properties, t],
  );

  const operatorOptions = useMemo(
    () =>
      prop
        ? operatorsFor(prop).map((op) => ({ value: op, label: t(OPERATOR_LABELS[op]) }))
        : [],
    [prop, t],
  );

  const changeProperty = (id: string | null) => {
    const next = id ? propsById.get(id) : undefined;
    if (!next) return;
    onChange({ propertyId: next.id, op: defaultOperator(next), value: undefined });
  };

  const changeOperator = (value: string | null) => {
    if (!prop || !value) return;
    const op = value as FilterOperator;
    const sameKind = filterValueKind(prop, condition.op) === filterValueKind(prop, op);
    onChange({ ...condition, op, value: sameKind ? condition.value : undefined });
  };

  const kind = prop ? filterValueKind(prop, condition.op) : "none";

  return (
    <div className={classes.row}>
      <div className={classes.rowLine}>
        <Select
          size="xs"
          className={classes.rowField}
          data={propertyOptions}
          value={prop ? prop.id : null}
          onChange={changeProperty}
          placeholder={prop ? undefined : t("Deleted property")}
          allowDeselect={false}
          searchable
          nothingFoundMessage={t("No properties found")}
          leftSection={prop ? <TypeIcon prop={prop} /> : undefined}
          renderOption={({ option }) => <PropertyOption prop={propsById.get(option.value)} label={option.label} />}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Property")}
        />
        <Select
          size="xs"
          className={classes.rowFieldNarrow}
          data={operatorOptions}
          value={condition.op}
          onChange={changeOperator}
          allowDeselect={false}
          disabled={!prop}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Operator")}
        />
        <div className={classes.rowActions}>
          <RemoveButton onClick={onRemove} />
        </div>
      </div>
      {prop && kind !== "none" && (
        <div className={classes.rowLine}>
          <ValueInput
            kind={kind}
            prop={prop}
            value={condition.value}
            onChange={(value, debounce) => onChange({ ...condition, value }, debounce)}
          />
        </div>
      )}
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <ActionIcon variant="subtle" color="gray" size="sm" onClick={onClick} aria-label={t("Remove")}>
      <IconX size={14} />
    </ActionIcon>
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

/* ---- value inputs ---- */

type ValueInputProps = {
  kind: ReturnType<typeof filterValueKind>;
  prop: IBaseProperty;
  value: unknown;
  onChange: (value: unknown, debounce?: boolean) => void;
};

function ValueInput({ kind, prop, value, onChange }: ValueInputProps) {
  const { t } = useTranslation();

  switch (kind) {
    case "text":
      return (
        <TextInput
          size="xs"
          className={classes.rowField}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.currentTarget.value, true)}
          placeholder={t("Value")}
          aria-label={t("Value")}
        />
      );
    case "number":
      return (
        <NumberInput
          size="xs"
          className={classes.rowField}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => onChange(typeof v === "number" ? v : undefined, true)}
          placeholder={t("Value")}
          aria-label={t("Value")}
          hideControls
        />
      );
    case "boolean":
      return (
        <Select
          size="xs"
          className={classes.rowField}
          data={[
            { value: "true", label: t("Checked") },
            { value: "false", label: t("Unchecked") },
          ]}
          value={value === true ? "true" : "false"}
          onChange={(v) => onChange(v === "true")}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Value")}
        />
      );
    case "date":
      return <DateValueInput value={value} onChange={onChange} />;
    case "choices":
      return <ChoicesValueInput prop={prop} value={value} onChange={onChange} />;
    case "people":
      return <PeopleValueInput value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function asDateFilterValue(value: unknown): DateFilterValue {
  if (value && typeof value === "object" && "mode" in value) {
    const v = value as DateFilterValue;
    if (v.mode === "exact" || v.mode === "relative" || v.mode === "range") return v;
  }
  return defaultDateFilterValue();
}

function today(): string {
  return formatDate(new Date(), DAY_FORMAT);
}

function toDay(input: string | Date | null): string | null {
  if (!input) return null;
  const d = typeof input === "string" ? parse(input.slice(0, 10), DAY_FORMAT, new Date()) : input;
  return isValid(d) ? formatDate(d, DAY_FORMAT) : null;
}

function DateValueInput({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: DateFilterValue) => void;
}) {
  const { t } = useTranslation();
  const current = asDateFilterValue(value);

  const changeMode = (mode: string | null) => {
    if (!mode || mode === current.mode) return;
    if (mode === "exact") onChange({ mode: "exact", date: today() });
    else if (mode === "relative") onChange({ mode: "relative", preset: DATE_ANCHORS[0].value });
    else onChange({ mode: "range", preset: DATE_RANGES[0].value });
  };

  const exactDate =
    current.mode === "exact" && current.date
      ? parse(current.date.slice(0, 10), DAY_FORMAT, new Date())
      : null;

  return (
    <>
      <Select
        size="xs"
        className={classes.rowFieldNarrow}
        data={[
          { value: "relative", label: t("Relative") },
          { value: "exact", label: t("Exact date") },
          { value: "range", label: t("Range") },
        ]}
        value={current.mode}
        onChange={changeMode}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        aria-label={t("Date mode")}
      />
      {current.mode === "exact" && (
        <DateInput
          size="xs"
          className={classes.rowField}
          value={exactDate && isValid(exactDate) ? exactDate : null}
          onChange={(d) => {
            const day = toDay(d);
            if (day) onChange({ mode: "exact", date: day });
          }}
          valueFormat="MMM D, YYYY"
          placeholder={t("Pick a date")}
          popoverProps={{ withinPortal: true }}
          aria-label={t("Date")}
        />
      )}
      {current.mode === "relative" && (
        <Select
          size="xs"
          className={classes.rowField}
          data={DATE_ANCHORS.map((a) => ({ value: a.value, label: t(a.label) }))}
          value={current.preset}
          onChange={(v) => v && onChange({ mode: "relative", preset: v as DateFilterAnchor })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Date")}
        />
      )}
      {current.mode === "range" && (
        <Select
          size="xs"
          className={classes.rowField}
          data={DATE_RANGES.map((r) => ({ value: r.value, label: t(r.label) }))}
          value={current.preset}
          onChange={(v) => v && onChange({ mode: "range", preset: v as DateFilterRange })}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          aria-label={t("Date")}
        />
      )}
    </>
  );
}

function ChoicesValueInput({
  prop,
  value,
  onChange,
}: {
  prop: IBaseProperty;
  value: unknown;
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () => getChoices(prop).map((c) => ({ value: c.id, label: c.name || t("Untitled") })),
    [prop, t],
  );
  const known = useMemo(() => new Set(options.map((o) => o.value)), [options]);
  const selected = asIdList(value).filter((id) => known.has(id));

  return (
    <MultiSelect
      size="xs"
      className={classes.rowField}
      data={options}
      value={selected}
      onChange={onChange}
      placeholder={selected.length === 0 ? t("Select options") : undefined}
      searchable
      clearable
      hidePickedOptions
      nothingFoundMessage={t("No options found")}
      comboboxProps={{ withinPortal: true }}
      aria-label={t("Value")}
    />
  );
}

function PeopleValueInput({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  const { refs } = useBase();
  const [opened, setOpened] = useState(false);
  const selected = asIdList(value);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      withinPortal
      shadow="md"
      position="bottom-start"
      width={280}
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.peopleButton}
          onClick={() => setOpened((o) => !o)}
          data-expanded={opened || undefined}
          aria-label={t("People")}
        >
          {selected.length === 0 ? (
            <span className={classes.peoplePlaceholder}>{t("Select people")}</span>
          ) : (
            selected.map((id) => <UserChip key={id} id={id} user={refs.users[id]} />)
          )}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        {opened && (
          <PersonPicker
            selected={selected}
            multiple
            onPick={(id) => onChange(id ? [id] : [])}
            onToggle={onChange}
            onClose={() => setOpened(false)}
          />
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
