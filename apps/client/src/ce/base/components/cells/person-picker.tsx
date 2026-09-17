import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader, ScrollArea, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { searchSuggestions } from "@/features/search/services/search-service";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service";
import type { UserRef } from "../../types";
import { mergeUsers } from "../../state/references";
import { useBase } from "../base-context";
import { UserChip } from "./user-chip";
import classes from "../../styles/cells.module.css";

type Props = {
  selected: string[];
  multiple: boolean;
  onPick: (id: string | null) => void;
  onToggle: (ids: string[]) => void;
  onClose: () => void;
};

function toRef(u: { id?: string; name?: string | null; avatarUrl?: string | null }): UserRef | null {
  if (!u?.id) return null;
  return { id: u.id, name: u.name ?? null, avatarUrl: u.avatarUrl ?? null };
}

export function PersonPicker({ selected, multiple, onPick, onToggle, onClose }: Props) {
  const { t } = useTranslation();
  const { pageId, refs } = useBase();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();

  const members = useQuery({
    queryKey: ["bases", "person-picker", "members"],
    queryFn: async () => {
      const page = await getWorkspaceMembers({ limit: 50 });
      return page.items.map(toRef).filter((u): u is UserRef => !!u);
    },
    staleTime: 5 * 60 * 1000,
  });

  const search = useQuery({
    queryKey: ["bases", "person-picker", "search", q],
    queryFn: async () => {
      const res = await searchSuggestions({ query: q, includeUsers: true, limit: 15 });
      return (res.users ?? []).map((u) => toRef(u ?? {})).filter((u): u is UserRef => !!u);
    },
    enabled: q.length > 0,
    staleTime: 60 * 1000,
  });

  const results = useMemo(() => {
    const list = q ? search.data ?? [] : members.data ?? [];
    // Keep already selected users visible at the top when nothing is typed.
    if (!q) {
      const known = selected
        .map((id) => refs.users[id] ?? list.find((u) => u.id === id))
        .filter((u): u is UserRef => !!u);
      const rest = list.filter((u) => !selected.includes(u.id));
      return [...known, ...rest];
    }
    return list;
  }, [q, search.data, members.data, selected, refs.users]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const choose = (u: UserRef) => {
    mergeUsers(pageId, [u]);
    if (multiple) {
      onToggle(selected.includes(u.id) ? selected.filter((id) => id !== u.id) : [...selected, u.id]);
    } else {
      onPick(u.id);
    }
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

  const loading = q ? search.isFetching : members.isFetching;

  return (
    <div className={classes.picker} onKeyDown={onKeyDown}>
      <div className={classes.pickerSearch}>
        <TextInput
          ref={inputRef}
          size="xs"
          variant="unstyled"
          placeholder={t("Search people")}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          rightSection={loading ? <Loader size={12} /> : undefined}
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
          {results.map((u, i) => {
            const isSelected = selected.includes(u.id);
            return (
              <UnstyledButton
                key={u.id}
                role="option"
                aria-selected={isSelected}
                className={classes.pickerItem}
                data-active={i === active || undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(u)}
              >
                <UserChip user={u} id={u.id} />
                {isSelected && <IconCheck size={14} className={classes.pickerCheck} />}
              </UnstyledButton>
            );
          })}
          {results.length === 0 && !loading && (
            <Text size="sm" c="dimmed" p="xs">
              {t("No people found")}
            </Text>
          )}
        </div>
      </ScrollArea.Autosize>
    </div>
  );
}
