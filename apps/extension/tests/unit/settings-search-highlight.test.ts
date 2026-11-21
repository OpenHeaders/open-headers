/**
 * Settings search › highlighting — the stretches of a displayed text
 * the query's terms match (a term matches a word it starts), which
 * terms a text leaves unexplained, and the cut of a long text that
 * keeps a deep hit on the first line shown.
 */

import { excerptFrom, matchRanges, unmatchedTerms } from '@openheaders/ui/workbench/settings/search/highlight';
import { describe, expect, it } from 'vitest';

/** The stretches a set of ranges covers, as text. */
const covered = (text: string, ranges: ReturnType<typeof matchRanges>): string[] =>
  ranges.map(([start, end]) => text.slice(start, end));

describe('matchRanges', () => {
  it('paints the leading characters of each word a term starts, in the text’s own case', () => {
    const text = 'Font Family for the Code Editor';
    expect(covered(text, matchRanges(text, ['fo', 'ed']))).toEqual(['Fo', 'fo', 'Ed']);
  });

  it('leaves a term found only inside a word unpainted', () => {
    const text = 'Import and export support';
    expect(matchRanges(text, ['port'])).toEqual([]);
  });

  it('splits words where labels and keys do — on dots, dashes, underscores and slashes', () => {
    const text = 'built-in editor.fontSize path/to_file';
    expect(covered(text, matchRanges(text, ['in', 'font', 'to', 'file']))).toEqual(['in', 'font', 'to', 'file']);
  });

  it('reads a word through the punctuation around it', () => {
    const text = 'Shows the scheme (auth?) and "quoted" values; exported.';
    expect(covered(text, matchRanges(text, ['auth', 'quo', 'exp']))).toEqual(['auth', 'quo', 'exp']);
  });

  it('finds the words of a script written without spaces', () => {
    const text = 'フォントファミリーを選択';
    expect(covered(text, matchRanges(text, ['ファミ', '選']))).toEqual(['ファミ', '選']);
    // Still a word START: the tail of a word is not a hit.
    expect(matchRanges(text, ['ミリー'])).toEqual([]);
  });

  it('lets a piece with no word in it stand as itself', () => {
    const text = 'Ctrl + K';
    expect(covered(text, matchRanges(text, ['+']))).toEqual(['+']);
  });

  it('paints the longest term when several start the same word', () => {
    const text = 'Proxy port';
    expect(covered(text, matchRanges(text, ['p', 'pro']))).toEqual(['Pro', 'p']);
  });

  it('returns nothing without terms', () => {
    expect(matchRanges('Font Family', [])).toEqual([]);
  });
});

describe('unmatchedTerms', () => {
  it('names the terms a text carries no word for', () => {
    expect(unmatchedTerms('Font Family', ['font', 'size', 'fam'])).toEqual(['size']);
  });

  it('treats a mid-word occurrence as unmatched', () => {
    expect(unmatchedTerms('Import Settings', ['port'])).toEqual(['port']);
  });
});

describe('excerptFrom', () => {
  const text = 'Requests sent from the workbench follow redirects up to the configured limit.';
  const ranges = matchRanges(text, ['requests', 'redirects']);
  const anchor = text.indexOf('redirects');

  it('keeps a text whose hit is near its opening whole', () => {
    const near = matchRanges(text, ['sent']);
    expect(excerptFrom(text, near, near[0][0], 32)).toEqual({ text, ranges: near });
  });

  it('opens a deep hit’s cut at a word, marks the dropped opening, and shifts the ranges with it', () => {
    const excerpt = excerptFrom(text, ranges, anchor, 20);
    expect(excerpt.text).toBe('…workbench follow redirects up to the configured limit.');
    // The range before the cut ("Requests") is gone; the kept one still
    // covers its word in the cut text.
    expect(covered(excerpt.text, excerpt.ranges)).toEqual(['redirects']);
  });

  it('never cuts past the hit it opens on', () => {
    const excerpt = excerptFrom(text, ranges, anchor, 0);
    expect(excerpt.text).toBe('…redirects up to the configured limit.');
    expect(covered(excerpt.text, excerpt.ranges)).toEqual(['redirects']);
  });
});
