import { Link } from "react-router-dom";
import { IconFileText } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { usePageReferences } from "../../queries/page-refs";
import { useBase } from "../base-context";
import type { CellProps } from "./cell-types";
import { EditorPopover } from "./editor-popover";
import { PagePicker } from "./page-picker";
import classes from "../../styles/cells.module.css";

export function PageCell(props: CellProps) {
  const { value, variant, editing, editable, onCommit, onCancel, onRequestEdit } = props;
  const { t } = useTranslation();
  const { pageId, refs } = useBase();
  const id = typeof value === "string" && value ? value : null;
  usePageReferences(pageId, id ? [id] : []);
  const page = id ? refs.pages[id] : undefined;

  const display = (
    <span
      className={classes.chipRow}
      data-variant={variant}
      data-empty={!id || undefined}
      onClick={(e) => {
        if (editable && !editing && variant !== "card") {
          e.stopPropagation();
          onRequestEdit();
        }
      }}
    >
      {id && (
        <span className={classes.pageChip} title={page ? getPageTitle(page.title, false, t) : undefined}>
          <span className={classes.pageIcon}>{page?.icon || <IconFileText size={14} />}</span>
          {page ? (
            <Link
              to={buildPageUrl(page.space?.slug, page.slugId, page.title ?? undefined)}
              className={classes.link}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {getPageTitle(page.title, false, t)}
            </Link>
          ) : (
            <span className={classes.dimmed}>{t("Page unavailable")}</span>
          )}
        </span>
      )}
    </span>
  );

  if (!editable || variant === "card") return display;

  return (
    <EditorPopover opened={editing} onClose={onCancel} target={display} width={320}>
      {editing && <PagePicker selected={id} onPick={(next) => onCommit(next)} onClose={onCancel} />}
    </EditorPopover>
  );
}
