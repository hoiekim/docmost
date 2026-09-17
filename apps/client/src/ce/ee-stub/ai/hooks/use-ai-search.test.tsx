import { describe, expect, it } from "vitest";
import { useState } from "react";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAiSearch } from "./use-ai-search";

/**
 * `search-spotlight.tsx` destructures this hook and depends on the result:
 *
 *   useEffect(() => { clearStreaming(); resetAiMutation(); },
 *             [query, clearStreaming, resetAiMutation]);
 *
 * so anything it hands back has to keep its identity across renders. A fresh
 * closure per render re-runs that effect on every render, and the `reset()`
 * inside it renders again — a loop that stalls the whole app for seconds,
 * because the spotlight lives under `<Layout>`.
 */
describe("useAiSearch", () => {
  it("returns the same references across renders", () => {
    const seen: Array<Record<string, unknown>> = [];
    let rerender: () => void;

    function Probe() {
      const [, setTick] = useState(0);
      rerender = () => setTick((n) => n + 1);
      const { clearStreaming, streamingSources, reset } = useAiSearch();
      seen.push({ clearStreaming, streamingSources, reset });
      return null;
    }

    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
    act(() => rerender());
    act(() => rerender());

    expect(seen.length).toBeGreaterThanOrEqual(3);
    for (const render of seen.slice(1)) {
      expect(render.clearStreaming).toBe(seen[0].clearStreaming);
      expect(render.streamingSources).toBe(seen[0].streamingSources);
      expect(render.reset).toBe(seen[0].reset);
    }
  });
});
