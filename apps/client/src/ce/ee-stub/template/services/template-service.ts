import type { ITemplate } from "../types/template.types";

/**
 * Enterprise-only endpoint; CE has no templates to serve.
 *
 * Unreachable in a CE build: the only open-source caller
 * (`empty-page-get-started.tsx`) renders its template chip behind
 * `useHasFeature(Feature.TEMPLATES)`, which a CE server never reports.
 * It rejects rather than resolving, so the caller takes its existing
 * "Failed to load template" branch if it is ever reached.
 */
export async function getTemplateById(_templateId: string): Promise<ITemplate> {
  throw new Error("Templates are part of the enterprise edition");
}
