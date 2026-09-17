import { useEffect, useRef, useState } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import type { CellProps } from "./cell-types";
import classes from "../../styles/cells.module.css";

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function normalizeHref(kind: "text" | "url" | "email", raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (kind === "email") return `mailto:${s}`;
  if (kind === "url") return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  return null;
}

/** Single-line text, URL and email cells. */
export function TextCell(props: CellProps & { kind?: "text" | "url" | "email" }) {
  const { prop, value, variant, editing, editable, onCommit, onCancel, seedText } = props;
  const kind = props.kind ?? (prop.type === "url" || prop.type === "email" ? prop.type : "text");
  const text = asText(value);

  if (editing && editable) {
    return (
      <InlineInput
        initial={seedText !== undefined ? seedText : text}
        multiline={false}
        onCommit={(v) => onCommit(v.trim() === "" ? null : kind === "text" ? v : v.trim())}
        onCancel={onCancel}
        inputMode={kind === "email" ? "email" : kind === "url" ? "url" : "text"}
      />
    );
  }

  const href = normalizeHref(kind, text);
  return (
    <span className={classes.textValue} data-variant={variant} title={text}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes.link}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {text}
          <IconExternalLink size={12} className={classes.linkIcon} />
        </a>
      ) : (
        text
      )}
    </span>
  );
}

type InlineInputProps = {
  initial: string;
  multiline: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  inputMode?: "text" | "email" | "url" | "decimal";
  align?: "left" | "right";
};

/**
 * Bare input that fills the cell. Enter commits (Shift+Enter inserts a
 * newline when multiline), Escape cancels, blur commits. Tab commits and
 * lets the grid move focus.
 */
export function InlineInput({ initial, multiline, onCommit, onCancel, inputMode, align }: InlineInputProps) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
    if (multiline) autosize(el);
  }, [multiline]);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(text);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(multiline && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === "Tab") {
      commit();
    } else {
      // Arrow keys and typing belong to the input, not the grid.
      e.stopPropagation();
    }
  };

  const common = {
    ref,
    value: text,
    onKeyDown,
    onBlur: commit,
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    className: classes.inlineInput,
    style: align === "right" ? { textAlign: "right" as const } : undefined,
  };

  if (multiline) {
    return (
      <textarea
        {...common}
        rows={1}
        onChange={(e) => {
          setText(e.currentTarget.value);
          autosize(e.currentTarget);
        }}
      />
    );
  }
  return (
    <input
      {...common}
      type="text"
      inputMode={inputMode}
      onChange={(e) => setText(e.currentTarget.value)}
    />
  );
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
}
