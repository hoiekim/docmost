import { Button, Group, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "../../styles/table.module.css";

type Props = {
  count: number;
  editable: boolean;
  onClear: () => void;
  onDelete: () => void;
};

export function SelectionBar({ count, editable, onClear, onDelete }: Props) {
  const { t } = useTranslation();
  if (count === 0) return null;

  const confirm = () => {
    modals.openConfirmModal({
      title: t("Delete rows"),
      children: t("Delete {{count}} selected rows?", { count }),
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: onDelete,
    });
  };

  return (
    <Group className={classes.selectionBar} gap="xs" wrap="nowrap">
      <Text size="sm" fw={500}>
        {t("{{count}} selected", { count })}
      </Text>
      {editable && (
        <Button size="compact-xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={confirm}>
          {t("Delete")}
        </Button>
      )}
      <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconX size={14} />} onClick={onClear}>
        {t("Clear")}
      </Button>
    </Group>
  );
}
