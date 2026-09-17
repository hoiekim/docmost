import api from "@/lib/api-client";
import { saveAs } from "file-saver";
import type {
  BaseTemplate,
  FilterNode,
  IBase,
  IBaseProperty,
  IBaseRow,
  IBaseView,
  ResolvedPage,
  RowsPage,
  TypeOptions,
  UpdatePropertyResult,
  ViewConfig,
  ViewConfigPatch,
  ViewSortConfig,
} from "./types";

/**
 * REST client for the CE bases module (apps/server/src/ce/base/base.controller.ts).
 * The axios interceptor unwraps the transport envelope, so `res.data` is the
 * payload (the same convention as the core services).
 */

// ---- base ----

export async function getBase(pageId: string): Promise<IBase> {
  const res = await api.post<IBase>("/bases/info", { pageId });
  return res.data;
}

export async function createBase(input: {
  spaceId?: string;
  parentPageId?: string;
  name?: string;
  icon?: string;
  template?: BaseTemplate;
}): Promise<IBase> {
  const res = await api.post<IBase>("/bases/create", input);
  return res.data;
}

export async function convertPageToBase(input: {
  pageId: string;
  template?: BaseTemplate;
}): Promise<IBase> {
  const res = await api.post<IBase>("/bases/convert", input);
  return res.data;
}

export async function updateBase(input: {
  pageId: string;
  name?: string;
  icon?: string;
}): Promise<IBase> {
  const res = await api.post<IBase>("/bases/update", input);
  return res.data;
}

export async function expandPages(pageIds: string[]): Promise<ResolvedPage[]> {
  if (pageIds.length === 0) return [];
  const res = await api.post<{ items: ResolvedPage[] }>(
    "/bases/pages/expand",
    { pageIds },
  );
  return res.data.items;
}

export async function exportBaseCsv(pageId: string, fallbackName: string) {
  // This endpoint is exempt from envelope unwrapping (see api-client.ts), so
  // `res` is the raw axios response and the headers are available.
  const res = await api.post("/bases/export-csv", { pageId }, {
    responseType: "blob",
  });
  const disposition: string | undefined = res.headers?.["content-disposition"];
  let fileName = `${fallbackName || "base"}.csv`;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? "");
  const plain = /filename="([^"]+)"/i.exec(disposition ?? "");
  if (star) fileName = decodeURIComponent(star[1]);
  else if (plain) fileName = decodeURIComponent(plain[1]);
  saveAs(res.data as Blob, fileName);
}

// ---- properties ----

export async function createProperty(input: {
  pageId: string;
  name: string;
  type: string;
  typeOptions?: TypeOptions;
  requestId?: string;
}): Promise<IBaseProperty> {
  const res = await api.post<IBaseProperty>(
    "/bases/properties/create",
    input,
  );
  return res.data;
}

export async function updateProperty(input: {
  pageId: string;
  propertyId: string;
  name?: string;
  type?: string;
  typeOptions?: TypeOptions;
  requestId?: string;
}): Promise<UpdatePropertyResult> {
  const res = await api.post<UpdatePropertyResult>(
    "/bases/properties/update",
    input,
  );
  return res.data;
}

export async function deleteProperty(input: {
  pageId: string;
  propertyId: string;
  requestId?: string;
}): Promise<void> {
  await api.post("/bases/properties/delete", input);
}

export async function reorderProperty(input: {
  pageId: string;
  propertyId: string;
  position: string;
  requestId?: string;
}): Promise<void> {
  await api.post("/bases/properties/reorder", input);
}

// ---- rows ----

export type ListRowsInput = {
  pageId: string;
  cursor?: string;
  limit?: number;
  filter?: FilterNode | null;
  sorts?: ViewSortConfig[];
};

export async function listRows(input: ListRowsInput): Promise<RowsPage> {
  const body: Record<string, unknown> = { pageId: input.pageId };
  if (input.cursor) body.cursor = input.cursor;
  if (input.limit) body.limit = input.limit;
  if (input.filter) body.filter = input.filter;
  if (input.sorts && input.sorts.length > 0) body.sorts = input.sorts;
  const res = await api.post<RowsPage>("/bases/rows", body);
  return res.data;
}

export async function getRow(pageId: string, rowId: string): Promise<IBaseRow> {
  const res = await api.post<IBaseRow>("/bases/rows/info", {
    pageId,
    rowId,
  });
  return res.data;
}

export async function createRow(input: {
  pageId: string;
  cells?: Record<string, unknown>;
  afterRowId?: string;
  position?: string;
  requestId?: string;
}): Promise<IBaseRow> {
  const res = await api.post<IBaseRow>("/bases/rows/create", input);
  return res.data;
}

export async function updateRow(input: {
  pageId: string;
  rowId: string;
  cells: Record<string, unknown>;
  position?: string;
  requestId?: string;
}): Promise<IBaseRow> {
  const res = await api.post<IBaseRow>("/bases/rows/update", input);
  return res.data;
}

export async function deleteRow(input: {
  pageId: string;
  rowId: string;
  requestId?: string;
}): Promise<void> {
  await api.post("/bases/rows/delete", input);
}

export async function deleteRows(input: {
  pageId: string;
  rowIds: string[];
  requestId?: string;
}): Promise<void> {
  await api.post("/bases/rows/delete-many", input);
}

export async function reorderRow(input: {
  pageId: string;
  rowId: string;
  position: string;
  requestId?: string;
}): Promise<void> {
  await api.post("/bases/rows/reorder", input);
}

// ---- views ----

export async function createView(input: {
  pageId: string;
  name: string;
  type?: string;
  config?: ViewConfig;
}): Promise<IBaseView> {
  const res = await api.post<IBaseView>("/bases/views/create", input);
  return res.data;
}

export async function updateView(input: {
  pageId: string;
  viewId: string;
  name?: string;
  type?: string;
  config?: ViewConfigPatch;
  position?: string;
}): Promise<IBaseView> {
  const res = await api.post<IBaseView>("/bases/views/update", input);
  return res.data;
}

export async function deleteView(input: {
  pageId: string;
  viewId: string;
}): Promise<void> {
  await api.post("/bases/views/delete", input);
}
