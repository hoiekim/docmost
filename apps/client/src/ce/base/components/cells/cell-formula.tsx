import { Loader, Tooltip } from "@mantine/core";
import { IconAlertCircle, IconSquare, IconSquareCheck } from "@tabler/icons-react";
import type { FormulaTypeOptions } from "../../types";
import { formatFormulaValue } from "../../model/cell-format";
import { isFormulaError } from "../../model/cell-read";
import { useBase } from "../base-context";
import type { CellProps } from "./cell-types";
import classes from "../../styles/cells.module.css";

export function FormulaCell({ prop, value, variant }: CellProps) {
  const { recomputing } = useBase();
  const opts = prop.typeOptions as FormulaTypeOptions;
  const busy = recomputing.has(prop.id);

  if (isFormulaError(value)) {
    return (
      <Tooltip label={value.msg} withArrow multiline maw={280}>
        <span className={classes.errorValue} data-variant={variant}>
          <IconAlertCircle size={13} />
          #ERROR
        </span>
      </Tooltip>
    );
  }

  let body: React.ReactNode;
  if (opts?.resultType === "boolean" && (value === true || value === false)) {
    body = value ? <IconSquareCheck size={16} /> : <IconSquare size={16} />;
  } else {
    body = formatFormulaValue(value, prop);
  }

  const numeric = opts?.resultType === "number";
  return (
    <span
      className={numeric ? classes.numberValue : classes.textValue}
      data-variant={variant}
      data-busy={busy || undefined}
      title={typeof body === "string" ? body : undefined}
    >
      {body}
      {busy && <Loader size={10} ml={4} />}
    </span>
  );
}
