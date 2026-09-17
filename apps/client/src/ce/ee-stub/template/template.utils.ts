import type { Editor } from "@tiptap/core";
import type { ITemplate } from "./types/template.types";

/**
 * Enterprise-only; CE applies nothing.
 *
 * The open-source caller treats `false` as "the page was not empty any more"
 * and shows a notice. Unreachable in a CE build for the same reason as
 * `services/template-service.ts`, and `false` is the honest answer: no
 * content was written.
 */
export function applyTemplateToPage(
  _editor: Editor,
  _titleEditor: Editor,
  _template: ITemplate,
): boolean {
  return false;
}
