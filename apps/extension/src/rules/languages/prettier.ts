/**
 * Prettier-backed code formatter, lazy-loaded.
 *
 * `formatWithPrettier(code, language)` is the low-level workhorse:
 *   • Dynamically imports `prettier/standalone` + the language's
 *     plugin(s). Vite splits these into their own chunks so the main
 *     bundle doesn't pay for Prettier until the first format call.
 *   • Reads the editor.* settings (tab width, spaces vs tabs, print
 *     width) so the output respects the user's configuration.
 *
 * It's used in two places:
 *   1. Monaco's `DocumentFormattingEditProvider` (see
 *      `components/monaco/formatters.ts`) — lets `editor.action.formatDocument`
 *      dispatch to Prettier for languages Monaco doesn't natively
 *      format (JS / XML).
 *   2. Format-on-save in `RuleEditor`, which formats in-memory strings
 *      that aren't bound to a Monaco editor.
 *
 * For JSON we short-circuit to `JSON.parse` + `JSON.stringify` so
 * Prettier + the babel plugin don't ship unless the user actually
 * edits a JS / CSS / HTML / XML buffer.
 *
 * Errors never mutate state: on parse failure `formatWithPrettier`
 * throws; callers catch and either surface a banner (UI Format
 * button → inline Alert) or a toast (format-on-save → message.warning).
 */

import { get as getSetting } from '../settings/store';
import type { LanguageId } from './registry';

/** Languages where Prettier is our formatter — Monaco has no built-in
 *  formatter for these. CSS / HTML / JSON are handled by Monaco's own
 *  LSP workers (CSS / HTML) or a native short-circuit (JSON). */
const PRETTIER_LANGUAGES = new Set<LanguageId>(['javascript', 'xml']);

export function isPrettierLanguage(language: LanguageId): boolean {
  return PRETTIER_LANGUAGES.has(language);
}

export class FormatError extends Error {
  constructor(
    message: string,
    public readonly language: LanguageId,
  ) {
    super(message);
    this.name = 'FormatError';
  }
}

/** Unified entry for format-on-save: native JSON short-circuit,
 *  Prettier for everything else registered as Prettier-backed. */
export async function formatString(code: string, language: LanguageId): Promise<string> {
  if (language === 'json') return formatJson(code, language);
  if (language === 'css' || language === 'html') return formatWithPrettier(code, language);
  if (PRETTIER_LANGUAGES.has(language)) return formatWithPrettier(code, language);
  throw new FormatError(`No formatter registered for ${language}`, language);
}

/**
 * Format `code` using Prettier. Dynamically imports `prettier/standalone`
 * and the plugin(s) required for `language`. Reads editor.* settings
 * for tab width + indent style + print width.
 */
export async function formatWithPrettier(code: string, language: LanguageId): Promise<string> {
  const parser = PRETTIER_PARSER[language];
  if (!parser) {
    throw new FormatError(`No Prettier parser mapped for ${language}`, language);
  }
  const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), loadPlugins(language)]);
  const tabWidth = getSetting('editor.tabSize');
  const useTabs = !getSetting('editor.insertSpaces');
  const printWidth = getSetting('editor.wordWrapColumn');
  try {
    return await format(code, {
      parser,
      plugins,
      tabWidth,
      useTabs,
      printWidth,
    });
  } catch (err) {
    throw new FormatError(err instanceof Error ? err.message : 'Format failed', language);
  }
}

function formatJson(code: string, language: LanguageId): string {
  try {
    const tabWidth = getSetting('editor.tabSize');
    const indent = getSetting('editor.insertSpaces') ? ' '.repeat(tabWidth) : '\t';
    return JSON.stringify(JSON.parse(code), null, indent);
  } catch (err) {
    throw new FormatError(err instanceof Error ? err.message : 'Invalid JSON', language);
  }
}

const PRETTIER_PARSER: Partial<Record<LanguageId, string>> = {
  javascript: 'babel',
  css: 'css',
  html: 'html',
  xml: 'xml',
};

// biome-ignore lint/suspicious/noExplicitAny: matches Prettier's permissive Plugin signature
type PrettierPlugin = any;

async function loadPlugins(language: LanguageId): Promise<PrettierPlugin[]> {
  switch (language) {
    case 'javascript': {
      const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
      return [babel.default, estree.default];
    }
    case 'css': {
      const postcss = await import('prettier/plugins/postcss');
      return [postcss.default];
    }
    case 'html': {
      const html = await import('prettier/plugins/html');
      return [html.default];
    }
    case 'xml': {
      const xml = await import('@prettier/plugin-xml');
      return [xml.default];
    }
    default:
      throw new FormatError(`No Prettier plugin loader for ${language}`, language);
  }
}
