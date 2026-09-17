import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { getEntitlements } from "./entitlement-service";
import type { Entitlements } from "./entitlement.types";

/**
 * Not a no-op: CE serves its own entitlements (see
 * `apps/server/src/ce/licence`), and this is what unlocks bases. Called once
 * from `features/user/user-provider.tsx`, which pushes the result into
 * `entitlementAtom`.
 */
export function useEntitlements(): UseQueryResult<Entitlements> {
  return useQuery({
    queryKey: ["entitlements"],
    queryFn: getEntitlements,
    staleTime: 5 * 60 * 1000,
  });
}
