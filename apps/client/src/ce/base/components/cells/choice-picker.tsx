import { useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Loader, ScrollArea, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { Choice, IBaseProperty, SelectTypeOptions } from "../../types";
import { getChoices } from "../../model/cell-read";
import { newChoice } from "../../model/property-types";
import { useUpdatePropertyMutation } from "../../queries/property-query";
import { useBase } from "../base-context";
import { ChoiceBadge } from "./choice-badge";
import classes from "../../styles/cells.module.css";

type Props = {
  prop: IBaseProperty;
  selected: string[];
  multiple: boolean;
  /** Single: called with the id (or null to clear) and the picker closes. */
  onPick: (id: string | null) => void;
  /** Multiple: called with the full id list on every toggle. */
  onToggle: (ids: string[]) => void;
  onClose: () => void;
};

export function ChoicePicker({ prop, selected, multiple, onPick, onToggle, onClose }: Props) {
  const { t } = useTranslation();
  const { pageId, editable } = useBase();
  const updateProperty = useUpdatePropertyMutation(pageId);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const choices = getChoices(prop);
  const disableColors = !!(prop.typeOptions as SelectTypeOptions)?.disableColors;
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? choices.filter((c) => c.name.toLowerCase().includes(q)) : choices),
    [choices, q],
  );
  const canCreate =
    editable && q.length > 0 && !choices.some((c) => c.name.toLowerCase() === q);
  const itemCount = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (choice: Choice) => {
    if (multiple) {
      const next = selected.includes(choice.id)
        ? selected.filter((id) => id !== choice.id)
        : [...selected, choice.id];
      onToggle(next);
    } else {
      onPick(choice.id);
    }
  };

  const create = async () => {
    const name = query.trim();
    if (!name) return;
    const opts = prop.typeOptions as SelectTypeOptions;
    const choice = newChoice(name, choices.length);
    const typeOptions: SelectTypeOptions = {
      ...opts,
      choices: [...(opts?.choices ?? []), choice],
      choiceOrder: [...(opts?.choiceOrder ?? choices.map((c) => c.id)), choice.id],
    };
    setQuery("");
    try {
      await updateProperty.mutateAsync({ propertyId: prop.id, typeOptions });
      choose(choice);
    } catch {
      // mutation reported the error
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(itemCount - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < filtered.length) choose(filtered[active]);
      else if (canCreate) void create();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className={classes.picker} onKeyDown={onKeyDown}>
      <div className={classes.pickerSearch}>
        <TextInput
          ref={inputRef}
          size="xs"
          variant="unstyled"
          placeholder={multiple ? t("Search or create an option") : t("Search options")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          rightSection={updateProperty.isPending ? <Loader size={12} /> : undefined}
        />
      </div>
      <ScrollArea.Autosize mah={260} type="auto">
        <div className={classes.pickerList} role="listbox">
          {!multiple && selected.length > 0 && !q && (
            <UnstyledButton className={classes.pickerItem} onClick={() => onPick(null)}>
              <IconX size={14} className={classes.pickerIcon} />
              <Text size="sm" c="dimmed">
                {t("Clear")}
              </Text>
            </UnstyledButton>
          )}
          {filtered.map((c, i) => {
            const isSelected = selected.includes(c.id);
            return (
              <UnstyledButton
                key={c.id}
                role="option"
                aria-selected={isSelected}
                className={classes.pickerItem}
                data-active={i === active || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
              >
                <ChoiceBadge choice={c} disableColors={disableColors} />
                {isSelected && <IconCheck size={14} className={classes.pickerCheck} />}
              </UnstyledButton>
            );
          })}
          {canCreate && (
            <UnstyledButton
              className={classes.pickerItem}
              data-active={active === filtered.length || undefined}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={() => void create()}
            >
              <IconPlus size={14} className={classes.pickerIcon} />
              <Text size="sm" truncate>
                {t("Create")} <b>{query.trim()}</b>
              </Text>
            </UnstyledButton>
          )}
          {itemCount === 0 && (
            <Text size="sm" c="dimmed" p="xs">
              {choices.length === 0 ? t("No options yet") : t("No matches")}
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>
      {multiple && (
        <div className={classes.pickerFooter}>
          <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label={t("Done")}>
            <IconCheck size={14} />
          </ActionIcon>
        </div>
      )}
    </div>
  );
}
