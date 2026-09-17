import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Textarea, TextInput } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  checkFormula,
  formulaFunctionDocs,
  propReference,
  type FormulaCheck,
  type FormulaFunctionDoc,
} from "../../model/formula";
import { describeType } from "../../model/property-types";
import type { FormulaResultType, IBaseProperty } from "../../types";
import classes from "../../styles/formula.module.css";

export type FormulaEditorProps = {
  source: string;
  onChange: (source: string) => void;
  /** Properties that may be referenced (the caller already excludes the property being edited). */
  properties: IBaseProperty[];
  /** Id of the property being edited, or null while creating. */
  selfId: string | null;
  /** Fires whenever the validation result changes. */
  onCheck?: (check: FormulaCheck) => void;
};

const CHECK_DEBOUNCE_MS = 150;

type Selection = { start: number; end: number };

/** English labels; passed through t() when rendered. */
const CATEGORY_LABELS: Record<FormulaFunctionDoc["category"], string> = {
  logic: "Logic",
  math: "Math",
  string: "Text",
  date: "Date",
  coercion: "Conversion",
};

const RESULT_LABELS: Record<FormulaResultType, string> = {
  number: "number",
  string: "text",
  boolean: "boolean",
  date: "date",
  null: "empty",
};

export function FormulaEditor({ source, onChange, properties, selfId, onCheck }: FormulaEditorProps) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<Selection>({ start: source.length, end: source.length });
  const pendingCaret = useRef<number | null>(null);
  const [check, setCheck] = useState<FormulaCheck | null>(null);
  const [search, setSearch] = useState("");

  // Debounced validation; onCheck only fires when the result actually changes.
  const onCheckRef = useRef(onCheck);
  onCheckRef.current = onCheck;
  const lastCheck = useRef<string | null>(null);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = checkFormula(source, properties, selfId);
      setCheck(next);
      const key = JSON.stringify(next);
      if (key !== lastCheck.current) {
        lastCheck.current = key;
        onCheckRef.current?.(next);
      }
    }, CHECK_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [source, properties, selfId]);

  // After an insertion re-rendered the textarea, restore focus and caret.
  useEffect(() => {
    const pos = pendingCaret.current;
    if (pos === null) return;
    pendingCaret.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pos, pos);
    selection.current = { start: pos, end: pos };
  }, [source]);

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selection.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  };

  const insert = (snippet: string) => {
    const { start, end } = selection.current;
    const from = Math.min(start, source.length);
    const to = Math.min(Math.max(end, from), source.length);
    pendingCaret.current = from + snippet.length;
    onChange(source.slice(0, from) + snippet + source.slice(to));
  };

  const docs = useMemo(() => formulaFunctionDocs(), []);
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = new Map<FormulaFunctionDoc["category"], FormulaFunctionDoc[]>();
    for (const fn of docs) {
      if (q && !fn.name.toLowerCase().includes(q) && !fn.doc.toLowerCase().includes(q)) continue;
      const list = out.get(fn.category);
      if (list) list.push(fn);
      else out.set(fn.category, [fn]);
    }
    return [...out.entries()];
  }, [docs, search]);

  return (
    <div className={classes.root}>
      <Textarea
        ref={textareaRef}
        value={source}
        onChange={(e) => {
          onChange(e.currentTarget.value);
          rememberSelection();
        }}
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onClick={rememberSelection}
        onBlur={rememberSelection}
        autosize
        minRows={3}
        maxRows={8}
        placeholder={t('e.g. prop("Price") * prop("Quantity")')}
        aria-label={t("Formula")}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        classNames={{ input: classes.source }}
      />

      <FormulaStatus check={check} />

      <div className={classes.section}>
        <div className={classes.sectionTitle}>{t("Properties")}</div>
        {properties.length === 0 ? (
          <div className={classes.doc}>{t("No other properties to reference")}</div>
        ) : (
          <div className={classes.chips}>
            {properties.map((prop) => {
              const Icon = describeType(prop.type).icon;
              return (
                <Button
                  key={prop.id}
                  size="compact-xs"
                  variant="default"
                  className={classes.chip}
                  leftSection={<Icon size={12} />}
                  title={t("Insert {{name}}", { name: propReference(prop.name) })}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(propReference(prop.name))}
                >
                  <span className={classes.chipLabel}>{prop.name}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>

      <div className={classes.section}>
        <div className={classes.sectionTitle}>{t("Functions")}</div>
        <TextInput
          size="xs"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder={t("Search functions")}
          aria-label={t("Search functions")}
          leftSection={<IconSearch size={14} />}
        />
        <div className={classes.functionList}>
          {groups.length === 0 ? (
            <div className={classes.doc} style={{ padding: "6px 8px" }}>
              {t("No functions match")}
            </div>
          ) : (
            groups.map(([category, fns]) => (
              <div key={category}>
                <div className={classes.category}>{t(CATEGORY_LABELS[category] ?? category)}</div>
                {fns.map((fn) => (
                  <button
                    key={fn.name}
                    type="button"
                    className={classes.functionItem}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(`${fn.name}(`)}
                  >
                    <span className={classes.signature}>{fn.signature}</span>
                    <span className={classes.doc}>{fn.doc}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FormulaStatus({ check }: { check: FormulaCheck | null }) {
  const { t } = useTranslation();
  if (!check) {
    return (
      <div className={classes.status} data-pending aria-live="polite">
        {t("Checking formula…")}
      </div>
    );
  }
  if (check.ok === false) {
    return (
      <div className={classes.status} data-error role="alert">
        <IconAlertCircle size={14} className={classes.statusIcon} />
        <span>{t(check.error)}</span>
      </div>
    );
  }
  return (
    <div className={classes.status} data-ok aria-live="polite">
      <IconCircleCheck size={14} className={classes.statusIcon} />
      <span>{t("Returns {{type}}", { type: t(RESULT_LABELS[check.resultType] ?? check.resultType) })}</span>
    </div>
  );
}
