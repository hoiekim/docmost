import { Button, Group, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useBase } from "../base-context";
import classes from "../../styles/toolbar.module.css";

/** Viewers' filter/sort changes live only in this browser tab. */
export function DraftBanner() {
  const { t } = useTranslation();
  const { discardDraft } = useBase();
  return (
    <Group className={classes.draftBanner} gap="xs" wrap="nowrap">
      <IconInfoCircle size={14} />
      <Text size="xs" style={{ flex: 1 }}>
        {t("You are viewing this base with temporary filters and sorting. Only you can see these changes.")}
      </Text>
      <Button size="compact-xs" variant="subtle" onClick={discardDraft}>
        {t("Reset")}
      </Button>
    </Group>
  );
}
