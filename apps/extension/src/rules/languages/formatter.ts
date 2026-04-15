/**
 * Formatter — lazy-loaded code formatter driven by the language registry.
 *
 * `formatCode(code, language)` is the only public entry. It resolves
 * the language's formatter descriptor, short-circuits JSON to a native
 * `JSON.parse`/`JSON.stringify` pass, and otherwise dynamically imports
 * `prettier/standalone` plus every plugin the language declared.
 *
 * Prettier and its plugins are imported inside the function, not at
 * module scope, so Vite splits them into a separate chunk. The
 * workspace entry never statically references Prettier — the chunk is
 * downloaded only on the first successful `formatCode` call per
 * session.
 *
 * Errors (parse failure, unknown language, non-formattable language)
 * surface as a `FormatError` the caller can translate into an Ant
 * `message.error(...)`. The function never mutates state on failure —
 * the input is returned untouched so a failed format never clobbers
 * the user's buffer.
 */

import { get as getSetting } from '../settings/store';
import { getLanguage, type LanguageId } from './registry';

export class FormatError extends Error {
  constructor(
    message: string,
    public readonly language: LanguageId,
  ) {
    super(message);
    this.name = 'FormatError';
  }
}

/** Result of a format call — `ok` discriminant keeps the error path type-safe. */
export type FormatResult = { ok: true; code: string } | { ok: false; error: FormatError };

/**
 * Format `code` as `language`. Returns a discriminated union rather
 * than throwing so hot paths (keymap handlers, save intercepts) can
 * branch without try/catch.
 */
export async function formatCode(code: string, language: LanguageId): Promise<FormatResult> {
  const def = getLanguage(language);
  const descriptor = def.formatter;
  if (!descriptor) {
    return {
      ok: false,
      error: new FormatError(`No formatter registered for ${def.label}`, language),
    };
  }

  // JSON — native, zero Prettier cost.
  if (descriptor.parser === 'json-native') {
    try {
      const tabWidth = getSetting('editor.tabSize');
      const indent = getSetting('editor.insertSpaces') ? ' '.repeat(tabWidth) : '\t';
      const parsed = JSON.parse(code);
      return { ok: true, code: JSON.stringify(parsed, null, indent) };
    } catch (err) {
      return {
        ok: false,
        error: new FormatError(err instanceof Error ? err.message : 'Invalid JSON', language),
      };
    }
  }

  // Prettier — lazy-load standalone + plugins together.
  try {
    const [{ format }, plugins] = await Promise.all([import('prettier/standalone'), descriptor.loadPlugins()]);
    const tabWidth = getSetting('editor.tabSize');
    const useTabs = !getSetting('editor.insertSpaces');
    const printWidth = getSetting('editor.wordWrapColumn');
    const formatted = await format(code, {
      parser: descriptor.parser,
      plugins,
      tabWidth,
      useTabs,
      printWidth,
    });
    return { ok: true, code: formatted };
  } catch (err) {
    return {
      ok: false,
      error: new FormatError(err instanceof Error ? err.message : 'Format failed', language),
    };
  }
}
