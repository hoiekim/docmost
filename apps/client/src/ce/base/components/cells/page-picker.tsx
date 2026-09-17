import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader, ScrollArea, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconCheck, IconFileText, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { searchPage } from "@/features/search/services/search-service";
import type { IPageSearch } from "@/features/search/types/search.types";
import { getPageTitle } from "@/features/page/page.utils";
import type { ResolvedPage } from "../../types";
import { mergePages } from "../../state/references";
import { useBase } from "../base-context";
import classes from "../../styles/cells.module.css";

type Props = {
  selected: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
};

function toResolved(p: IPageSearch): ResolvedPage {
  return {
    id: p.id,
    slugId: p.slugId,
    title: p.title ?? null,
    icon: p.icon ?? null,
    spaceId: (p.space?.id as string) ?? "",
    space: p.space?.id
      ? { id: p.space.id as string, slug: p.space.slug as string, name: p.space.name as string }
      : null,
  };
}

export function PagePicker({ selected, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const { pageId } = useBase();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();

  const search = useQuery({
    queryKey: ["bases", "page-picker", q],
    queryFn: () => searchPage({ query: q, titleOnly: true }),
    enabled: q.length > 0,
    staleTime: 30 * 1000,
  });
  const results = q ? search.data ?? [] : [];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (p: IPageSearch) => {
    mergePages(pageId, [toResolved(p)]);
    onPick(p.id);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
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
          placeholder={t("Search pages")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          rightSection={search.isFetching ? <Loader size={12} /> : undefined}
        />
      </div>
      <ScrollArea.Autosize mah={260} type="auto">
        <div className={classes.pickerList} role="listbox">
          {selected && !q && (
            <UnstyledButton className={classes.pickerItem} onClick={() => onPick(null)}>
              <IconX size={14} className={classes.pickerIcon} />
              <Text size="sm" c="dimmed">
                {t("Clear")}
              </Text>
            </UnstyledButton>
          )}
          {results.map((p, i) => (
            <UnstyledButton
              key={p.id}
              role="option"
              aria-selected={p.id === selected}
              className={classes.pickerItem}
              data-active={i === active || undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
            >
              <span className={classes.pageIcon}>
                {p.icon || <IconFileText size={14} />}
              </span>
              <Text size="sm" truncate style={{ flex: 1 }}>
                {getPageTitle(p.title, false, t)}
              </Text>
              {p.space?.name && (
                <Text size="xs" c="dimmed" truncate maw={90}>
                  {p.space.name}
                </Text>
              )}
              {p.id === selected && <IconCheck size={14} className={classes.pickerCheck} />}
            </UnstyledButton>
          ))}
          {q && results.length === 0 && !search.isFetching && (
            <Text size="sm" c="dimmed" p="xs">
              {t("No pages found")}
            </Text>
          )}
          {!q && (
            <Text size="sm" c="dimmed" p="xs">
              {t("Type to search pages")}
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  );
}
