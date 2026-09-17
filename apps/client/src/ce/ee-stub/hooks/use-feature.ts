import { useAtom } from "jotai";
import { entitlementAtom } from "../entitlement/entitlement-atom";

/**
 * True when the server reported this feature for the workspace. The check is
 * the one the open-source `components/settings/settings-sidebar.tsx` performs
 * inline on the same atom:
 *
 *   entitlements?.features?.includes(f) ?? false
 */
export const useHasFeature = (feature: string): boolean => {
  const [entitlements] = useAtom(entitlementAtom);
  return entitlements?.features?.includes(feature) ?? false;
};
