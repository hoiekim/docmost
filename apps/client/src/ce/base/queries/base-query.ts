import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { queryClient } from "@/main.tsx";
import { getApiErrorMessage } from "@/lib/api-error";
import type { IPage } from "@/features/page/types/page.types";
import { convertPageToBase, getBase } from "../api";
import type { BaseTemplate, IBase, IBaseProperty, IBaseView } from "../types";
import { baseKeys } from "./keys";

export function useBaseQuery(pageId: string): UseQueryResult<IBase, Error> {
  return useQuery({
    queryKey: baseKeys.base(pageId),
    queryFn: () => getBase(pageId),
    enabled: !!pageId,
    staleTime: 60 * 1000,
  });
}

export function getCachedBase(pageId: string): IBase | undefined {
  return queryClient.getQueryData<IBase>(baseKeys.base(pageId));
}

export function setCachedBase(pageId: string, updater: (base: IBase) => IBase): void {
  queryClient.setQueryData<IBase>(baseKeys.base(pageId), (prev) =>
    prev ? updater(prev) : prev,
  );
}

export function upsertCachedProperty(pageId: string, property: IBaseProperty): void {
  setCachedBase(pageId, (base) => {
    const exists = base.properties.some((p) => p.id === property.id);
    return {
      ...base,
      properties: exists
        ? base.properties.map((p) => (p.id === property.id ? property : p))
        : [...base.properties, property],
    };
  });
}

export function removeCachedProperty(pageId: string, propertyId: string): void {
  setCachedBase(pageId, (base) => ({
    ...base,
    properties: base.properties.filter((p) => p.id !== propertyId),
  }));
}

export function upsertCachedView(pageId: string, view: IBaseView): void {
  setCachedBase(pageId, (base) => {
    const exists = base.views.some((v) => v.id === view.id);
    return {
      ...base,
      views: exists
        ? base.views.map((v) => (v.id === view.id ? view : v))
        : [...base.views, view],
    };
  });
}

export function removeCachedView(pageId: string, viewId: string): void {
  setCachedBase(pageId, (base) => ({
    ...base,
    views: base.views.filter((v) => v.id !== viewId),
  }));
}

export function invalidateBase(pageId: string): void {
  queryClient.invalidateQueries({ queryKey: baseKeys.base(pageId) });
}

export function invalidateRows(pageId: string): void {
  queryClient.invalidateQueries({ queryKey: baseKeys.rowsRoot(pageId) });
}

/**
 * Turn the current (empty) document into a base. The page query drives
 * which renderer pages/page/page.tsx picks, so flip `isBase` on every cached
 * copy of the page as soon as the server confirms.
 */
export function useConvertPageToBaseMutation() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  return useMutation<IBase, Error, { pageId: string; template?: BaseTemplate }>({
    mutationFn: (input) => convertPageToBase(input),
    onSuccess: (base, input) => {
      qc.setQueryData<IBase>(baseKeys.base(base.id), base);
      for (const key of [input.pageId, base.id, base.slugId]) {
        qc.setQueryData<IPage>(["pages", key], (prev) =>
          prev ? { ...prev, isBase: true } : prev,
        );
      }
      qc.invalidateQueries({ queryKey: ["pages", base.id] });
      qc.invalidateQueries({ queryKey: ["pages", base.slugId] });
      qc.invalidateQueries({ queryKey: ["sidebar-pages"] });
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create base")),
        color: "red",
      });
    },
  });
}
