/**
 * The script editor's reference grammar — the one place a script names
 * a variable the runtime resolves: the string argument of
 * `oh.variables.get('…')` (the full resolver walk, every scope but a
 * workflow step's) and `oh.vault.get('…')` (a vault entry by name).
 * The span is the whole string literal, quotes included, so an empty
 * run still has a painted span; the reference the resolver reads is
 * the literal's text, under the `vault.` namespace for the vault
 * lookup. A pick writes the bare name inside the quotes — never
 * braces — and the vault lookup drops its namespace prefix.
 *
 * A template literal carrying `${…}` is a computed name: nothing to
 * classify, nothing offered.
 */

import type { SuggestionContext, VariableSuggestion } from '@openheaders/core/variables';
import type { InsertEdit } from '../template-input/monaco/monaco-suggest-measure';
import type { MonacoRefGrammar, OpenRun, RefSpan } from '../template-input/monaco/ref-grammar';

type LookupApi = 'variables' | 'vault';

/** Every closed-string lookup on the line. */
const CALL_RX = /\boh\.(variables|vault)\.get\(\s*(['"`])/g;
/** The lookup whose string is still open at the caret. */
const OPEN_RX = /\boh\.(variables|vault)\.get\(\s*(['"`])([^'"`]*)$/;

const VAULT_PREFIX = 'vault.';

/** The scopes `oh.variables.get` walks — a script runs outside any
 *  workflow step. */
const VARIABLES_SCOPES: SuggestionContext['allowed'] = { step: false };
/** `oh.vault.get` names a vault entry alone. */
const VAULT_SCOPES: SuggestionContext['allowed'] = {
  env: false,
  collection: false,
  workspace: false,
  live: false,
  step: false,
  file: false,
  dynamic: false,
};

function isComputed(quote: string, text: string): boolean {
  return quote === '`' && text.includes('${');
}

function referenceOf(api: LookupApi, literal: string): string {
  return api === 'vault' ? `${VAULT_PREFIX}${literal}` : literal;
}

function refs(lineText: string): RefSpan[] {
  const out: RefSpan[] = [];
  const regex = new RegExp(CALL_RX.source, CALL_RX.flags);
  for (const match of lineText.matchAll(regex)) {
    const api = match[1] as LookupApi;
    const quote = match[2];
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = lineText.indexOf(quote, open + 1);
    if (close === -1) continue;
    const literal = lineText.slice(open + 1, close);
    if (literal === '' || isComputed(quote, literal)) continue;
    out.push({ startColumn: open + 1, endColumn: close + 2, inner: referenceOf(api, literal) });
  }
  return out;
}

function openRun(lineText: string, column: number): OpenRun | null {
  const m = OPEN_RX.exec(lineText.slice(0, column - 1));
  if (!m) return null;
  const api = m[1] as LookupApi;
  if (isComputed(m[2], m[3])) return null;
  const quoteOffset = m.index + m[0].length - m[2].length - m[3].length;
  return {
    startColumn: quoteOffset + 1,
    query: referenceOf(api, m[3]),
    allowed: api === 'vault' ? VAULT_SCOPES : VARIABLES_SCOPES,
  };
}

function insert(
  lineText: string,
  lineNumber: number,
  startColumn: number,
  caretColumn: number,
  suggestion: VariableSuggestion,
): InsertEdit {
  const run = OPEN_RX.exec(lineText.slice(0, startColumn));
  const api: LookupApi = run?.[1] === 'vault' ? 'vault' : 'variables';
  const text =
    api === 'vault' && suggestion.reference.startsWith(VAULT_PREFIX)
      ? suggestion.reference.slice(VAULT_PREFIX.length)
      : suggestion.reference;
  const scaffold = suggestion.preview.kind === 'namespace';
  return {
    range: {
      startLineNumber: lineNumber,
      startColumn: startColumn + 1,
      endLineNumber: lineNumber,
      endColumn: caretColumn,
    },
    text,
    caretColumn: startColumn + 1 + text.length,
    scaffold,
  };
}

export const OH_API_REF_GRAMMAR: MonacoRefGrammar = {
  id: 'oh-api',
  refs,
  openRun,
  insert,
};
