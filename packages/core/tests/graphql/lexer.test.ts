/**
 * Lexer — the spec's lexical grammar. Pins the token table (every
 * punctuator, names, ints, floats, strings with the full escape set,
 * block strings through the indentation algorithm, the ignored tokens)
 * and the lexical error set with positions.
 */

import { dedentBlockString, positionAt, type Token, tokenize } from '@openheaders/core/graphql';
import { describe, expect, it } from 'vitest';

const kinds = (source: string): string[] =>
  tokenize(source)
    .tokens.filter((token) => token.kind !== 'eof')
    .map((token) => `${token.kind}:${token.value}`);

const errorOf = (source: string): { message: string; start: number; end: number } | null => tokenize(source).error;

describe('graphql lexer — tokens', () => {
  it('lexes every punctuator including the three-dot spread', () => {
    expect(kinds('! $ & ( ) ... : = @ [ ] { | }')).toEqual([
      'punct:!',
      'punct:$',
      'punct:&',
      'punct:(',
      'punct:)',
      'punct:...',
      'punct::',
      'punct:=',
      'punct:@',
      'punct:[',
      'punct:]',
      'punct:{',
      'punct:|',
      'punct:}',
    ]);
  });

  it('lexes names, ints and floats', () => {
    expect(kinds('query _x9 on 0 -1 42 1.5 -0.5 1e5 1E-5 2.5e+3')).toEqual([
      'name:query',
      'name:_x9',
      'name:on',
      'int:0',
      'int:-1',
      'int:42',
      'float:1.5',
      'float:-0.5',
      'float:1e5',
      'float:1E-5',
      'float:2.5e+3',
    ]);
  });

  it('ignores whitespace, commas, comments and the BOM', () => {
    expect(kinds('\uFEFF  a,\tb # a comment\r\n,,c')).toEqual(['name:a', 'name:b', 'name:c']);
  });

  it('decodes string escapes', () => {
    const [token] = tokenize('"a\\"b\\\\c\\/d\\b\\f\\n\\r\\t\\u00e9\\u{1F600}\\uD83D\\uDE00"').tokens;
    expect(token.kind).toBe('string');
    expect(token.value).toBe('a"b\\c/d\b\f\n\r\té\u{1F600}\u{1F600}');
  });

  it('records offsets on every token', () => {
    const tokens = tokenize('query Q { a }').tokens;
    expect(tokens.map((token: Token) => [token.value, token.start, token.end])).toEqual([
      ['query', 0, 5],
      ['Q', 6, 7],
      ['{', 8, 9],
      ['a', 10, 11],
      ['}', 12, 13],
      ['', 13, 13],
    ]);
  });
});

describe('graphql lexer — block strings', () => {
  it('removes common indentation and blank edge lines', () => {
    const source = '"""\n    Hello,\n      World!\n\n    Yours,\n      GraphQL.\n  """';
    expect(tokenize(source).tokens[0].value).toBe('Hello,\n  World!\n\nYours,\n  GraphQL.');
  });

  it('keeps the first line verbatim when it holds text', () => {
    expect(tokenize('"""first\n    second\n  """').tokens[0].value).toBe('first\nsecond');
  });

  it('unescapes the triple-quote escape', () => {
    expect(tokenize('"""a \\""" b"""').tokens[0].value).toBe('a """ b');
  });

  it('normalizes CRLF line endings', () => {
    expect(dedentBlockString('\r\n  a\r\n  b\r\n')).toBe('a\nb');
  });

  it('yields the empty string for a whitespace-only block', () => {
    expect(tokenize('"""\n   \n"""').tokens[0].value).toBe('');
  });
});

describe('graphql lexer — errors', () => {
  it.each([
    ['"unterminated', 'Unterminated string.', 0],
    ['"line\nbreak"', 'Unterminated string.', 0],
    ['"""open', 'Unterminated block string.', 0],
    ['01', 'Invalid number — unexpected digit after 0: `1`.', 1],
    ['1.', 'Invalid number — expected a digit but found end of input.', 2],
    ['1.e5', 'Invalid number — expected a digit but found the character `e`.', 2],
    ['1a', 'Invalid number — expected a digit but found the character `a`.', 1],
    ['1.2.3', 'Invalid number — expected a digit but found the character `.`.', 3],
    ['-', 'Invalid number — expected a digit but found end of input.', 1],
    ['.5', 'Unexpected `.` — did you mean `...`?', 0],
    ['"\\x"', 'Invalid escape sequence: `\\x`.', 1],
    ['"\\u12"', 'Invalid Unicode escape sequence.', 1],
    ['"\\u{110000}"', 'Invalid Unicode escape sequence.', 1],
    ['"\\uD800"', 'Invalid Unicode escape sequence.', 1],
    ['a ^ b', 'Unexpected the character `^`.', 2],
    ['"a\u0001b"', 'Invalid character within a string: the character U+0001.', 2],
  ])('reports %j', (source, message, start) => {
    const error = errorOf(source);
    expect(error).not.toBeNull();
    expect(error?.message).toBe(message);
    expect(error?.start).toBe(start);
  });

  it('keeps the tokens lexed before the error', () => {
    const result = tokenize('query Q "oops');
    expect(result.tokens.map((token) => token.value)).toEqual(['query', 'Q']);
    expect(result.error?.message).toBe('Unterminated string.');
  });
});

describe('positionAt', () => {
  it('derives 1-based line and column across LF and CRLF', () => {
    const source = 'ab\ncd\r\nef';
    expect(positionAt(source, 0)).toEqual({ line: 1, column: 1 });
    expect(positionAt(source, 4)).toEqual({ line: 2, column: 2 });
    expect(positionAt(source, 7)).toEqual({ line: 3, column: 1 });
    expect(positionAt(source, 99)).toEqual({ line: 3, column: 93 });
  });
});
