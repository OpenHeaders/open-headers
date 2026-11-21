/**
 * Highlighting — where the query's terms sit in a piece of DISPLAYED
 * text, by the same rule the scorer matches with. Pure: text and terms
 * in, character ranges out.
 */

import { splitWords, termMatchesToken } from './tokens';

/** A stretch of a text: `[start, end)` character offsets. */
export type TextRange = readonly [start: number, end: number];

/**
 * The stretches of `text` the terms match, in order: for each word a
 * term starts, the leading characters that term covers (the longest
 * term's, when several start the same word).
 */
export function matchRanges(text: string, terms: readonly string[]): TextRange[] {
  if (terms.length === 0) return [];
  const ranges: TextRange[] = [];
  for (const word of splitWords(text)) {
    const token = word.text.toLowerCase();
    let covered = 0;
    for (const term of terms) {
      if (term.length > covered && termMatchesToken(token, term)) covered = term.length;
    }
    if (covered > 0) ranges.push([word.start, word.start + Math.min(covered, word.text.length)]);
  }
  return ranges;
}

/** The terms that match nowhere in `text`. */
export function unmatchedTerms(text: string, terms: readonly string[]): string[] {
  const tokens = splitWords(text).map((word) => word.text.toLowerCase());
  return terms.filter((term) => !tokens.some((token) => termMatchesToken(token, term)));
}

export interface Excerpt {
  text: string;
  ranges: TextRange[];
}

/**
 * A cut of `text` that opens shortly before `anchor`, so a hit deep in
 * a long text is still on the first line shown. A cut that drops the
 * text's opening starts at a word and is marked with an ellipsis;
 * `ranges` come back shifted to the cut.
 */
export function excerptFrom(text: string, ranges: readonly TextRange[], anchor: number, leadChars: number): Excerpt {
  if (anchor <= leadChars) return { text, ranges: [...ranges] };
  const opening = splitWords(text).find((word) => word.start >= anchor - leadChars);
  const cut = opening ? Math.min(opening.start, anchor) : anchor;
  const shift = 1 - cut;
  return {
    text: `…${text.slice(cut)}`,
    ranges: ranges.filter(([start]) => start >= cut).map(([start, end]): TextRange => [start + shift, end + shift]),
  };
}
