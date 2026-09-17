import { describe, expect, it } from "vitest";
import type { IBaseProperty } from "../types";
import {
  applyConfigPatch,
  columnWidth,
  kanbanCardProperties,
  viewOrderedProperties,
  visibleTableProperties,
} from "./view-config";

function prop(id: string, position: string, extra: Partial<IBaseProperty> = {}): IBaseProperty {
  return {
    id,
    pageId: "p",
    name: id,
    type: "text",
    position,
    typeOptions: {},
    isPrimary: false,
    workspaceId: "w",
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const base = {
  properties: [prop("c", "a2"), prop("title", "a0", { isPrimary: true }), prop("b", "a1"), prop("d", "a3")],
};

describe("viewOrderedProperties", () => {
  it("falls back to global position order with the primary first", () => {
    expect(viewOrderedProperties(base, undefined).map((p) => p.id)).toEqual(["title", "b", "c", "d"]);
  });

  it("honours propertyOrder, ignores unknown ids and appends the rest", () => {
    const out = viewOrderedProperties(base, { propertyOrder: ["d", "zzz", "b"] });
    expect(out.map((p) => p.id)).toEqual(["title", "d", "b", "c"]);
  });

  it("never moves the primary away from the front", () => {
    const out = viewOrderedProperties(base, { propertyOrder: ["c", "title"] });
    expect(out[0].id).toBe("title");
  });
});

describe("visibleTableProperties / kanbanCardProperties", () => {
  it("hides listed properties but never the primary", () => {
    const out = visibleTableProperties(base, { hiddenPropertyIds: ["title", "c"] });
    expect(out.map((p) => p.id)).toEqual(["title", "b", "d"]);
  });

  it("shows only listed card properties, excluding the primary", () => {
    const out = kanbanCardProperties(base, { visiblePropertyIds: ["title", "d"] });
    expect(out.map((p) => p.id)).toEqual(["d"]);
  });
});

describe("columnWidth", () => {
  it("uses configured widths within bounds and sensible defaults", () => {
    const p = prop("x", "a0");
    expect(columnWidth(p, undefined)).toBe(180);
    expect(columnWidth(prop("t", "a0", { isPrimary: true }), undefined)).toBe(260);
    expect(columnWidth(p, { propertyWidths: { x: 300 } })).toBe(300);
    expect(columnWidth(p, { propertyWidths: { x: 5 } })).toBe(80);
  });
});

describe("applyConfigPatch", () => {
  it("replaces, keeps and deletes keys like the server", () => {
    const out = applyConfigPatch(
      { sorts: [{ propertyId: "a", direction: "asc" }], hiddenPropertyIds: ["b"], groupByPropertyId: "g" },
      { sorts: null, hiddenPropertyIds: ["c"], propertyOrder: undefined },
    );
    expect(out).toEqual({ hiddenPropertyIds: ["c"], groupByPropertyId: "g" });
  });
});
