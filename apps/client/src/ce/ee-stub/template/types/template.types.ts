/**
 * Shape of a template as the open-source caller uses it.
 *
 * `features/editor/components/empty-page/empty-page-get-started.tsx` is the
 * only open-source file that names this type: it receives one from the
 * template picker's `onUse`, reads `id` to re-fetch the full record, and
 * hands the result to `applyTemplateToPage`. Nothing else is destructured,
 * so nothing else is declared here.
 */
export interface ITemplate {
  id: string;
  title?: string;
}
