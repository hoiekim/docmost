import { Badge } from "@mantine/core";
import type { Choice } from "../../types";
import { normalizeChoiceColor } from "../../model/choice-colors";
import classes from "../../styles/cells.module.css";

type Props = {
  choice: Choice;
  disableColors?: boolean;
  size?: "xs" | "sm" | "md";
};

export function ChoiceBadge({ choice, disableColors, size = "sm" }: Props) {
  const color = disableColors ? "gray" : normalizeChoiceColor(choice.color);
  return (
    <Badge
      variant="light"
      color={color}
      size={size}
      radius="sm"
      className={classes.choiceBadge}
      title={choice.name}
      styles={{ label: { textTransform: "none", fontWeight: 500 } }}
    >
      {choice.name || " "}
    </Badge>
  );
}
