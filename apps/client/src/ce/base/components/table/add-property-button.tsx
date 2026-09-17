import { useState } from "react";
import { ActionIcon, Modal, Tooltip } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PropertyEditor } from "../property/property-editor";
import classes from "../../styles/table.module.css";

/** The "+" header cell that creates a new property. */
export function AddPropertyButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className={classes.addColumnCell} data-open={open || undefined}>
      <Tooltip label={t("Add property")} openDelay={400}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={t("Add property")}
          onClick={() => setOpen(true)}
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={t("New property")}
        size={380}
        centered
        withinPortal
        trapFocus
        closeOnEscape
      >
        {open && <PropertyEditor onClose={() => setOpen(false)} />}
      </Modal>
    </div>
  );
}
