/**
 * Language registry — the single source of truth for every editable
 * language surface in the extension.
 *
 * Monaco provides syntax highlighting, tokenization, and (for JS /
 * JSON / CSS / HTML) a full language service out of the box. For the
 * FORMATTER surface the story is split:
 *
 *   • JSON / CSS / HTML — Monaco's built-in LSP workers ship a
 *     `DocumentFormattingEditProvider` that `editor.action.formatDocument`
 *     picks up for free. No registration on our side.
 *   • JavaScript / XML — Monaco has no built-in formatter. We register
 *     a Prettier-backed provider in `components/monaco/formatters.ts`
 *     that runs through the same action.
 *   • Text / GraphQL — no formatter at all; the Format button stays
 *     hidden by Monaco's action-not-supported reflex.
 *
 * This registry therefore only carries a LABEL for the UI (dropdowns,
 * tab strips). Formatter metadata (which parser, which plugins) now
 * lives alongside its implementation in `languages/prettier.ts`, not
 * here — keeps the registry UI-only.
 *
 * Adding a language:
 *   1. Add one entry to `LANGUAGES` below.
 *   2. Use Monaco's internal id if the language has native support
 *      (`'javascript'`, `'css'`, `'json'`, `'html'`, `'xml'`, …).
 *   3. For formatter support: extend `languages/prettier.ts` with
 *      its parser + plugin loader and (if Monaco doesn't format it
 *      natively) add it to `REGISTER_FOR` in
 *      `components/monaco/formatters.ts`.
 */

export type LanguageId = 'javascript' | 'css' | 'json' | 'xml' | 'html' | 'text' | 'graphql' | 'markdown';

export interface LanguageDef {
  id: LanguageId;
  label: string;
}

export const LANGUAGES: Record<LanguageId, LanguageDef> = {
  javascript: { id: 'javascript', label: 'JavaScript' },
  css: { id: 'css', label: 'CSS' },
  json: { id: 'json', label: 'JSON' },
  xml: { id: 'xml', label: 'XML' },
  html: { id: 'html', label: 'HTML' },
  text: { id: 'text', label: 'Text' },
  graphql: { id: 'graphql', label: 'GraphQL' },
  markdown: { id: 'markdown', label: 'Markdown' },
};

/**
 * Map a registry id to the Monaco language id Monaco internally
 * registers. For most languages the id is identical, but `text` needs
 * to be mapped to Monaco's built-in `plaintext` and `graphql` has no
 * native Monaco grammar so we fall back to plaintext until the
 * GraphQL plugin is wired.
 */
export function toMonacoLanguage(id: LanguageId): string {
  if (id === 'text') return 'plaintext';
  if (id === 'graphql') return 'plaintext';
  return id;
}

export function getLanguage(id: LanguageId): LanguageDef {
  return LANGUAGES[id];
}

/** Ordered list for UI (dropdowns, tabs). */
export const LANGUAGE_LIST: readonly LanguageDef[] = Object.values(LANGUAGES);
