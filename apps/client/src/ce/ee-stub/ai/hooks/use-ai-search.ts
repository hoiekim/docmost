import { useMutation } from "@tanstack/react-query";

/**
 * Module-level, so every call returns the *same* references. The caller puts
 * `clearStreaming` in a `useEffect` dependency array
 * (`search-spotlight.tsx`: `[query, clearStreaming, resetAiMutation]`), and
 * that effect calls the mutation's `reset()`. A fresh closure per render makes
 * the effect re-run on every render and re-render on every run — a loop that
 * re-renders the whole app under `<Layout>` a few hundred times before it
 * settles, which is seconds of blank page on every navigation.
 */
const NO_SOURCES: any[] = [];
const noop = () => {};

/**
 * AI answers over search. CE implements no AI, and the caller
 * (`features/search/components/search-spotlight.tsx`) only reaches AI mode
 * behind Feature.AI, which a CE server does not report. The shape below is
 * the one that call site destructures.
 */
export function useAiSearch(): any {
  const mutation = useMutation({
    mutationFn: async () => {
      throw new Error("AI search is not available in this edition");
    },
  });

  return {
    ...mutation,
    streamingAnswer: "",
    streamingSources: NO_SOURCES,
    clearStreaming: noop,
  };
}
