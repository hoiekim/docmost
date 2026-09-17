import { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { applyConfigPatch } from "../model/view-config";
import { useUpdateViewMutation } from "../queries/view-query";
import { viewDraftAtom } from "../state/atoms";
import type { IBaseView, ViewConfig, ViewConfigPatch } from "../types";

export type ViewConfigController = {
  /** Effective config: the saved one with any local draft applied. */
  config: ViewConfig;
  /** Persist (editors) or stash locally (viewers). */
  patchConfig: (patch: ViewConfigPatch) => void;
  draft: ViewConfigPatch | null;
  discardDraft: () => void;
};

/**
 * Editors change a view for everyone; viewers get a private, in-memory draft
 * so they can still filter and sort what they see.
 */
export function useViewConfig(
  pageId: string,
  view: IBaseView,
  editable: boolean,
): ViewConfigController {
  const [draft, setDraft] = useAtom(viewDraftAtom(view.id));
  const updateView = useUpdateViewMutation(pageId);

  const config = useMemo(
    () => (draft ? applyConfigPatch(view.config, draft) : view.config ?? {}),
    [view.config, draft],
  );

  const patchConfig = useCallback(
    (patch: ViewConfigPatch) => {
      if (editable) {
        updateView.mutate({ viewId: view.id, config: patch });
      } else {
        setDraft((prev) => ({ ...(prev ?? {}), ...patch }));
      }
    },
    [editable, updateView, view.id, setDraft],
  );

  const discardDraft = useCallback(() => setDraft(null), [setDraft]);

  return { config, patchConfig, draft, discardDraft };
}
