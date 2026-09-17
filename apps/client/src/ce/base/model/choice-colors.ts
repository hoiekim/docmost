/** Choice colors are Mantine color names so they follow the theme. */
export const CHOICE_COLORS = [
  "gray",
  "red",
  "pink",
  "grape",
  "violet",
  "indigo",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "yellow",
  "orange",
] as const;

export type ChoiceColor = (typeof CHOICE_COLORS)[number];

export function isChoiceColor(value: unknown): value is ChoiceColor {
  return typeof value === "string" && (CHOICE_COLORS as readonly string[]).includes(value);
}

export function normalizeChoiceColor(value: unknown): ChoiceColor {
  return isChoiceColor(value) ? value : "gray";
}

/** Deterministic pick so newly added choices cycle through the palette. */
export function nextChoiceColor(existingCount: number): ChoiceColor {
  const palette = CHOICE_COLORS.filter((c) => c !== "gray");
  return palette[existingCount % palette.length];
}
