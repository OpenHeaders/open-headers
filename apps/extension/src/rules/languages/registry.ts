/**
 * Language registry — the single source of truth for every editable
 * language surface in the extension.
 *
 * Monaco provides syntax highlighting, tokenization, and (for JS / TS /
 * JSON / CSS / HTML) a full language service out of the box. This
 * registry therefore only carries:
 *
 *   1. A label shown in dropdowns + tab strips.
 *   2. An optional formatter descriptor (Prettier parser + lazy plugin
 *      loader). JSON uses the native `JSON.parse`/`JSON.stringify` path
 *      sentinel (`parser === 'json-native'`) so Prettier doesn't ship
 *      unless JS/CSS actually ask for it.
 *
 * Adding a language:
 *
 *   1. Add one entry to `LANGUAGES` below.
 *   2. Monaco resolves built-in languages automatically — use the same
 *      id Monaco uses internally (`'javascript'`, `'css'`, `'json'`,
 *      `'html'`, `'xml'`, …).
 *   3. For formatter support: install the Prettier parser plugin and
 *      wire its lazy import under `formatter.loadPlugins`.
 *
 * This file is intentionally UI-free — it's pure data + loaders, so
 * both the editor and the formatter can consume it without pulling in
 * React.
 */

/**
 * Every language the extension can currently edit. Expand this union as
 * roadmap languages land — the `LANGUAGES` record below will then fail
 * to compile until the new entry is added, which is the whole point of
 * a type-level registry.
 */
export type LanguageId = 'javascript' | 'css' | 'json' | 'xml' | 'html' | 'text' | 'graphql';

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
  /**
   * Optional formatter. Languages with `formatter === undefined` are
   * editable but not formattable — the Format button is disabled and
   * `editor.formatOnSave` is a no-op for that buffer.
   */
  formatter?: FormatterDescriptor;
}

const javascriptDef: LanguageDef = {
  id: 'javascript',
  label: 'JavaScript',
  formatter: {
    parser: 'babel',
    loadPlugins: async () => {
      const [babel, estree] = await Promise.all([import('prettier/plugins/babel'), import('prettier/plugins/estree')]);
      return [babel.default, estree.default];
    },
  },
};

const cssDef: LanguageDef = {
  id: 'css',
  label: 'CSS',
  formatter: {
    parser: 'css',
    loadPlugins: async () => {
      const postcss = await import('prettier/plugins/postcss');
      return [postcss.default];
    },
  },
};

/**
 * JSON's formatter descriptor is a sentinel — `parser === 'json-native'`
 * tells the formatter module to skip Prettier entirely and use the
 * built-in `JSON.parse(x); JSON.stringify(parsed, null, indent)` path.
 * This keeps Prettier out of the bundle for the single most common
 * language in the API-request roadmap.
 */
const jsonDef: LanguageDef = {
  id: 'json',
  label: 'JSON',
  formatter: {
    parser: 'json-native',
    loadPlugins: async () => [],
  },
};

/**
 * Read/write body encodings that don't currently get a Prettier
 * formatter — we lean on Monaco's built-in tokenizer for highlighting.
 * `text` maps to Monaco's `plaintext` internally; `graphql` has no
 * first-class Monaco language today so we tokenize it as plaintext
 * (swap to `monaco-graphql` whenever we ship GraphQL tooling).
 */
const xmlDef: LanguageDef = { id: 'xml', label: 'XML' };
const htmlDef: LanguageDef = { id: 'html', label: 'HTML' };
const textDef: LanguageDef = { id: 'text', label: 'Text' };
const graphqlDef: LanguageDef = { id: 'graphql', label: 'GraphQL' };

export const LANGUAGES: Record<LanguageId, LanguageDef> = {
  javascript: javascriptDef,
  css: cssDef,
  json: jsonDef,
  xml: xmlDef,
  html: htmlDef,
  text: textDef,
  graphql: graphqlDef,
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

export function isFormattable(id: LanguageId): boolean {
  return LANGUAGES[id].formatter !== undefined;
}

/** Ordered list for UI (dropdowns, tabs). */
export const LANGUAGE_LIST: readonly LanguageDef[] = Object.values(LANGUAGES);
