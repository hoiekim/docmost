import { BasePropertyType } from '../types/base.types';

export type FormulaResultType = 'number' | 'string' | 'boolean' | 'date' | 'null';

/**
 * How a property participates in formula type checking. Must match
 * propertyResultType() in apps/client/src/ce/base/model/formula.ts
 * so client-side validation and server-side validation agree.
 */
export function projectResultType(
  type: BasePropertyType | string,
  typeOptions?: unknown,
): FormulaResultType {
  if (type === 'number') return 'number';
  if (type === 'text' || type === 'url' || type === 'email' || type === 'longText') {
    return 'string';
  }
  if (type === 'checkbox') return 'boolean';
  if (type === 'date' || type === 'createdAt' || type === 'lastEditedAt') {
    return 'date';
  }
  if (type === 'formula') {
    const rt = (typeOptions as any)?.resultType;
    if (rt === 'number' || rt === 'string' || rt === 'boolean' || rt === 'date') {
      return rt;
    }
  }
  return 'null';
}
