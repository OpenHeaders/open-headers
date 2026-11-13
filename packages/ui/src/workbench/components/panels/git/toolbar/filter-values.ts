/**
 * filter-values — a log filter that holds SEVERAL values (the Branch
 * chip's refs, the User chip's authors, the Paths chip's paths), as the
 * Select… field's text and as a list. In the text the values sit one a
 * line; refs and authors may also be separated by a bar, paths may not
 * (a path can hold one). The word the caret stands in and the names it
 * could become, a pick written over that word with the caret on a new
 * line after it, what a finished text names; and the lists applied
 * last, which the chips' Recent rows read. Pure.
 */

/** Whether a bar separates values, beside the line break that always does. */
function isSeparator(char: string, bar: boolean): boolean {
  return char === '\n' || (bar && char === '|');
}

export interface FieldWord {
  /** Where the word starts and ends in the text — separator to separator. */
  start: number;
  end: number;
  /** What of it precedes the caret, trimmed — what was typed so far. */
  typed: string;
}

export function wordAtCaret(text: string, caret: number, bar = true): FieldWord {
  let start = caret;
  while (start > 0 && !isSeparator(text[start - 1], bar)) start -= 1;
  let end = caret;
  while (end < text.length && !isSeparator(text[end], bar)) end += 1;
  return { start, end, typed: text.slice(start, caret).trim() };
}

/** The values a text names, in order, each once. */
export function fieldValues(text: string, bar = true): string[] {
  const values = text
    .split(bar ? /[|\n]/ : '\n')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(values)];
}

/**
 * The names the word under the caret could become: those that hold what
 * was typed (case aside) and are not named elsewhere in the text — the
 * ones that begin with it first. Nothing was typed, nothing is offered.
 */
export function fieldSuggestions(text: string, caret: number, names: readonly string[], bar = true): string[] {
  const word = wordAtCaret(text, caret, bar);
  if (word.typed === '') return [];
  const needle = word.typed.toLowerCase();
  const elsewhere = new Set(fieldValues(`${text.slice(0, word.start)}\n${text.slice(word.end)}`, bar));
  const holding = names.filter((name) => !elsewhere.has(name) && name.toLowerCase().includes(needle));
  const leads = (name: string): boolean => name.toLowerCase().startsWith(needle);
  return [...holding.filter(leads), ...holding.filter((name) => !leads(name))];
}

/** A pick written over the caret's word, the caret on a new line after it. */
export function withSuggestion(text: string, caret: number, name: string, bar = true): { text: string; caret: number } {
  const word = wordAtCaret(text, caret, bar);
  const head = `${text.slice(0, word.start)}${name}\n`;
  // The separator that closed the word goes: the pick's own line break stands in for it.
  return { text: `${head}${text.slice(word.end + (word.end < text.length ? 1 : 0))}`, caret: head.length };
}

/** The values that are none of the names — what a field that takes names alone cannot hold. */
export function unknownValues(values: readonly string[], names: readonly string[]): string[] {
  const known = new Set(names);
  return values.filter((value) => !known.has(value));
}

/** How many applied lists a chip's Recent keeps. */
export const RECENT_VALUES_MAX = 5;

/** Two lists that name the same values in the same order. */
export function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** The recent lists once one more is applied: it leads, listed once, and the oldest fall off. */
export function withRecentValues(
  recent: readonly (readonly string[])[],
  values: readonly string[],
): (readonly string[])[] {
  return [values, ...recent.filter((entry) => !sameValues(entry, values))].slice(0, RECENT_VALUES_MAX);
}
