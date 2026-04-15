/**
 * Language registry — the single source of truth for every editable
 * language surface in the extension.
 *
 * Every entry maps a `LanguageId` to:
 *
 *   1. A label shown in the editor tab strip, language dropdowns, etc.
 *   2. A lazy loader for the CodeMirror language extension. CodeMirror
 *      language packs are individual npm packages, so the loader is a
 *      `() => import('@codemirror/lang-*')`. Vite splits each one into
 *      its own chunk — the main workspace bundle never ships code for
 *      languages the user hasn't opened.
 *   3. An optional formatter descriptor (parser name + lazy plugin
 *      loader). JSON uses the native `JSON.parse`/`JSON.stringify`
 *      path and leaves `formatter` undefined so no Prettier code is
 *      downloaded just to indent JSON. Every other language loads
 *      `prettier/standalone` plus its parser the first time a user
 *      clicks Format or saves with `formatOnSave` on.
 *
 * Adding a language:
 *
 *   1. `pnpm --filter @openheaders/extension add @codemirror/lang-<name>`
 *   2. For formatter support: make sure Prettier has a parser (see
 *      https://prettier.io/docs/en/plugins). `@prettier/plugin-xml` is
 *      community-maintained and needs a separate install.
 *   3. Add one entry to `LANGUAGES` below.
 *   4. The Format button, keyboard shortcut, `editor.formatOnSave`, and
 *      per-language syntax highlighting all start working automatically.
 *
 * This file is intentionally UI-free — it's pure data + loaders, so
 * both the editor and the formatter can consume it without pulling in
 * React.
 */

import type { Extension } from '@codemirror/state';

/**
 * Every language the extension can currently edit. Expand this union as
 * roadmap languages land — the `LANGUAGES` record below will then fail
 * to compile until the new entry is added, which is the whole point of
 * a type-level registry.
 */
export type LanguageId = 'javascript' | 'css' | 'json';

/**
 * Prettier's `format()` signature needs a concrete plugin value, which
 * we can't reference here without statically importing `prettier` —
 * that would defeat the lazy-loading goal. We model plugin loaders as
 * "anything Prettier will accept" and let the formatter module hand
 * the loaded values straight to `format()`.
 */
// biome-ignore lint/suspicious/noExplicitAny: matches Prettier's own Plugin signature, which is intentionally permissive
export type PrettierPlugin = any;

export interface FormatterDescriptor {
  /** Prettier parser identifier. See https://prettier.io/docs/en/options.html#parser. */
  parser: string;
  /**
   * Lazy loader for every Prettier plugin the parser needs. Return an
   * array; the formatter concatenates all returned plugins and passes
   * them to `prettier.format()`. For example, the Babel parser needs
   * both `parser-babel` and `parser-estree` at runtime, so its loader
   * resolves to `[babel, estree]`.
   */
  loadPlugins: () => Promise<PrettierPlugin[]>;
}

export interface LanguageDef {
  id: LanguageId;
  label: string;
  /** Lazy loader for the CodeMirror language extension. */
  loadExtension: () => Promise<Extension>;
  /**
   * Optional formatter. Languages with `formatter === undefined` are
   * editable but not formattable — the Format button is disabled and
   * `editor.formatOnSave` is a no-op for that buffer. Today every
   * registered language is formattable (JSON via native code, JS/CSS
   * via Prettier).
   */
  formatter?: FormatterDescriptor;
}

// ── JavaScript ───────────────────────────────────────────────────────

const javascriptDef: LanguageDef = {
  id: 'javascript',
  label: 'JavaScript',
  loadExtension: async () => {
    const mod = await import('@codemirror/lang-javascript');
    return mod.javascript();
  },
  formatter: {
    parser: 'babel',
    loadPlugins: async () => {
      const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
      return [babel.default, estree.default];
    },
  },
};

// ── CSS ──────────────────────────────────────────────────────────────

const cssDef: LanguageDef = {
  id: 'css',
  label: 'CSS',
  loadExtension: async () => {
    const mod = await import('@codemirror/lang-css');
    return mod.css();
  },
  formatter: {
    parser: 'css',
    loadPlugins: async () => {
      const postcss = await import('prettier/plugins/postcss');
      return [postcss.default];
    },
  },
};

// ── JSON ─────────────────────────────────────────────────────────────
//
// JSON's formatter descriptor is a sentinel — `parser === 'json-native'`
// tells the formatter module to skip Prettier entirely and use the
// built-in `JSON.parse(x); JSON.stringify(parsed, null, indent)` path.
// This keeps Prettier out of the bundle for the single most common
// language in the API-request roadmap.

const jsonDef: LanguageDef = {
  id: 'json',
  label: 'JSON',
  loadExtension: async () => {
    const mod = await import('@codemirror/lang-json');
    return mod.json();
  },
  formatter: {
    parser: 'json-native',
    loadPlugins: async () => [],
  },
};

// ── Registry ─────────────────────────────────────────────────────────

export const LANGUAGES: Record<LanguageId, LanguageDef> = {
  javascript: javascriptDef,
  css: cssDef,
  json: jsonDef,
};

export function getLanguage(id: LanguageId): LanguageDef {
  return LANGUAGES[id];
}

export function isFormattable(id: LanguageId): boolean {
  return LANGUAGES[id].formatter !== undefined;
}

/** Ordered list for UI (dropdowns, tabs). */
export const LANGUAGE_LIST: readonly LanguageDef[] = Object.values(LANGUAGES);
