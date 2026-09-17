import { useMutation, UseMutationResult } from "@tanstack/react-query";

/**
 * Comment resolution is gated on Feature.COMMENT_RESOLUTION, which a CE
 * server does not report, so the callers never reach this mutation.
 */
export function useResolveCommentMutation(): UseMutationResult<
  any,
  Error,
  any
> {
  return useMutation({
    mutationFn: async () => {
      throw new Error("Comment resolution is not available in this edition");
    },
  });
}
