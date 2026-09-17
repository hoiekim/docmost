/**
 * Server-side mirror of apps/client/src/ce/base/types.ts.
 * Keep the two in sync when upstream changes the client contract.
 */
import type {
  BaseProperty,
  BaseRow,
  BaseView,
} from '@docmost/db/types/entity.types';

export type BasePropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'status'
  | 'multiSelect'
  | 'date'
  | 'person'
  | 'file'
  | 'page'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'createdAt'
  | 'lastEditedAt'
  | 'lastEditedBy'
  | 'formula'
  | 'longText';

export const BASE_PROPERTY_TYPES: readonly BasePropertyType[] = [
  'text',
  'number',
  'select',
  'status',
  'multiSelect',
  'date',
  'person',
  'file',
  'page',
  'checkbox',
  'url',
  'email',
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'formula',
  'longText',
];

/** Properties whose value is derived from row columns, never stored in cells. */
export const SYSTEM_PROPERTY_TYPES: readonly BasePropertyType[] = [
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
];

/** Types a user cannot convert an existing property into. */
export const NON_CONVERSION_TARGET_TYPES: readonly BasePropertyType[] = [
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'formula',
];

export type BaseViewType = 'table' | 'kanban' | 'calendar';

export type Choice = {
  id: string;
  name: string;
  color: string;
  category?: 'todo' | 'inProgress' | 'complete';
};

export type SelectTypeOptions = {
  choices: Choice[];
  choiceOrder: string[];
  disableColors?: boolean;
  defaultValue?: string | string[] | null;
};

export type NumberTypeOptions = {
  format?: 'plain' | 'currency' | 'percent' | 'progress';
  separators?: string;
  precision?: number;
  currencyCode?: string;
  currencySymbol?: string;
  defaultValue?: number | null;
};

export type DateTypeOptions = {
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  includeTime?: boolean;
  defaultValue?: string | null;
};

export type PersonTypeOptions = {
  allowMultiple?: boolean;
  defaultValue?: string | string[] | null;
};

export type FormulaTypeOptions = {
  source: string;
  ast: unknown;
  resultType: 'number' | 'string' | 'boolean' | 'date' | 'null';
  dependencies: string[];
  /** AST_VERSION the `ast` was compiled at; older values are recompiled. */
  astVersion: number;
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

export type ViewSortConfig = { propertyId: string; direction: 'asc' | 'desc' };

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'ncontains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  | 'any'
  | 'none'
  | 'all'
  | 'isWithin';

export type DateFilterAnchor =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'oneWeekAgo'
  | 'oneWeekFromNow'
  | 'oneMonthAgo'
  | 'oneMonthFromNow';

export type DateFilterRange =
  | 'pastWeek'
  | 'pastMonth'
  | 'pastYear'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'nextWeek'
  | 'nextMonth'
  | 'nextYear';

export type DateFilterValue =
  | { mode: 'exact'; date: string }
  | { mode: 'relative'; preset: DateFilterAnchor }
  | { mode: 'range'; preset: DateFilterRange };

export type FilterCondition = {
  propertyId: string;
  op: FilterOperator;
  value?: unknown;
};
export type FilterGroup = {
  op: 'and' | 'or';
  children: Array<FilterCondition | FilterGroup>;
};
export type FilterNode = FilterCondition | FilterGroup;

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filter?: FilterGroup;
  visiblePropertyIds?: string[];
  hiddenPropertyIds?: string[];
  propertyWidths?: Record<string, number>;
  propertyOrder?: string[];
  groupByPropertyId?: string;
  hiddenChoiceIds?: string[];
  choiceOrder?: string[];
};

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
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type IBaseRow = {
  id: string;
  pageId: string;
  cells: Record<string, unknown>;
  position: string;
  creatorId: string | null;
  lastUpdatedById: string | null;
  workspaceId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
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
  createdAt: Date | string;
  updatedAt: Date | string;
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
  createdAt: Date | string;
  updatedAt: Date | string;
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

export const NO_VALUE_CHOICE_ID = '__no_value';

export type BaseTemplate = 'kanban';

/** Row-list query after zod validation. */
export type RowListQuery = {
  filter?: FilterNode | null;
  sorts?: ViewSortConfig[];
  cursor?: string;
  limit: number;
};

export function toIBaseProperty(p: BaseProperty): IBaseProperty {
  return {
    id: p.id,
    pageId: p.pageId,
    name: p.name,
    type: p.type as BasePropertyType,
    position: p.position,
    typeOptions: (p.typeOptions ?? {}) as TypeOptions,
    pendingType: (p.pendingType as BasePropertyType | null) ?? null,
    pendingTypeOptions: (p.pendingTypeOptions as TypeOptions | null) ?? null,
    isPrimary: p.isPrimary,
    workspaceId: p.workspaceId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function toIBaseRow(r: BaseRow): IBaseRow {
  return {
    id: r.id,
    pageId: r.pageId,
    cells: (r.cells ?? {}) as Record<string, unknown>,
    position: r.position,
    creatorId: r.creatorId,
    lastUpdatedById: r.lastUpdatedById,
    workspaceId: r.workspaceId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function toIBaseView(v: BaseView): IBaseView {
  return {
    id: v.id,
    pageId: v.pageId,
    name: v.name,
    type: v.type as BaseViewType,
    config: (v.config ?? {}) as ViewConfig,
    position: v.position,
    workspaceId: v.workspaceId,
    creatorId: v.creatorId,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

// ---- Domain event payloads (EventEmitter2 → BaseWsService → socket) ----

export type BaseRowCreatedEvent = {
  pageId: string;
  row: IBaseRow;
  requestId?: string | null;
};
export type BaseRowUpdatedEvent = {
  pageId: string;
  rowId: string;
  updatedCells: Record<string, unknown>;
  position?: string;
  requestId?: string | null;
};
export type BaseRowDeletedEvent = {
  pageId: string;
  rowId: string;
  requestId?: string | null;
};
export type BaseRowsDeletedEvent = {
  pageId: string;
  rowIds: string[];
  requestId?: string | null;
};
export type BaseRowReorderedEvent = {
  pageId: string;
  rowId: string;
  position: string;
  requestId?: string | null;
};
export type BaseRowsUpdatedEvent = {
  pageId: string;
  rowIds: string[];
  propertyIds: string[];
  requestId?: string | null;
};
export type BasePropertyEvent = {
  pageId: string;
  property?: IBaseProperty;
  propertyId?: string;
  requestId?: string | null;
};
export type BaseViewEvent = {
  pageId: string;
  view?: IBaseView;
  viewId?: string;
};
export type BaseSchemaBumpedEvent = { pageId: string; schemaVersion: number };
export type BaseFormulaRecomputeStartedEvent = {
  pageId: string;
  propertyIds: string[];
  jobId: string;
};
export type BaseFormulaRecomputeCompletedEvent = {
  pageId: string;
  propertyIds: string[];
  jobId: string;
  processed: number;
  errored: number;
};
