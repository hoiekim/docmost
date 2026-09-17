/**
 * Client-side contract for bases. Mirrors apps/server/src/ce/base/types/base.types.ts;
 * keep the two in sync.
 */

export type BasePropertyType =
  | "text"
  | "number"
  | "select"
  | "status"
  | "multiSelect"
  | "date"
  | "person"
  | "file"
  | "page"
  | "checkbox"
  | "url"
  | "email"
  | "createdAt"
  | "lastEditedAt"
  | "lastEditedBy"
  | "formula"
  | "longText";

export const BASE_PROPERTY_TYPES: readonly BasePropertyType[] = [
  "text",
  "longText",
  "number",
  "select",
  "status",
  "multiSelect",
  "date",
  "person",
  "file",
  "page",
  "checkbox",
  "url",
  "email",
  "formula",
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
];

/** Derived from row metadata; never stored in cells and never editable. */
export const SYSTEM_PROPERTY_TYPES: readonly BasePropertyType[] = [
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
];

/** Types an existing property cannot be converted into. */
export const NON_CONVERSION_TARGET_TYPES: readonly BasePropertyType[] = [
  "createdAt",
  "lastEditedAt",
  "lastEditedBy",
  "formula",
];

export type BaseViewType = "table" | "kanban" | "calendar";

export type ChoiceCategory = "todo" | "inProgress" | "complete";

export type Choice = {
  id: string;
  name: string;
  color: string;
  category?: ChoiceCategory;
};

export type SelectTypeOptions = {
  choices: Choice[];
  choiceOrder: string[];
  disableColors?: boolean;
  defaultValue?: string | string[] | null;
};

export type NumberFormat = "plain" | "currency" | "percent" | "progress";

export type NumberTypeOptions = {
  format?: NumberFormat;
  separators?: string;
  precision?: number;
  currencyCode?: string;
  currencySymbol?: string;
  defaultValue?: number | null;
};

export type DateTypeOptions = {
  dateFormat?: string;
  timeFormat?: "12h" | "24h";
  includeTime?: boolean;
  defaultValue?: string | null;
};

export type PersonTypeOptions = {
  allowMultiple?: boolean;
  defaultValue?: string | string[] | null;
};

export type TextTypeOptions = {
  defaultValue?: string | null;
};

export type CheckboxTypeOptions = {
  defaultValue?: boolean;
};

export type FormulaResultType = "number" | "string" | "boolean" | "date" | "null";

export type FormulaTypeOptions = {
  source: string;
  ast?: unknown;
  resultType?: FormulaResultType;
  dependencies?: string[];
  astVersion?: number;
  formatOptions?: Record<string, unknown>;
};

export type TypeOptions = Record<string, unknown>;

export type FileValue = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  url?: string;
};

export type FormulaErrorCell = { __err: string; msg: string; v: 1 };

export type SortDirection = "asc" | "desc";

export type ViewSortConfig = { propertyId: string; direction: SortDirection };

export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "ncontains"
  | "startsWith"
  | "endsWith"
  | "isEmpty"
  | "isNotEmpty"
  | "before"
  | "after"
  | "onOrBefore"
  | "onOrAfter"
  | "any"
  | "none"
  | "all"
  | "isWithin";

export type DateFilterAnchor =
  | "today"
  | "tomorrow"
  | "yesterday"
  | "oneWeekAgo"
  | "oneWeekFromNow"
  | "oneMonthAgo"
  | "oneMonthFromNow";

export type DateFilterRange =
  | "pastWeek"
  | "pastMonth"
  | "pastYear"
  | "thisWeek"
  | "thisMonth"
  | "thisYear"
  | "nextWeek"
  | "nextMonth"
  | "nextYear";

export type DateFilterValue =
  | { mode: "exact"; date: string }
  | { mode: "relative"; preset: DateFilterAnchor }
  | { mode: "range"; preset: DateFilterRange };

export type FilterCondition = {
  propertyId: string;
  op: FilterOperator;
  value?: unknown;
};

export type FilterGroup = {
  op: "and" | "or";
  children: Array<FilterCondition | FilterGroup>;
};

export type FilterNode = FilterCondition | FilterGroup;

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filter?: FilterGroup;
  /** Kanban: properties shown on cards. */
  visiblePropertyIds?: string[];
  /** Table: properties hidden from the grid. */
  hiddenPropertyIds?: string[];
  propertyWidths?: Record<string, number>;
  propertyOrder?: string[];
  groupByPropertyId?: string;
  hiddenChoiceIds?: string[];
  choiceOrder?: string[];
};

/** `null` removes the key on the server. */
export type ViewConfigPatch = { [K in keyof ViewConfig]?: ViewConfig[K] | null };

export type IBaseProperty = {
  id: string;
  pageId: string;
  name: string;
  type: BasePropertyType;
  position: string;
  typeOptions: TypeOptions;
  pendingType?: BasePropertyType | null;
  pendingTypeOptions?: TypeOptions | null;
  isPrimary: boolean;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export type IBaseRow = {
  id: string;
  pageId: string;
  cells: Record<string, unknown>;
  position: string;
  creatorId: string | null;
  lastUpdatedById: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export type IBaseView = {
  id: string;
  pageId: string;
  name: string;
  type: BaseViewType;
  config: ViewConfig;
  position: string;
  workspaceId: string;
  creatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BasePermissions = { canEdit: boolean; hasRestriction: boolean };

export type IBase = {
  id: string;
  slugId: string;
  name: string;
  description?: string;
  icon?: string | null;
  pageId?: string;
  spaceId: string;
  workspaceId: string;
  creatorId: string | null;
  properties: IBaseProperty[];
  views: IBaseView[];
  createdAt: string;
  updatedAt: string;
  permissions?: BasePermissions;
  baseSchemaVersion: number;
};

export type UserRef = { id: string; name: string | null; avatarUrl: string | null };

export type ResolvedPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  space: { id: string; slug: string; name: string } | null;
};

export type RowReferences = {
  users: Record<string, UserRef>;
  pages: Record<string, ResolvedPage>;
};

export type PaginationMeta = {
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
};

export type RowsPage = {
  items: IBaseRow[];
  meta: PaginationMeta;
  references: RowReferences;
};

export type UpdatePropertyResult = {
  property: IBaseProperty;
  jobId: string | null;
};

export type BaseTemplate = "kanban";

/** Kanban column id for cards whose group-by cell is empty. */
export const NO_VALUE_CHOICE_ID = "__no_value";

// ---- Realtime payloads (see apps/server/src/ce/base/realtime/base-ws.service.ts) ----

export type BaseSocketEvent =
  | { operation: "base:subscribed"; pageId: string; schemaVersion: number }
  | { operation: "base:row:created"; pageId: string; row: IBaseRow; requestId?: string | null }
  | {
      operation: "base:row:updated";
      pageId: string;
      rowId: string;
      updatedCells: Record<string, unknown>;
      position?: string;
      requestId?: string | null;
    }
  | { operation: "base:row:deleted"; pageId: string; rowId: string; requestId?: string | null }
  | { operation: "base:rows:deleted"; pageId: string; rowIds: string[]; requestId?: string | null }
  | {
      operation: "base:row:reordered";
      pageId: string;
      rowId: string;
      position: string;
      requestId?: string | null;
    }
  | {
      operation: "base:rows:updated";
      pageId: string;
      rowIds: string[];
      propertyIds: string[];
      requestId?: string | null;
    }
  | {
      operation:
        | "base:property:created"
        | "base:property:updated"
        | "base:property:deleted"
        | "base:property:reordered";
      pageId: string;
      property?: IBaseProperty;
      propertyId?: string;
      requestId?: string | null;
    }
  | {
      operation: "base:view:created" | "base:view:updated" | "base:view:deleted";
      pageId: string;
      view?: IBaseView;
      viewId?: string;
    }
  | { operation: "base:schema:bumped"; pageId: string; schemaVersion: number }
  | {
      operation: "base:formula:recompute:started";
      pageId: string;
      propertyIds: string[];
      jobId: string;
    }
  | {
      operation: "base:formula:recompute:completed";
      pageId: string;
      propertyIds: string[];
      jobId: string;
      processed: number;
      errored: number;
    };
