/**
 * scope-field — the Branch filter's Select… field as text: several
 * refs, one a line or separated by a bar. The word the caret stands in
 * and the refs it could become, a pick written over that word with the
 * caret on a new line after it, and what the text names once finished.
 * Pure.
 */

const SEPARATORS = /[|\n]/;

function isSeparator(char: string): boolean {
  return char === '|' || char === '\n';
}

export interface ScopeFieldWord {
  /** Where the word starts and ends in the text — separator to separator. */
  start: number;
  end: number;
  /** What of it precedes the caret, trimmed — what was typed so far. */
  typed: string;
}

export function wordAtCaret(text: string, caret: number): ScopeFieldWord {
  let start = caret;
  while (start > 0 && !isSeparator(text[start - 1])) start -= 1;
  let end = caret;
  while (end < text.length && !isSeparator(text[end])) end += 1;
  return { start, end, typed: text.slice(start, caret).trim() };
}

/** The values a text names, in order, each once. */
export function scopeFieldValues(text: string): string[] {
  const values = text
    .split(SEPARATORS)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
}

/**
 * The names the word under the caret could become: those that hold what
 * was typed (case aside) and are not named elsewhere in the text — the
 * ones that begin with it first. Nothing was typed, nothing is offered.
 */
export function scopeFieldSuggestions(text: string, caret: number, names: readonly string[]): string[] {
  const word = wordAtCaret(text, caret);
  if (word.typed === '') return [];
  const needle = word.typed.toLowerCase();
  const elsewhere = new Set(scopeFieldValues(`${text.slice(0, word.start)}\n${text.slice(word.end)}`));
  const holding = names.filter((name) => !elsewhere.has(name) && name.toLowerCase().includes(needle));
  const leads = (name: string): boolean => name.toLowerCase().startsWith(needle);
  return [...holding.filter(leads), ...holding.filter((name) => !leads(name))];
}

/** A pick written over the caret's word, the caret on a new line after it. */
export function withSuggestion(text: string, caret: number, name: string): { text: string; caret: number } {
  const word = wordAtCaret(text, caret);
  const head = `${text.slice(0, word.start)}${name}\n`;
  return { text: `${head}${text.slice(word.end).replace(SEPARATORS, '')}`, caret: head.length };
}

/** The values that are none of the names — what a finished field cannot scope to. */
export function unknownScopeValues(values: readonly string[], names: readonly string[]): string[] {
  const known = new Set(names);
  return values.filter((value) => !known.has(value));
}
