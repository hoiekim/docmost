import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";
import { createProperty, deleteProperty, reorderProperty, updateProperty } from "../api";
import { newRequestId } from "../ids";
import { markOutbound } from "../realtime/outbound";
import type { IBaseProperty, TypeOptions, UpdatePropertyResult } from "../types";
import {
  invalidateRows,
  removeCachedProperty,
  setCachedBase,
  upsertCachedProperty,
} from "./base-query";

export function useCreatePropertyMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<
    IBaseProperty,
    Error,
    { name: string; type: string; typeOptions?: TypeOptions }
  >({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return createProperty({ pageId, ...input, requestId });
    },
    onSuccess: (property) => {
      upsertCachedProperty(pageId, property);
      if (property.type === "formula") invalidateRows(pageId);
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create property")),
        color: "red",
      });
    },
  });
}

export function useUpdatePropertyMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<
    UpdatePropertyResult,
    Error,
    { propertyId: string; name?: string; type?: string; typeOptions?: TypeOptions }
  >({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return updateProperty({ pageId, ...input, requestId });
    },
    onSuccess: (result, input) => {
      upsertCachedProperty(pageId, result.property);
      // A finished inline conversion or a formula edit rewrote cells.
      if (input.type || result.property.type === "formula") invalidateRows(pageId);
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update property")),
        color: "red",
      });
    },
  });
}

export function useDeletePropertyMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, { propertyId: string }>({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return deleteProperty({ pageId, ...input, requestId });
    },
    onSuccess: (_void, input) => {
      removeCachedProperty(pageId, input.propertyId);
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete property")),
        color: "red",
      });
    },
  });
}

export function useReorderPropertyMutation(pageId: string) {
  const { t } = useTranslation();
  return useMutation<void, Error, { propertyId: string; position: string }>({
    mutationFn: (input) => {
      const requestId = markOutbound(newRequestId());
      return reorderProperty({ pageId, ...input, requestId });
    },
    onMutate: (input) => {
      setCachedBase(pageId, (base) => ({
        ...base,
        properties: base.properties.map((p) =>
          p.id === input.propertyId ? { ...p, position: input.position } : p,
        ),
      }));
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to reorder property")),
        color: "red",
      });
    },
  });
}
