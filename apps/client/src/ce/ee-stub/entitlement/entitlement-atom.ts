import { atomWithStorage } from "jotai/utils";
import type { Entitlements } from "./entitlement.types";

/**
 * What the server last reported for this workspace. `user-provider.tsx` fills
 * it from `useEntitlements()`; `settings-sidebar.tsx` and `useHasFeature` read
 * it. Persisted so a reload does not briefly hide entitled features before the
 * query resolves.
 */
export const entitlementAtom = atomWithStorage<Entitlements | null>(
  "entitlements",
  null,
);
