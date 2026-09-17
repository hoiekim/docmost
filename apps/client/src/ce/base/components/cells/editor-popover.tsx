import { Popover } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "../../styles/cells.module.css";

type Props = {
  opened: boolean;
  onClose: () => void;
  target: ReactNode;
  children: ReactNode;
  width?: number;
};

/**
 * Picker container used by popover-style cell editors. Closes on outside
 * click and Escape; the host treats close as "done" (onCancel) because
 * pickers persist each change immediately via onChange.
 */
export function EditorPopover({ opened, onClose, target, children, width = 280 }: Props) {
  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) onClose();
      }}
      position="bottom-start"
      width={width}
      shadow="md"
      withinPortal
      trapFocus
      returnFocus={false}
      closeOnEscape
      offset={2}
    >
      <Popover.Target>
        <div className={classes.popoverTarget}>{target}</div>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onKeyDown={(e) => {
          // Keep grid navigation keys inside the picker.
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Popover.Dropdown>
    </Popover>
  );
}
