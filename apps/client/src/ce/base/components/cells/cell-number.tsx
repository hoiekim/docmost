import type { NumberTypeOptions } from "../../types";
import { formatNumberValue } from "../../model/cell-format";
import type { CellProps } from "./cell-types";
import { InlineInput } from "./cell-text";
import classes from "../../styles/cells.module.css";

function parseNumber(text: string): number | null | undefined {
  const s = text.trim().replace(/[,\s]/g, "").replace(/%$/, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function NumberCell({ prop, value, variant, editing, editable, onCommit, onCancel, seedText }: CellProps) {
  const opts = prop.typeOptions as NumberTypeOptions;
  const raw = typeof value === "number" ? String(value) : value == null ? "" : String(value);

  if (editing && editable) {
    return (
      <InlineInput
        initial={seedText !== undefined ? seedText : raw}
        multiline={false}
        inputMode="decimal"
        align="right"
        onCommit={(text) => {
          const n = parseNumber(text);
          if (n === undefined) onCancel();
          else onCommit(n);
        }}
        onCancel={onCancel}
      />
    );
  }

  const formatted = formatNumberValue(value, opts);
  if (opts?.format === "progress" && formatted !== "") {
    const pct = Math.max(0, Math.min(100, Number(value)));
    return (
      <span className={classes.progressValue} data-variant={variant} title={formatted}>
        <span className={classes.progressBar}>
          <span className={classes.progressFill} style={{ width: `${pct}%` }} />
        </span>
        <span className={classes.progressLabel}>{formatted}</span>
      </span>
    );
  }
  return (
    <span className={classes.numberValue} data-variant={variant} title={formatted}>
      {formatted}
    </span>
  );
}
