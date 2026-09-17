import { Group, Select, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { BasePropertyType } from "../../types";
import { conversionTargets, describeType, PROPERTY_TYPE_LIST, type PropertyTypeDescriptor } from "../../model/property-types";

type Props = {
  value: BasePropertyType;
  onChange: (type: BasePropertyType) => void;
  /** Editing an existing property: only conversion targets are offered. */
  existing: boolean;
  disabled?: boolean;
};

const GROUP_LABELS = { basic: "Basic", advanced: "Advanced", system: "System" } as const;

export function PropertyTypePicker({ value, onChange, existing, disabled }: Props) {
  const { t } = useTranslation();
  const list: PropertyTypeDescriptor[] = existing ? conversionTargets() : PROPERTY_TYPE_LIST;
  // Keep the current type selectable even when it is not a conversion target.
  const withCurrent = list.some((d) => d.type === value) ? list : [describeType(value), ...list];
  const groups = (["basic", "advanced", "system"] as const)
    .map((g) => ({
      group: t(GROUP_LABELS[g]),
      items: withCurrent.filter((d) => d.group === g).map((d) => ({ value: d.type, label: t(d.label) })),
    }))
    .filter((g) => g.items.length > 0);

  const Icon = describeType(value).icon;

  return (
    <Select
      label={t("Type")}
      size="xs"
      data={groups}
      value={value}
      onChange={(v) => v && onChange(v as BasePropertyType)}
      disabled={disabled}
      allowDeselect={false}
      leftSection={<Icon size={14} />}
      comboboxProps={{ withinPortal: true, zIndex: 400 }}
      renderOption={({ option }) => {
        const d = describeType(option.value as BasePropertyType);
        const OptIcon = d.icon;
        return (
          <Group gap={8} wrap="nowrap">
            <OptIcon size={14} />
            <Text size="sm">{option.label}</Text>
          </Group>
        );
      }}
    />
  );
}
