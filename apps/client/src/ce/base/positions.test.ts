import { describe, expect, it } from "vitest";
import { moveInList, positionAtIndex, positionBetween, sortByPosition } from "./positions";

describe("positions", () => {
  it("generates keys that sort between their neighbours", () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    const mid = positionBetween(a, b);
    expect(sortByPosition([{ position: b }, { position: mid }, { position: a }]).map((x) => x.position)).toEqual([
      a,
      mid,
      b,
    ]);
  });

  it("places an item at an index of an ordered list", () => {
    const a = positionBetween(null, null);
    const b = positionBetween(a, null);
    const first = positionAtIndex([{ position: a }, { position: b }], 0);
    const last = positionAtIndex([{ position: a }, { position: b }], 2);
    expect(first < a).toBe(true);
    expect(last > b).toBe(true);
  });

  it("moves ids before/after a target", () => {
    expect(moveInList(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
    expect(moveInList(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"]);
    expect(moveInList(["a", "b"], "z", "b", "before")).toEqual(["a", "z", "b"]);
    expect(moveInList(["a", "b"], "a", "missing", "before")).toEqual(["b", "a"]);
  });
});
