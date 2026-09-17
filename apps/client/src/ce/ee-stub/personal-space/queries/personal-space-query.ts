import { useQuery, UseQueryResult } from "@tanstack/react-query";

/**
 * Personal spaces are an enterprise feature; CE has none. The caller passes
 * its `Feature.PERSONAL_SPACES` verdict as `enabled`, which is always false
 * on a CE server.
 */
export function usePersonalSpaceQuery(enabled?: boolean): UseQueryResult<any> {
  return useQuery({
    queryKey: ["personal-space"],
    queryFn: async () => null,
    enabled: enabled ?? false,
  });
}
