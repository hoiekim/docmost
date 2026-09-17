import { NumberInput, SegmentedControl, Select, Switch, TextInput } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type {
  BasePropertyType,
  CheckboxTypeOptions,
  DateTypeOptions,
  IBaseProperty,
  NumberTypeOptions,
  PersonTypeOptions,
  SelectTypeOptions,
  TextTypeOptions,
  TypeOptions,
} from "../../types";
import { ChoiceOptionsEditor } from "./choice-options-editor";
import { FormulaEditor } from "./formula-editor";
import type { FormulaCheck } from "../../model/formula";
import classes from "../../styles/property.module.css";

type Props = {
  type: BasePropertyType;
  options: TypeOptions;
  onChange: (options: TypeOptions) => void;
  /** For formulas: properties that may be referenced, and the edited id. */
  properties: IBaseProperty[];
  selfId: string | null;
  onFormulaCheck?: (check: FormulaCheck) => void;
};

const DATE_FORMATS = [
  { value: "MMM d, yyyy", label: "Sep 15, 2026" },
  { value: "MMMM d, yyyy", label: "September 15, 2026" },
  { value: "yyyy-MM-dd", label: "2026-09-15" },
  { value: "MM/dd/yyyy", label: "09/15/2026" },
  { value: "dd/MM/yyyy", label: "15/09/2026" },
  { value: "d MMM yyyy", label: "15 Sep 2026" },
];

export function TypeOptionsEditor({ type, options, onChange, properties, selfId, onFormulaCheck }: Props) {
  const { t } = useTranslation();

  switch (type) {
    case "select":
    case "status":
    case "multiSelect":
      return (
        <ChoiceOptionsEditor
          type={type}
          options={{ choices: [], choiceOrder: [], ...(options as SelectTypeOptions) }}
          onChange={(o) => onChange(o as TypeOptions)}
        />
      );

    case "number": {
      const o = options as NumberTypeOptions;
      return (
        <div className={classes.section}>
          <Select
            size="xs"
            label={t("Format")}
            data={[
              { value: "plain", label: t("Number") },
              { value: "currency", label: t("Currency") },
              { value: "percent", label: t("Percent") },
              { value: "progress", label: t("Progress bar") },
            ]}
            value={o.format ?? "plain"}
            onChange={(v) => v && onChange({ ...o, format: v as NumberTypeOptions["format"] })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
          {o.format === "currency" && (
            <TextInput
              size="xs"
              label={t("Currency code")}
              placeholder="USD"
              value={o.currencyCode ?? ""}
              maxLength={8}
              onChange={(e) => onChange({ ...o, currencyCode: e.currentTarget.value.toUpperCase() || undefined })}
            />
          )}
          <NumberInput
            size="xs"
            label={t("Decimal places")}
            placeholder={t("Auto")}
            min={0}
            max={10}
            value={o.precision ?? ""}
            onChange={(v) => onChange({ ...o, precision: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            size="xs"
            label={t("Default value")}
            value={o.defaultValue ?? ""}
            onChange={(v) => onChange({ ...o, defaultValue: typeof v === "number" ? v : null })}
          />
        </div>
      );
    }

    case "date": {
      const o = options as DateTypeOptions;
      return (
        <div className={classes.section}>
          <Select
            size="xs"
            label={t("Date format")}
            data={DATE_FORMATS}
            value={o.dateFormat ?? DATE_FORMATS[0].value}
            onChange={(v) => v && onChange({ ...o, dateFormat: v })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true, zIndex: 400 }}
          />
          <Switch
            size="xs"
            label={t("Include time")}
            checked={!!o.includeTime}
            onChange={(e) => onChange({ ...o, includeTime: e.currentTarget.checked })}
          />
          {o.includeTime && (
            <SegmentedControl
              size="xs"
              data={[
                { value: "12h", label: t("12 hour") },
                { value: "24h", label: t("24 hour") },
              ]}
              value={o.timeFormat ?? "12h"}
              onChange={(v) => onChange({ ...o, timeFormat: v as "12h" | "24h" })}
            />
          )}
        </div>
      );
    }

    case "person": {
      const o = options as PersonTypeOptions;
      return (
        <div className={classes.section}>
          <Switch
            size="xs"
            label={t("Allow multiple people")}
            checked={!!o.allowMultiple}
            onChange={(e) => onChange({ ...o, allowMultiple: e.currentTarget.checked })}
          />
        </div>
      );
    }

    case "checkbox": {
      const o = options as CheckboxTypeOptions;
      return (
        <div className={classes.section}>
          <Switch
            size="xs"
            label={t("Checked by default")}
            checked={!!o.defaultValue}
            onChange={(e) => onChange({ ...o, defaultValue: e.currentTarget.checked || undefined })}
          />
        </div>
      );
    }

    case "text":
    case "longText":
    case "url":
    case "email": {
      const o = options as TextTypeOptions;
      return (
        <div className={classes.section}>
          <TextInput
            size="xs"
            label={t("Default value")}
            value={o.defaultValue ?? ""}
            onChange={(e) => onChange({ ...o, defaultValue: e.currentTarget.value || null })}
          />
        </div>
      );
    }

    case "formula":
      return (
        <div className={classes.section}>
          <FormulaEditor
            source={typeof options.source === "string" ? options.source : ""}
            onChange={(source) => onChange({ ...options, source })}
            properties={properties.filter((p) => p.id !== selfId)}
            selfId={selfId}
            onCheck={onFormulaCheck}
          />
        </div>
      );

    default:
      return null;
  }
}
