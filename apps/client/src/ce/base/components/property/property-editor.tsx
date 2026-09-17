import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Group, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { BasePropertyType, IBaseProperty, TypeOptions } from "../../types";
import { SYSTEM_PROPERTY_TYPES } from "../../types";
import { conversionWarning } from "../../model/conversion";
import type { FormulaCheck } from "../../model/formula";
import { describeType } from "../../model/property-types";
import {
  useCreatePropertyMutation,
  useDeletePropertyMutation,
  useUpdatePropertyMutation,
} from "../../queries/property-query";
import { useBase } from "../base-context";
import { PropertyTypePicker } from "./type-picker";
import { TypeOptionsEditor } from "./type-options-editor";
import classes from "../../styles/property.module.css";

type Props = {
  /** Omit to create a new property. */
  property?: IBaseProperty;
  onClose: () => void;
};

/**
 * Create or edit a property: name, type (with conversion warning) and the
 * type-specific options. Rendered inside a popover by the grid header.
 */
export function PropertyEditor({ property, onClose }: Props) {
  const { t } = useTranslation();
  const { pageId, properties } = useBase();
  const createProperty = useCreatePropertyMutation(pageId);
  const updateProperty = useUpdatePropertyMutation(pageId);
  const deleteProperty = useDeletePropertyMutation(pageId);

  const [name, setName] = useState(property?.name ?? "");
  const [type, setType] = useState<BasePropertyType>(property?.type ?? "text");
  const [options, setOptions] = useState<TypeOptions>(
    () => property?.typeOptions ?? describeType("text").defaultOptions(),
  );
  const [formulaCheck, setFormulaCheck] = useState<FormulaCheck | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!property) nameRef.current?.focus();
  }, [property]);

  const existing = !!property;
  const typeLocked =
    existing &&
    (property.isPrimary ||
      property.type === "formula" ||
      SYSTEM_PROPERTY_TYPES.includes(property.type) ||
      !!property.pendingType);
  const typeChanged = existing && type !== property.type;
  const warning = typeChanged ? conversionWarning(property.type, type) : null;

  const changeType = (next: BasePropertyType) => {
    setType(next);
    setFormulaCheck(null);
    // Reuse the saved options when returning to the original type.
    setOptions(existing && next === property.type ? property.typeOptions : describeType(next).defaultOptions());
  };

  const duplicateName = useMemo(() => {
    const n = name.trim().toLowerCase();
    return properties.some((p) => p.id !== property?.id && p.name.trim().toLowerCase() === n);
  }, [name, properties, property?.id]);

  const formulaInvalid = type === "formula" && (!formulaCheck || !formulaCheck.ok);
  const canSave = name.trim().length > 0 && !duplicateName && !formulaInvalid;
  const saving = createProperty.isPending || updateProperty.isPending;

  const save = async () => {
    if (!canSave) return;
    const trimmed = name.trim();
    try {
      if (!existing) {
        await createProperty.mutateAsync({ name: trimmed, type, typeOptions: options });
      } else {
        const input: { propertyId: string; name?: string; type?: string; typeOptions?: TypeOptions } = {
          propertyId: property.id,
        };
        if (trimmed !== property.name) input.name = trimmed;
        if (typeChanged) input.type = type;
        if (typeChanged || JSON.stringify(options) !== JSON.stringify(property.typeOptions)) {
          input.typeOptions = options;
        }
        if (input.name === undefined && input.type === undefined && input.typeOptions === undefined) {
          onClose();
          return;
        }
        await updateProperty.mutateAsync(input);
      }
      onClose();
    } catch {
      // the mutation showed a notification
    }
  };

  const confirmDelete = () => {
    if (!property) return;
    modals.openConfirmModal({
      title: t("Delete property"),
      children: t('Delete "{{name}}" and all of its values? This cannot be undone.', { name: property.name }),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteProperty.mutate({ propertyId: property.id });
        onClose();
      },
    });
  };

  return (
    <div
      className={classes.editor}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <TextInput
        ref={nameRef}
        size="xs"
        label={t("Name")}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        error={duplicateName ? t("A property with this name already exists") : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && type !== "formula") {
            e.preventDefault();
            void save();
          }
        }}
      />
      <PropertyTypePicker value={type} onChange={changeType} existing={existing} disabled={typeLocked} />
      {typeLocked && existing && property.isPrimary && (
        <Text size="xs" c="dimmed">
          {t("The title property is always text.")}
        </Text>
      )}
      {warning && (
        <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={14} />} p="xs">
          <Text size="xs">{t(warning)}</Text>
        </Alert>
      )}
      <TypeOptionsEditor
        type={type}
        options={options}
        onChange={setOptions}
        properties={properties}
        selfId={property?.id ?? null}
        onFormulaCheck={setFormulaCheck}
      />
      <Group justify="space-between" mt={4}>
        {existing && !property.isPrimary ? (
          <Button size="compact-xs" variant="subtle" color="red" onClick={confirmDelete}>
            {t("Delete")}
          </Button>
        ) : (
          <span />
        )}
        <Group gap={6}>
          <Button size="compact-xs" variant="subtle" color="gray" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button size="compact-xs" onClick={() => void save()} disabled={!canSave} loading={saving}>
            {existing ? t("Save") : t("Create")}
          </Button>
        </Group>
      </Group>
    </div>
  );
}
