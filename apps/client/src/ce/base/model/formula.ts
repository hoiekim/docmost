import {
  BaseFormulaGraph,
  FormulaParseError,
  MAX_FORMULA_SOURCE_LENGTH,
  parseRaw,
  registry,
  resolve,
  typecheck,
  type FormulaFn,
  type ParseError,
} from "@docmost/ce-formula/client";
import type { FormulaResultType, FormulaTypeOptions, IBaseProperty } from "../types";

/**
 * Result type a property contributes to formula type checking. Must agree
 * with projectResultType() in apps/server/src/ce/base/engine/formula-types.ts.
 */
export function propertyResultType(prop: Pick<IBaseProperty, "type" | "typeOptions">): FormulaResultType {
  switch (prop.type) {
    case "number":
      return "number";
    case "text":
    case "longText":
    case "url":
    case "email":
      return "string";
    case "checkbox":
      return "boolean";
    case "date":
    case "createdAt":
    case "lastEditedAt":
      return "date";
    case "formula": {
      const rt = (prop.typeOptions as FormulaTypeOptions)?.resultType;
      if (rt === "number" || rt === "string" || rt === "boolean" || rt === "date") return rt;
      return "null";
    }
    default:
      return "null";
  }
}

export type FormulaCheck =
  | { ok: true; resultType: FormulaResultType; dependencies: string[] }
  | { ok: false; error: string; span?: { start: number; end: number } };

/**
 * Validate a formula source the same way the server will: parse, resolve
 * property names to ids, typecheck, and reject cycles. `selfId` is the
 * property being edited (null while creating).
 */
export function checkFormula(
  source: string,
  properties: IBaseProperty[],
  selfId: string | null,
): FormulaCheck {
  if (source.trim() === "") return { ok: false, error: "Formula is empty" };
  if (source.length > MAX_FORMULA_SOURCE_LENGTH) {
    return { ok: false, error: "Formula is too long" };
  }
  const others = properties.filter((p) => p.id !== selfId);
  const nameToId = new Map(others.map((p) => [p.name, p.id]));
  const types = new Map(others.map((p) => [p.id, propertyResultType(p)]));
  try {
    const raw = parseRaw(source);
    const { ast, dependencies } = resolve(raw, nameToId);
    const { resultType } = typecheck(ast, types, registry);
    const candidate = {
      id: selfId ?? "__candidate__",
      type: "formula",
      typeOptions: { dependencies },
    };
    const graph = new BaseFormulaGraph([...others, candidate]);
    if (graph.detectCycle(candidate)) {
      return { ok: false, error: "Formula would create a circular reference" };
    }
    return { ok: true, resultType, dependencies };
  } catch (err) {
    if (err instanceof FormulaParseError) {
      const first: ParseError | undefined = err.errors[0];
      return {
        ok: false,
        error: first?.message ?? "Invalid formula",
        span: first?.span,
      };
    }
    return { ok: false, error: (err as Error)?.message ?? "Invalid formula" };
  }
}

export type FormulaFunctionDoc = {
  name: string;
  category: FormulaFn["category"];
  doc: string;
  signature: string;
};

function signatureOf(fn: FormulaFn): string {
  const params: string[] = [];
  const max = fn.arity.max ?? fn.arity.min + 1;
  for (let i = 0; i < max; i++) {
    const t = Array.isArray(fn.paramTypes) ? fn.paramTypes[i] ?? "any" : "any";
    let name = `${t}${max > 1 ? i + 1 : ""}`;
    if (i >= fn.arity.min) name = `[${name}]`;
    params.push(name);
  }
  if (fn.arity.max === null) params.push("...");
  return `${fn.name}(${params.join(", ")})`;
}

/** Registered functions, grouped and sorted for the palette. */
export function formulaFunctionDocs(): FormulaFunctionDoc[] {
  const out: FormulaFunctionDoc[] = [];
  for (const fn of registry.values()) {
    out.push({
      name: fn.name,
      category: fn.category,
      doc: fn.doc,
      signature: signatureOf(fn),
    });
  }
  return out.sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/** Quote a property name for insertion as prop("...") in a formula source. */
export function propReference(name: string): string {
  return `prop("${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}
