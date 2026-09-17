import { Text } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import type { UserRef } from "../../types";
import classes from "../../styles/cells.module.css";

type Props = { user: UserRef | undefined; id: string; compact?: boolean };

export function UserChip({ user, id, compact }: Props) {
  const name = user?.name || "Unknown user";
  return (
    <span className={classes.userChip} title={name} data-unknown={!user || undefined}>
      <CustomAvatar
        avatarUrl={user?.avatarUrl ?? undefined}
        name={user?.name || id}
        size={compact ? 18 : 20}
        radius="xl"
      />
      {!compact && (
        <Text component="span" size="sm" truncate>
          {name}
        </Text>
      )}
    </span>
  );
}
