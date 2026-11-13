/**
 * filter-values (S66): a filter chip's Select… field as text — the word
 * under the caret, the names it could become, a pick written over it
 * with the caret on a new line, the values a finished text names and
 * the ones that are no name; a bar separating values or not (paths);
 * and the lists applied last, which the chips' Recent rows read.
 */

import {
  fieldSuggestions,
  fieldValues,
  sameValues,
  unknownValues,
  withRecentValues,
  withSuggestion,
  wordAtCaret,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/filter-values';
import { describe, expect, it } from 'vitest';

const names = [
  'HEAD',
  'feature/auth-headers',
  'feature/orders-v2',
  'fix/probe-timeout',
  'local-test',
  'main',
  'origin/main',
  'v2026.10.3',
];

describe('wordAtCaret', () => {
  it('is the stretch between the separators around the caret, typed up to it', () => {
    expect(wordAtCaret('main\nfea', 8)).toEqual({ start: 5, end: 8, typed: 'fea' });
    expect(wordAtCaret('main|feature\nfix', 8)).toEqual({ start: 5, end: 12, typed: 'fea' });
    expect(wordAtCaret('main\n', 5)).toEqual({ start: 5, end: 5, typed: '' });
    expect(wordAtCaret('  ma', 4)).toEqual({ start: 0, end: 4, typed: 'ma' });
  });
});

describe('fieldValues', () => {
  it('reads values by line and by bar, trimmed, each once, in order', () => {
    expect(fieldValues('main\nfeature/orders-v2\n')).toEqual(['main', 'feature/orders-v2']);
    expect(fieldValues('HEAD | main|origin/main')).toEqual(['HEAD', 'main', 'origin/main']);
    expect(fieldValues('main\n\n  \nmain|fix/probe-timeout')).toEqual(['main', 'fix/probe-timeout']);
    expect(fieldValues('  \n')).toEqual([]);
  });
});

describe('fieldSuggestions', () => {
  it('offers nothing until a word is typed', () => {
    expect(fieldSuggestions('', 0, names)).toEqual([]);
    expect(fieldSuggestions('main\n', 5, names)).toEqual([]);
  });

  it('lists the names that hold the word, case aside — those that begin with it first', () => {
    expect(fieldSuggestions('ma', 2, names)).toEqual(['main', 'origin/main']);
    expect(fieldSuggestions('FEA', 3, names)).toEqual(['feature/auth-headers', 'feature/orders-v2']);
    expect(fieldSuggestions('he', 2, names)).toEqual(['HEAD', 'feature/auth-headers']);
    expect(fieldSuggestions('zzz', 3, names)).toEqual([]);
  });

  it('leaves out a name the text already holds elsewhere', () => {
    expect(fieldSuggestions('main\nma', 7, names)).toEqual(['origin/main']);
    expect(fieldSuggestions('ma|main', 2, names)).toEqual(['origin/main']);
    // The word itself, typed whole, is still offered.
    expect(fieldSuggestions('main', 4, names)).toEqual(['main', 'origin/main']);
  });
});

describe('withSuggestion', () => {
  it('writes the pick over the word and puts the caret on a new line', () => {
    expect(withSuggestion('fea', 3, 'feature/orders-v2')).toEqual({ text: 'feature/orders-v2\n', caret: 18 });
    expect(withSuggestion('main\nfi', 7, 'fix/probe-timeout')).toEqual({
      text: 'main\nfix/probe-timeout\n',
      caret: 23,
    });
  });

  it('replaces the whole word the caret stands in and keeps what follows', () => {
    expect(withSuggestion('feature\nmain', 3, 'feature/orders-v2')).toEqual({
      text: 'feature/orders-v2\nmain',
      caret: 18,
    });
    expect(withSuggestion('main|or', 7, 'origin/main')).toEqual({ text: 'main|origin/main\n', caret: 17 });
  });
});

describe('unknownValues', () => {
  it('names the values that are no ref and not HEAD', () => {
    expect(unknownValues(['HEAD', 'main', 'origin/main'], names)).toEqual([]);
    expect(unknownValues(['main', 'mian', 'main~1'], names)).toEqual(['mian', 'main~1']);
  });
});

describe('without the bar (paths)', () => {
  it('takes a line break alone for a separator — a bar is part of a value', () => {
    expect(fieldValues('docs/a|b.md\nnotes/orders.md\n', false)).toEqual(['docs/a|b.md', 'notes/orders.md']);
    expect(wordAtCaret('docs/a|b', 8, false)).toEqual({ start: 0, end: 8, typed: 'docs/a|b' });
    expect(fieldSuggestions('no|te', 5, ['no|tes/orders.md', 'notes'], false)).toEqual(['no|tes/orders.md']);
    expect(withSuggestion('docs\nno', 7, 'notes/orders.md', false)).toEqual({
      text: 'docs\nnotes/orders.md\n',
      caret: 21,
    });
  });
});

describe('withRecentValues', () => {
  it('leads with the scope just applied', () => {
    expect(withRecentValues([], ['main'])).toEqual([['main']]);
    expect(withRecentValues([['main']], ['HEAD', 'main'])).toEqual([['HEAD', 'main'], ['main']]);
  });

  it('lists a scope applied again once, in front', () => {
    const recent = [['HEAD', 'main'], ['main'], ['feature/orders-v2']];
    expect(withRecentValues(recent, ['main'])).toEqual([['main'], ['HEAD', 'main'], ['feature/orders-v2']]);
    // The same values in another order are another list: a chip and the tab read them in order.
    expect(withRecentValues([['HEAD', 'main']], ['main', 'HEAD'])).toEqual([
      ['main', 'HEAD'],
      ['HEAD', 'main'],
    ]);
  });

  it('keeps five — the oldest falls off', () => {
    const recent = [['e'], ['d'], ['c'], ['b'], ['a']];
    expect(withRecentValues(recent, ['f'])).toEqual([['f'], ['e'], ['d'], ['c'], ['b']]);
  });
});

describe('sameValues', () => {
  it('holds for the same values in the same order alone', () => {
    expect(sameValues(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameValues(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameValues(['a'], ['a', 'b'])).toBe(false);
    expect(sameValues([], [])).toBe(true);
  });
});
