/**
 * MIME-type classification — re-exported from the shared module so the
 * panel's body views and the workbench's body editors agree on both
 * "what language should Monaco highlight as?" and "is it worth showing
 * a pretty-print toggle?" (`@openheaders/ui/shared/mime` owns the
 * decisions; panel callers keep this import path).
 */

export { type BodyLanguage, canPrettyPrint, detectLanguage, isTextMime } from '@openheaders/ui/shared/mime';
