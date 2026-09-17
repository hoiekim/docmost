import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  ColorSwatch,
  Group,
  MultiSelect,
  Popover,
  Select,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconGripVertical, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { draggable, dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge, extractClosestEdge, type Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import type { BasePropertyType, Choice, ChoiceCategory, SelectTypeOptions } from "../../types";
import { CHOICE_COLORS, normalizeChoiceColor } from "../../model/choice-colors";
import { newChoice } from "../../model/property-types";
import { moveInList } from "../../positions";
import classes from "../../styles/property.module.css";

type Props = {
  type: BasePropertyType;
  options: SelectTypeOptions;
  onChange: (options: SelectTypeOptions) => void;
};

const CATEGORIES: Array<{ value: ChoiceCategory; label: string }> = [
  { value: "todo", label: "To do" },
  { value: "inProgress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

function orderedChoices(options: SelectTypeOptions): Choice[] {
  const byId = new Map((options.choices ?? []).map((c) => [c.id, c]));
  const out: Choice[] = [];
  for (const id of options.choiceOrder ?? []) {
    const c = byId.get(id);
    if (c) {
      out.push(c);
      byId.delete(id);
    }
  }
  return [...out, ...byId.values()];
}

export function ChoiceOptionsEditor({ type, options, onChange }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const choices = orderedChoices(options);
  const isStatus = type === "status";
  const multiple = type === "multiSelect";

  const commit = (next: Choice[], extra: Partial<SelectTypeOptions> = {}) =>
    onChange({ ...options, ...extra, choices: next, choiceOrder: next.map((c) => c.id) });

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (choices.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    const choice: Choice = { ...newChoice(name, choices.length), ...(isStatus ? { category: "todo" } : {}) };
    setDraft("");
    commit([...choices, choice]);
  };

  const update = (id: string, patch: Partial<Choice>) =>
    commit(choices.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const remove = (id: string) => {
    const next = choices.filter((c) => c.id !== id);
    const def = options.defaultValue;
    const nextDefault = Array.isArray(def)
      ? def.filter((d) => d !== id)
      : def === id
        ? null
        : def;
    commit(next, { defaultValue: nextDefault });
  };

  const reorder = (draggedId: string, targetId: string, edge: "before" | "after") => {
    const ids = moveInList(choices.map((c) => c.id), draggedId, targetId, edge);
    const byId = new Map(choices.map((c) => [c.id, c]));
    commit(ids.map((id) => byId.get(id)!).filter(Boolean));
  };

  const selectData = choices.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className={classes.section}>
      <Text size="xs" fw={500} c="dimmed">
        {t("Options")}
      </Text>
      <div className={classes.choiceList}>
        {choices.map((c) => (
          <ChoiceRow
            key={c.id}
            choice={c}
            isStatus={isStatus}
            disableColors={!!options.disableColors}
            onChange={(patch) => update(c.id, patch)}
            onRemove={() => remove(c.id)}
            onReorder={reorder}
          />
        ))}
      </div>
      <TextInput
        size="xs"
        placeholder={t("Add an option")}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        rightSection={
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={add} aria-label={t("Add option")}>
            <IconPlus size={14} />
          </ActionIcon>
        }
      />
      <Switch
        size="xs"
        label={t("Show colors")}
        checked={!options.disableColors}
        onChange={(e) => onChange({ ...options, disableColors: !e.currentTarget.checked })}
      />
      {multiple ? (
        <MultiSelect
          size="xs"
          label={t("Default value")}
          data={selectData}
          value={Array.isArray(options.defaultValue) ? options.defaultValue : options.defaultValue ? [options.defaultValue] : []}
          onChange={(v) => onChange({ ...options, defaultValue: v.length ? v : null })}
          clearable
          comboboxProps={{ withinPortal: true, zIndex: 400 }}
        />
      ) : (
        <Select
          size="xs"
          label={t("Default value")}
          data={selectData}
          value={typeof options.defaultValue === "string" ? options.defaultValue : null}
          onChange={(v) => onChange({ ...options, defaultValue: v })}
          clearable
          comboboxProps={{ withinPortal: true, zIndex: 400 }}
        />
      )}
    </div>
  );
}

type RowProps = {
  choice: Choice;
  isStatus: boolean;
  disableColors: boolean;
  onChange: (patch: Partial<Choice>) => void;
  onRemove: () => void;
  onReorder: (draggedId: string, targetId: string, edge: "before" | "after") => void;
};

function ChoiceRow({ choice, isStatus, disableColors, onChange, onRemove, onReorder }: RowProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);
  const [dropEdge, setDropEdge] = useState<Edge | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const color = normalizeChoiceColor(choice.color);

  useEffect(() => {
    const el = ref.current;
    const handle = handleRef.current;
    if (!el || !handle) return;
    return combine(
      draggable({
        element: el,
        dragHandle: handle,
        getInitialData: () => ({ type: "base-choice", choiceId: choice.id }),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => source.data.type === "base-choice" && source.data.choiceId !== choice.id,
        getData: ({ input, element }) =>
          attachClosestEdge({ choiceId: choice.id }, { input, element, allowedEdges: ["top", "bottom"] }),
        onDrag: ({ self }) => setDropEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setDropEdge(null),
        onDrop: ({ self, source }) => {
          const edge = extractClosestEdge(self.data);
          setDropEdge(null);
          if (edge) onReorder(source.data.choiceId as string, choice.id, edge === "top" ? "before" : "after");
        },
      }),
    );
  }, [choice.id, onReorder]);

  return (
    <div ref={ref} className={classes.choiceRow} data-drop-edge={dropEdge ?? undefined}>
      <span ref={handleRef} className={classes.choiceHandle} aria-hidden="true">
        <IconGripVertical size={12} />
      </span>
      <Popover opened={colorOpen} onChange={setColorOpen} position="bottom-start" withinPortal shadow="md" zIndex={400}>
        <Popover.Target>
          <UnstyledButton
            className={classes.choiceColorButton}
            onClick={() => setColorOpen((o) => !o)}
            aria-label={t("Choose color")}
            disabled={disableColors}
          >
            <ColorSwatch color={`var(--mantine-color-${disableColors ? "gray" : color}-5)`} size={14} />
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown p={6}>
          <Group gap={4} maw={160}>
            {CHOICE_COLORS.map((c) => (
              <UnstyledButton
                key={c}
                className={classes.colorSwatchButton}
                data-selected={c === color || undefined}
                onClick={() => {
                  onChange({ color: c });
                  setColorOpen(false);
                }}
                aria-label={c}
              >
                <ColorSwatch color={`var(--mantine-color-${c}-5)`} size={18} />
              </UnstyledButton>
            ))}
          </Group>
        </Popover.Dropdown>
      </Popover>
      <TextInput
        size="xs"
        variant="unstyled"
        value={choice.name}
        onChange={(e) => onChange({ name: e.currentTarget.value })}
        className={classes.choiceName}
        aria-label={t("Option name")}
      />
      {isStatus && (
        <Select
          size="xs"
          data={CATEGORIES.map((c) => ({ value: c.value, label: t(c.label) }))}
          value={choice.category ?? "todo"}
          onChange={(v) => v && onChange({ category: v as ChoiceCategory })}
          allowDeselect={false}
          w={110}
          comboboxProps={{ withinPortal: true, zIndex: 400 }}
        />
      )}
      <ActionIcon size="xs" variant="subtle" color="gray" onClick={onRemove} aria-label={t("Remove option")}>
        <IconX size={12} />
      </ActionIcon>
    </div>
  );
}
