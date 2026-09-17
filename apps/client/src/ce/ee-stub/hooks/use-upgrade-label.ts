import { useTranslation } from "react-i18next";

/**
 * Tooltip text shown next to a feature the workspace is not entitled to. The
 * open-source callers use it as a plain string, always in that "you can't use
 * this" position. CE implements a fixed set of features and has no tiers to
 * upgrade between, so it says so rather than offering an upgrade.
 */
export function useUpgradeLabel(): string {
  const { t } = useTranslation();
  return t("Not available in this edition");
}
