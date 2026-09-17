import { z } from 'zod';
import { BASE_PROPERTY_TYPES } from '../types/base.types';

export const basePropertyTypeSchema = z.enum(
  BASE_PROPERTY_TYPES as unknown as [string, ...string[]],
);

export const baseViewTypeSchema = z.enum(['table', 'kanban', 'calendar']);

export const filterOperatorSchema = z.enum([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'ncontains',
  'startsWith',
  'endsWith',
  'isEmpty',
  'isNotEmpty',
  'before',
  'after',
  'onOrBefore',
  'onOrAfter',
  'any',
  'none',
  'all',
  'isWithin',
]);

export const dateFilterAnchorSchema = z.enum([
  'today',
  'tomorrow',
  'yesterday',
  'oneWeekAgo',
  'oneWeekFromNow',
  'oneMonthAgo',
  'oneMonthFromNow',
]);

export const dateFilterRangeSchema = z.enum([
  'pastWeek',
  'pastMonth',
  'pastYear',
  'thisWeek',
  'thisMonth',
  'thisYear',
  'nextWeek',
  'nextMonth',
  'nextYear',
]);

export const dateFilterValueSchema = z.union([
  z.object({ mode: z.literal('exact'), date: z.string().min(1) }),
  z.object({ mode: z.literal('relative'), preset: dateFilterAnchorSchema }),
  z.object({ mode: z.literal('range'), preset: dateFilterRangeSchema }),
]);

export const filterConditionSchema = z.object({
  propertyId: z.string().min(1).max(64),
  op: filterOperatorSchema,
  value: z.unknown().optional(),
});

export type FilterNodeInput =
  | z.infer<typeof filterConditionSchema>
  | { op: 'and' | 'or'; children: FilterNodeInput[] };

export const filterNodeSchema: z.ZodType<FilterNodeInput> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['and', 'or']),
      children: z.array(filterNodeSchema).max(200),
    }),
    filterConditionSchema,
  ]),
);

export const viewSortConfigSchema = z.object({
  propertyId: z.string().min(1).max(64),
  direction: z.enum(['asc', 'desc']),
});

export const sortsSchema = z.array(viewSortConfigSchema).max(10);

export const choiceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  color: z.string().max(32),
  category: z.enum(['todo', 'inProgress', 'complete']).optional(),
});

const idList = z.array(z.string().max(64)).max(500);

export const selectTypeOptionsSchema = z.looseObject({
  choices: z.array(choiceSchema).max(500).default([]),
  choiceOrder: idList.default([]),
  disableColors: z.boolean().optional(),
  defaultValue: z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional(),
});

export const numberTypeOptionsSchema = z.looseObject({
  format: z.enum(['plain', 'currency', 'percent', 'progress']).optional(),
  separators: z.string().max(32).optional(),
  precision: z.number().int().min(0).max(20).optional(),
  currencyCode: z.string().max(8).optional(),
  currencySymbol: z.string().max(8).optional(),
  defaultValue: z.number().nullable().optional(),
});

export const dateTypeOptionsSchema = z.looseObject({
  dateFormat: z.string().max(64).optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  includeTime: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
});

export const textTypeOptionsSchema = z.looseObject({
  richText: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
});

export const checkboxTypeOptionsSchema = z.looseObject({
  defaultValue: z.boolean().optional(),
});

export const personTypeOptionsSchema = z.looseObject({
  allowMultiple: z.boolean().optional(),
  defaultValue: z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional(),
});

export const formulaTypeOptionsSchema = z.looseObject({
  source: z.string().max(10_000),
  ast: z.unknown().optional(),
  resultType: z.enum(['number', 'string', 'boolean', 'date', 'null']).optional(),
  dependencies: z.array(z.string()).optional(),
  astVersion: z.number().int().nonnegative().optional(),
  formatOptions: z.record(z.string(), z.unknown()).optional(),
});

export const genericTypeOptionsSchema = z.record(z.string(), z.unknown());

export function typeOptionsSchemaFor(type: string): z.ZodType<any> {
  switch (type) {
    case 'select':
    case 'status':
    case 'multiSelect':
      return selectTypeOptionsSchema;
    case 'number':
      return numberTypeOptionsSchema;
    case 'date':
      return dateTypeOptionsSchema;
    case 'text':
    case 'longText':
    case 'url':
    case 'email':
      return textTypeOptionsSchema;
    case 'checkbox':
      return checkboxTypeOptionsSchema;
    case 'person':
      return personTypeOptionsSchema;
    case 'formula':
      return formulaTypeOptionsSchema;
    default:
      return genericTypeOptionsSchema;
  }
}

export const viewConfigSchema = z.looseObject({
  sorts: sortsSchema.optional(),
  filter: filterNodeSchema.optional(),
  visiblePropertyIds: idList.optional(),
  hiddenPropertyIds: idList.optional(),
  propertyWidths: z.record(z.string(), z.number().min(1).max(5000)).optional(),
  propertyOrder: idList.optional(),
  groupByPropertyId: z.string().max(64).optional(),
  hiddenChoiceIds: idList.optional(),
  choiceOrder: idList.optional(),
});

/** Same keys as viewConfigSchema, but every key also accepts null (= delete). */
export const viewConfigPatchSchema = z.looseObject({
  sorts: sortsSchema.nullable().optional(),
  filter: filterNodeSchema.nullable().optional(),
  visiblePropertyIds: idList.nullable().optional(),
  hiddenPropertyIds: idList.nullable().optional(),
  propertyWidths: z
    .record(z.string(), z.number().min(1).max(5000))
    .nullable()
    .optional(),
  propertyOrder: idList.nullable().optional(),
  groupByPropertyId: z.string().max(64).nullable().optional(),
  hiddenChoiceIds: idList.nullable().optional(),
  choiceOrder: idList.nullable().optional(),
});

export const fileValueSchema = z.looseObject({
  id: z.string().min(1).max(128),
  fileName: z.string().max(1024),
  mimeType: z.string().max(255).optional(),
  fileSize: z.number().optional(),
  url: z.string().max(2048).optional(),
});
