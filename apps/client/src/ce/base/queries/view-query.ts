import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { createView, deleteView, updateView } from "../api";
import { applyConfigPatch } from "../model/view-config";
import type { IBaseView, ViewConfig, ViewConfigPatch } from "../types";
import { getCachedBase, removeCachedView, setCachedBase, upsertCachedView } from "./base-query";

export function useCreateViewMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, { name: string; type?: string; config?: ViewConfig }>({
    mutationFn: (input) => createView({ pageId, ...input }),
    onSuccess: (view) => upsertCachedView(pageId, view),
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create view")),
        color: "red",
      });
    },
  });
}

export type UpdateViewInput = {
  viewId: string;
  name?: string;
  type?: string;
  config?: ViewConfigPatch;
  position?: string;
};

/**
 * Optimistic: the cached view is patched immediately so filters, sorts and
 * column widths never wait for the round trip; the server copy wins on
 * success and the snapshot is restored on error.
 */
export function useUpdateViewMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, UpdateViewInput, { previous?: IBaseView }>({
    mutationFn: (input) => updateView({ pageId, ...input }),
    onMutate: (input) => {
      const previous = getCachedBase(pageId)?.views.find((v) => v.id === input.viewId);
      setCachedBase(pageId, (base) => ({
        ...base,
        views: base.views.map((v) =>
          v.id !== input.viewId
            ? v
            : {
                ...v,
                name: input.name ?? v.name,
                type: (input.type as IBaseView["type"]) ?? v.type,
                position: input.position ?? v.position,
                config: input.config ? applyConfigPatch(v.config, input.config) : v.config,
              },
        ),
      }));
      return { previous };
    },
    onSuccess: (view) => upsertCachedView(pageId, view),
    onError: (error, _input, ctx) => {
      if (ctx?.previous) upsertCachedView(pageId, ctx.previous);
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update view")),
        color: "red",
      });
    },
  });
}

export function useDeleteViewMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, { viewId: string }>({
    mutationFn: (input) => deleteView({ pageId, ...input }),
    onSuccess: (_void, input) => removeCachedView(pageId, input.viewId),
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete view")),
        color: "red",
      });
    },
  });
}
