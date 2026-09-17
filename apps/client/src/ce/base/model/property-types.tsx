import {
  IconAlignJustified,
  IconAlignLeft,
  IconCalendar,
  IconCircleChevronDown,
  IconCircleDotted,
  IconClockEdit,
  IconClockPlus,
  IconFileText,
  IconHash,
  IconLink,
  IconList,
  IconMail,
  IconMathFunction,
  IconPaperclip,
  IconSquareCheck,
  IconUser,
  IconUserEdit,
  type TablerIcon,
} from "@tabler/icons-react";
import type { BasePropertyType, TypeOptions } from "../types";
import { NON_CONVERSION_TARGET_TYPES } from "../types";
import { nextChoiceColor } from "./choice-colors";
import { newChoiceId } from "../ids";

export type PropertyTypeGroup = "basic" | "advanced" | "system";

export type PropertyTypeDescriptor = {
  type: BasePropertyType;
  /** English label; passed through t() by the UI. */
  label: string;
  icon: TablerIcon;
  group: PropertyTypeGroup;
  /** Rows can be sorted by this property. */
  sortable: boolean;
  /** Default typeOptions for a freshly created property. */
  defaultOptions: () => TypeOptions;
};

function defaultStatusOptions(): TypeOptions {
  const choices = [
    { id: newChoiceId(), name: "Not started", color: "gray", category: "todo" },
    { id: newChoiceId(), name: "In progress", color: "blue", category: "inProgress" },
    { id: newChoiceId(), name: "Done", color: "green", category: "complete" },
  ];
  return {
    choices,
    choiceOrder: choices.map((c) => c.id),
    defaultValue: choices[0].id,
  };
}

const DESCRIPTORS: Record<BasePropertyType, PropertyTypeDescriptor> = {
  text: {
    type: "text",
    label: "Text",
    icon: IconAlignLeft,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({}),
  },
  longText: {
    type: "longText",
    label: "Long text",
    icon: IconAlignJustified,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({}),
  },
  number: {
    type: "number",
    label: "Number",
    icon: IconHash,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({ format: "plain" }),
  },
  select: {
    type: "select",
    label: "Select",
    icon: IconCircleChevronDown,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({ choices: [], choiceOrder: [] }),
  },
  status: {
    type: "status",
    label: "Status",
    icon: IconCircleDotted,
    group: "basic",
    sortable: true,
    defaultOptions: defaultStatusOptions,
  },
  multiSelect: {
    type: "multiSelect",
    label: "Multi-select",
    icon: IconList,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({ choices: [], choiceOrder: [] }),
  },
  date: {
    type: "date",
    label: "Date",
    icon: IconCalendar,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({ includeTime: false }),
  },
  checkbox: {
    type: "checkbox",
    label: "Checkbox",
    icon: IconSquareCheck,
    group: "basic",
    sortable: true,
    defaultOptions: () => ({}),
  },
  person: {
    type: "person",
    label: "Person",
    icon: IconUser,
    group: "advanced",
    sortable: true,
    defaultOptions: () => ({ allowMultiple: false }),
  },
  file: {
    type: "file",
    label: "Files",
    icon: IconPaperclip,
    group: "advanced",
    sortable: false,
    defaultOptions: () => ({}),
  },
  page: {
    type: "page",
    label: "Page",
    icon: IconFileText,
    group: "advanced",
    sortable: true,
    defaultOptions: () => ({}),
  },
  url: {
    type: "url",
    label: "URL",
    icon: IconLink,
    group: "advanced",
    sortable: true,
    defaultOptions: () => ({}),
  },
  email: {
    type: "email",
    label: "Email",
    icon: IconMail,
    group: "advanced",
    sortable: true,
    defaultOptions: () => ({}),
  },
  formula: {
    type: "formula",
    label: "Formula",
    icon: IconMathFunction,
    group: "advanced",
    sortable: true,
    defaultOptions: () => ({ source: "" }),
  },
  createdAt: {
    type: "createdAt",
    label: "Created time",
    icon: IconClockPlus,
    group: "system",
    sortable: true,
    defaultOptions: () => ({}),
  },
  lastEditedAt: {
    type: "lastEditedAt",
    label: "Last edited time",
    icon: IconClockEdit,
    group: "system",
    sortable: true,
    defaultOptions: () => ({}),
  },
  lastEditedBy: {
    type: "lastEditedBy",
    label: "Last edited by",
    icon: IconUserEdit,
    group: "system",
    sortable: true,
    defaultOptions: () => ({}),
  },
};

export function describeType(type: BasePropertyType): PropertyTypeDescriptor {
  return DESCRIPTORS[type] ?? DESCRIPTORS.text;
}

export const PROPERTY_TYPE_LIST: PropertyTypeDescriptor[] = Object.values(DESCRIPTORS);

/** Types offered when the user changes an existing property's type. */
export function conversionTargets(): PropertyTypeDescriptor[] {
  return PROPERTY_TYPE_LIST.filter((d) => !NON_CONVERSION_TARGET_TYPES.includes(d.type));
}

export function newChoice(name: string, existingCount: number) {
  return { id: newChoiceId(), name, color: nextChoiceColor(existingCount) };
}
