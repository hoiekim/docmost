import { describe, expect, it } from "vitest";
import type { IBaseProperty } from "../types";
import { cellToText, formatDateValue, formatNumberValue, parseDateValue } from "./cell-format";

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

describe("formatNumberValue", () => {
  it("formats plain, percent, progress and currency", () => {
    expect(formatNumberValue(1234.5, { format: "plain", precision: 1 })).toBe("1,234.5");
    expect(formatNumberValue(12, { format: "percent", precision: 0 })).toBe("12%");
    expect(formatNumberValue(150, { format: "progress" })).toBe("100%");
    expect(formatNumberValue(9.5, { format: "currency", currencyCode: "USD" })).toBe("$9.50");
    expect(formatNumberValue("abc", {})).toBe("");
    expect(formatNumberValue(null, {})).toBe("");
  });
});

describe("dates", () => {
  it("reads a date-only value as a calendar day, not a shifted instant", () => {
    const d = parseDateValue("2026-09-15");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(8);
    expect(d?.getDate()).toBe(15);
    expect(formatDateValue("2026-09-15", { dateFormat: "yyyy-MM-dd" })).toBe("2026-09-15");
  });

  it("appends the time when the property includes it", () => {
    const iso = new Date(2026, 8, 15, 14, 5).toISOString();
    expect(formatDateValue(iso, { includeTime: true, timeFormat: "24h", dateFormat: "yyyy-MM-dd" })).toBe(
      "2026-09-15 14:05",
    );
  });

  it("returns empty for garbage", () => {
    expect(formatDateValue("not a date", {})).toBe("");
  });
});

describe("cellToText", () => {
  it("resolves choices, people, pages and files", () => {
    const select = prop({
      id: "s",
      type: "multiSelect",
      typeOptions: { choices: [{ id: "a", name: "Alpha", color: "red" }, { id: "b", name: "Beta", color: "blue" }] },
    });
    expect(cellToText(["b", "a"], select)).toBe("Beta, Alpha");

    const person = prop({ id: "u", type: "person" });
    const refs = {
      users: { u1: { id: "u1", name: "Ada", avatarUrl: null } },
      pages: { p1: { id: "p1", slugId: "x", title: null, icon: null, spaceId: "s", space: null } },
    };
    expect(cellToText("u1", person, refs)).toBe("Ada");
    expect(cellToText("u2", person, refs)).toBe("");

    const page = prop({ id: "p", type: "page" });
    expect(cellToText("p1", page, refs)).toBe("Untitled");

    const file = prop({ id: "f", type: "file" });
    expect(cellToText([{ id: "1", fileName: "a.pdf" }], file)).toBe("a.pdf");
  });

  it("marks formula errors", () => {
    const f = prop({ id: "f", type: "formula", typeOptions: { resultType: "number" } });
    expect(cellToText({ __err: "DIV_BY_ZERO", msg: "x", v: 1 }, f)).toBe("#ERROR");
    expect(cellToText(2.5, f)).toBe("2.5");
  });
});
