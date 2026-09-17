import { describe, expect, it } from "vitest";
import type { IBaseProperty } from "../types";
import {
  columnKind,
  compactFilter,
  countConditions,
  filterValueKind,
  isConditionComplete,
  operatorsFor,
} from "./filters";

function prop(partial: Partial<IBaseProperty> & Pick<IBaseProperty, "id" | "type">): IBaseProperty {
  return {
    pageId: "p",
    name: partial.id,
    position: "a0",
    typeOptions: {},
    isPrimary: false,
    workspaceId: "w",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("columnKind", () => {
  it("maps types the same way the server does", () => {
    expect(columnKind(prop({ id: "a", type: "number" }))).toBe("number");
    expect(columnKind(prop({ id: "a", type: "date" }))).toBe("timestamp");
    expect(columnKind(prop({ id: "a", type: "createdAt" }))).toBe("timestamp");
    expect(columnKind(prop({ id: "a", type: "checkbox" }))).toBe("bool");
    expect(columnKind(prop({ id: "a", type: "multiSelect" }))).toBe("array");
    expect(columnKind(prop({ id: "a", type: "person" }))).toBe("text");
    expect(columnKind(prop({ id: "a", type: "person", typeOptions: { allowMultiple: true } }))).toBe("array");
    expect(columnKind(prop({ id: "a", type: "formula", typeOptions: { resultType: "boolean" } }))).toBe("bool");
    expect(columnKind(prop({ id: "a", type: "text" }))).toBe("text");
  });
});

describe("operatorsFor / filterValueKind", () => {
  it("offers choice operators for select and picks the choices input", () => {
    const p = prop({ id: "s", type: "select" });
    expect(operatorsFor(p)).toEqual(["any", "none", "isEmpty", "isNotEmpty"]);
    expect(filterValueKind(p, "any")).toBe("choices");
    expect(filterValueKind(p, "isEmpty")).toBe("none");
  });

  it("offers date operators and the date input for timestamps", () => {
    const p = prop({ id: "d", type: "lastEditedAt" });
    expect(operatorsFor(p)).toContain("isWithin");
    expect(filterValueKind(p, "before")).toBe("date");
  });

  it("uses the formula result type", () => {
    const p = prop({ id: "f", type: "formula", typeOptions: { resultType: "number" } });
    expect(operatorsFor(p)).toContain("gt");
    expect(filterValueKind(p, "gt")).toBe("number");
  });
});

describe("compactFilter", () => {
  const text = prop({ id: "t", type: "text" });
  const num = prop({ id: "n", type: "number" });
  const propsById = new Map([[text.id, text], [num.id, num]]);

  it("drops incomplete conditions and returns null when nothing is left", () => {
    expect(
      compactFilter({ op: "and", children: [{ propertyId: "n", op: "gt", value: undefined }] }, propsById),
    ).toBeNull();
  });

  it("keeps complete conditions and valueless operators", () => {
    const out = compactFilter(
      {
        op: "or",
        children: [
          { propertyId: "t", op: "isEmpty" },
          { propertyId: "n", op: "gt", value: 3 },
          { propertyId: "missing", op: "eq", value: "x" },
        ],
      },
      propsById,
    );
    expect(out).toEqual({
      op: "or",
      children: [
        { propertyId: "t", op: "isEmpty" },
        { propertyId: "n", op: "gt", value: 3 },
      ],
    });
  });

  it("recurses into nested groups", () => {
    const out = compactFilter(
      {
        op: "and",
        children: [
          { op: "or", children: [{ propertyId: "n", op: "lt", value: "" }] },
          { propertyId: "t", op: "contains", value: "" },
        ],
      },
      propsById,
    );
    // An empty text "contains" is still a valid (if pointless) condition.
    expect(out).toEqual({ op: "and", children: [{ propertyId: "t", op: "contains", value: "" }] });
  });

  it("counts conditions across groups", () => {
    expect(
      countConditions({
        op: "and",
        children: [{ propertyId: "t", op: "isEmpty" }, { op: "or", children: [{ propertyId: "n", op: "eq", value: 1 }] }],
      }),
    ).toBe(2);
  });

  it("treats a boolean condition without a value as complete", () => {
    expect(isConditionComplete({ propertyId: "c", op: "eq" }, prop({ id: "c", type: "checkbox" }))).toBe(true);
  });
});
