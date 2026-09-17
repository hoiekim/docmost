import { useState } from "react";
import { Button, Group } from "@mantine/core";
import { DatePicker, TimeInput } from "@mantine/dates";
import { format as formatDate, parse } from "date-fns";
import { useTranslation } from "react-i18next";
import type { DateTypeOptions } from "../../types";
import { formatDateValue, parseDateValue } from "../../model/cell-format";
import type { CellProps } from "./cell-types";
import { EditorPopover } from "./editor-popover";
import classes from "../../styles/cells.module.css";

/**
 * Date-only values are stored as `YYYY-MM-DD` so every timezone reads the
 * same calendar day and the server's UTC-day filters line up. Values with a
 * time are stored as ISO instants.
 */
export function serializeDate(date: Date, includeTime: boolean): string {
  return includeTime ? date.toISOString() : formatDate(date, "yyyy-MM-dd");
}

function toDateInputValue(d: Date | null): Date | null {
  return d;
}

export function DateCell(props: CellProps) {
  const { prop, value, variant, editing, editable, onCommit, onChange, onCancel, onRequestEdit } = props;
  const { t } = useTranslation();
  const opts = (prop.typeOptions ?? {}) as DateTypeOptions;
  const includeTime = !!opts.includeTime;
  const current = parseDateValue(value);
  const text = formatDateValue(value, opts);

  const display = (
    <span
      className={classes.textValue}
      data-variant={variant}
      title={text}
      onClick={(e) => {
        if (editable && !editing && variant !== "card") {
          e.stopPropagation();
          onRequestEdit();
        }
      }}
    >
      {text}
    </span>
  );

  if (!editable || variant === "card") return display;

  return (
    <EditorPopover opened={editing} onClose={onCancel} target={display} width={300}>
      {editing && (
        <DateEditor
          current={current}
          includeTime={includeTime}
          onPickDay={(d) => {
            if (includeTime) onChange(serializeDate(d, true));
            else onCommit(serializeDate(d, false));
          }}
          onChangeTime={(d) => onChange(serializeDate(d, true))}
          onClear={() => onCommit(null)}
          onDone={onCancel}
          clearLabel={t("Clear")}
          doneLabel={t("Done")}
        />
      )}
    </EditorPopover>
  );
}

type DateEditorProps = {
  current: Date | null;
  includeTime: boolean;
  onPickDay: (d: Date) => void;
  onChangeTime: (d: Date) => void;
  onClear: () => void;
  onDone: () => void;
  clearLabel: string;
  doneLabel: string;
};

export function DateEditor({
  current,
  includeTime,
  onPickDay,
  onChangeTime,
  onClear,
  onDone,
  clearLabel,
  doneLabel,
}: DateEditorProps) {
  const [time, setTime] = useState(current ? formatDate(current, "HH:mm") : "09:00");

  const pickDay = (d: Date | string | null) => {
    if (!d) return;
    const day = typeof d === "string" ? parse(d, "yyyy-MM-dd", new Date()) : d;
    if (includeTime) {
      const [h, m] = time.split(":").map(Number);
      day.setHours(h || 0, m || 0, 0, 0);
    }
    onPickDay(day);
  };

  const changeTime = (next: string) => {
    setTime(next);
    const base = current ? new Date(current) : new Date();
    const [h, m] = next.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    base.setHours(h, m, 0, 0);
    onChangeTime(base);
  };

  return (
    <div className={classes.dateEditor}>
      <DatePicker
        value={toDateInputValue(current)}
        onChange={pickDay}
        size="xs"
        firstDayOfWeek={1}
      />
      {includeTime && (
        <TimeInput
          size="xs"
          value={time}
          onChange={(e) => changeTime(e.currentTarget.value)}
          mt={4}
        />
      )}
      <Group justify="space-between" mt={6}>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={onClear}>
          {clearLabel}
        </Button>
        <Button size="compact-xs" variant="light" onClick={onDone}>
          {doneLabel}
        </Button>
      </Group>
    </div>
  );
}
