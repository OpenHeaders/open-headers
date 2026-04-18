import { describe, expect, it } from 'vitest';
import { extractUid, generateUid, slugify, toFolderName } from '../../src/utils/workspace';

describe('generateUid', () => {
  it('produces 8 lowercase-alphanumeric chars', () => {
    for (let i = 0; i < 100; i++) {
      const uid = generateUid();
      expect(uid).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  it('is random across invocations', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateUid());
    expect(set.size).toBeGreaterThan(990);
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('My Rules')).toBe('my-rules');
    expect(slugify('Bearer Token')).toBe('bearer-token');
  });

  it('strips diacritics', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('naïve résumé')).toBe('naive-resume');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('foo!!!bar  baz')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello');
    expect(slugify('---foo---')).toBe('foo');
  });

  it('caps at 40 chars and trims trailing hyphen after truncation', () => {
    const long = 'a'.repeat(80);
    expect(slugify(long)).toBe('a'.repeat(40));
    const withHyphen = `${'a'.repeat(39)} x extra`;
    // 39 a's + '-' at position 40 → trailing hyphen stripped
    expect(slugify(withHyphen)).toBe('a'.repeat(39));
  });

  it('returns empty for input with no alphanumerics', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('handles emoji and symbols', () => {
    expect(slugify('🚀 Rocket')).toBe('rocket');
  });
});

describe('toFolderName', () => {
  it('joins slug and uid with a hyphen', () => {
    expect(toFolderName('Login', 'x7k2abcd')).toBe('login-x7k2abcd');
  });

  it('falls back to uid-only when slug is empty', () => {
    expect(toFolderName('!!!', 'x7k2abcd')).toBe('x7k2abcd');
  });
});

describe('extractUid', () => {
  it('extracts an 8-char uid suffix', () => {
    expect(extractUid('login-x7k2abcd')).toBe('x7k2abcd');
    expect(extractUid('my-very-long-slug-name-abc12345')).toBe('abc12345');
  });

  it('returns the input unchanged when no 8-char uid suffix exists', () => {
    expect(extractUid('no-uid-here')).toBe('no-uid-here');
    expect(extractUid('shorty-abc')).toBe('shorty-abc');
    expect(extractUid('uppercase-ABCDEFGH')).toBe('uppercase-ABCDEFGH');
  });
});
