import { useAtom } from "jotai";
import { useMemo } from "react";
import { orderedViews } from "../model/view-config";
import { activeViewIdAtom } from "../state/atoms";
import type { IBase, IBaseView } from "../types";

/** The selected view, falling back to the first one when the id is stale. */
export function useActiveView(base: IBase): [IBaseView | undefined, (id: string) => void] {
  const [activeId, setActiveId] = useAtom(activeViewIdAtom(base.id));
  const view = useMemo(() => {
    const views = orderedViews(base);
    return views.find((v) => v.id === activeId) ?? views[0];
  }, [base, activeId]);
  return [view, setActiveId];
}
