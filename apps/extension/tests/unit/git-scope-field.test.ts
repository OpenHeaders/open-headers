/**
 * scope-field (S66): the Branch filter's Select… field as text — the
 * word under the caret, the refs it could become, a pick written over
 * it with the caret on a new line, the values a finished text names and
 * the ones that are no ref.
 */

import {
  scopeFieldSuggestions,
  scopeFieldValues,
  unknownScopeValues,
  withSuggestion,
  wordAtCaret,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/scope-field';
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

describe('scopeFieldValues', () => {
  it('reads values by line and by bar, trimmed, each once, in order', () => {
    expect(scopeFieldValues('main\nfeature/orders-v2\n')).toEqual(['main', 'feature/orders-v2']);
    expect(scopeFieldValues('HEAD | main|origin/main')).toEqual(['HEAD', 'main', 'origin/main']);
    expect(scopeFieldValues('main\n\n  \nmain|fix/probe-timeout')).toEqual(['main', 'fix/probe-timeout']);
    expect(scopeFieldValues('  \n')).toEqual([]);
  });
});

describe('scopeFieldSuggestions', () => {
  it('offers nothing until a word is typed', () => {
    expect(scopeFieldSuggestions('', 0, names)).toEqual([]);
    expect(scopeFieldSuggestions('main\n', 5, names)).toEqual([]);
  });

  it('lists the names that hold the word, case aside — those that begin with it first', () => {
    expect(scopeFieldSuggestions('ma', 2, names)).toEqual(['main', 'origin/main']);
    expect(scopeFieldSuggestions('FEA', 3, names)).toEqual(['feature/auth-headers', 'feature/orders-v2']);
    expect(scopeFieldSuggestions('he', 2, names)).toEqual(['HEAD', 'feature/auth-headers']);
    expect(scopeFieldSuggestions('zzz', 3, names)).toEqual([]);
  });

  it('leaves out a name the text already holds elsewhere', () => {
    expect(scopeFieldSuggestions('main\nma', 7, names)).toEqual(['origin/main']);
    expect(scopeFieldSuggestions('ma|main', 2, names)).toEqual(['origin/main']);
    // The word itself, typed whole, is still offered.
    expect(scopeFieldSuggestions('main', 4, names)).toEqual(['main', 'origin/main']);
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

describe('unknownScopeValues', () => {
  it('names the values that are no ref and not HEAD', () => {
    expect(unknownScopeValues(['HEAD', 'main', 'origin/main'], names)).toEqual([]);
    expect(unknownScopeValues(['main', 'mian', 'main~1'], names)).toEqual(['mian', 'main~1']);
  });
});
