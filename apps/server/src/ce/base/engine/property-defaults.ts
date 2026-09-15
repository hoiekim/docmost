import { generateBaseChoiceId } from '../../../common/helpers/nanoid.utils';
import {
  BasePropertyType,
  Choice,
  SelectTypeOptions,
  TypeOptions,
} from '../types/base.types';

/** Default typeOptions for a freshly created property of the given type. */
export function defaultTypeOptionsFor(type: BasePropertyType): TypeOptions {
  switch (type) {
    case 'select':
    case 'multiSelect':
      return { choices: [], choiceOrder: [] };
    case 'status':
      return defaultStatusTypeOptions();
    case 'number':
      return { format: 'plain', precision: 0 };
    case 'date':
      return { includeTime: false };
    case 'person':
      return { allowMultiple: false };
    default:
      return {};
  }
}

/** Mirrors defaultStatusChoices() in the client choice editor. */
export function defaultStatusChoices(): Choice[] {
  return [
    {
      id: generateBaseChoiceId(),
      name: 'Not started',
      color: 'gray',
      category: 'todo',
    },
    {
      id: generateBaseChoiceId(),
      name: 'In progress',
      color: 'blue',
      category: 'inProgress',
    },
    {
      id: generateBaseChoiceId(),
      name: 'Done',
      color: 'green',
      category: 'complete',
    },
  ];
}

export function defaultStatusTypeOptions(): SelectTypeOptions {
  const choices = defaultStatusChoices();
  return {
    choices,
    choiceOrder: choices.map((c) => c.id),
    defaultValue: choices[0].id,
  };
}

/** Seed layout for a new (or converted) base. */
export const DEFAULT_PRIMARY_NAME = 'Title';
export const DEFAULT_TEXT_NAMES = ['Text 1', 'Text 2'];
export const DEFAULT_STATUS_NAME = 'Status';
export const DEFAULT_TABLE_VIEW_NAME = 'Table';
export const DEFAULT_KANBAN_VIEW_NAME = 'Kanban';
