import {
  hasCascadeQueryError,
  matchesCascadeQuery,
  parseCascadeQuery,
} from '@openheaders/ui/panel/data/cascade/cascade-filter';
import type { InitiatorRowMeta } from '@openheaders/ui/panel/data/initiator/initiator-row-meta';
import { DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function meta(over: Partial<InitiatorRowMeta>): InitiatorRowMeta {
  return {
    resourceType: 'script',
    initiatorType: 'parser',
    sizeBytes: 1024,
    durationMs: 100,
    statusCode: 200,
    isThirdParty: false,
    isFailed: false,
    ...over,
  };
}

describe('parseCascadeQuery / matchesCascadeQuery', () => {
  it('passes when query is empty', () => {
    const tokens = parseCascadeQuery('');
    expect(matchesCascadeQuery('https://openheaders.io/a', meta({}), tokens)).toBe(true);
  });

  it('matches by URL substring (case-insensitive)', () => {
    const tokens = parseCascadeQuery('LIB');
    expect(matchesCascadeQuery('https://cdn.example.com/lib.js', meta({}), tokens)).toBe(true);
    expect(matchesCascadeQuery('https://openheaders.io/app.js', meta({}), tokens)).toBe(false);
  });

  it('supports negation with leading dash', () => {
    const tokens = parseCascadeQuery('-cdn');
    expect(matchesCascadeQuery('https://cdn.example.com/lib.js', meta({}), tokens)).toBe(false);
    expect(matchesCascadeQuery('https://openheaders.io/app.js', meta({}), tokens)).toBe(true);
  });

  it('matches is:failed', () => {
    const tokens = parseCascadeQuery('is:failed');
    expect(matchesCascadeQuery('x', meta({ isFailed: true }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ isFailed: false }), tokens)).toBe(false);
  });

  it('matches is:third-party', () => {
    const tokens = parseCascadeQuery('is:third-party');
    expect(matchesCascadeQuery('x', meta({ isThirdParty: true }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ isThirdParty: false }), tokens)).toBe(false);
  });

  it('matches type:js via resource-type aliases', () => {
    const tokens = parseCascadeQuery('type:js');
    expect(matchesCascadeQuery('x', meta({ resourceType: 'script' }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ resourceType: 'stylesheet' }), tokens)).toBe(false);
  });

  it('matches status:404 exactly', () => {
    const tokens = parseCascadeQuery('status:404');
    expect(matchesCascadeQuery('x', meta({ statusCode: 404 }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ statusCode: 200 }), tokens)).toBe(false);
  });

  it('matches size:>NkB with comparator', () => {
    const tokens = parseCascadeQuery('size:>50kb');
    expect(matchesCascadeQuery('x', meta({ sizeBytes: 100 * 1024 }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ sizeBytes: 10 * 1024 }), tokens)).toBe(false);
  });

  it('combines multiple tokens with AND', () => {
    const tokens = parseCascadeQuery('type:js is:third-party');
    expect(matchesCascadeQuery('x', meta({ resourceType: 'script', isThirdParty: true }), tokens)).toBe(true);
    expect(matchesCascadeQuery('x', meta({ resourceType: 'script', isThirdParty: false }), tokens)).toBe(false);
    expect(matchesCascadeQuery('x', meta({ resourceType: 'stylesheet', isThirdParty: true }), tokens)).toBe(false);
  });

  it('honours Match Case and Whole Word', () => {
    const caseSensitive = parseCascadeQuery('LIB', { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true });
    expect(matchesCascadeQuery('https://cdn.example.com/lib.js', meta({}), caseSensitive)).toBe(false);
    const wholeWord = parseCascadeQuery('lib', { ...DEFAULT_TEXT_MATCH_CONFIG, wholeWord: true });
    expect(matchesCascadeQuery('https://cdn.example.com/lib.js', meta({}), wholeWord)).toBe(true);
    expect(matchesCascadeQuery('https://cdn.example.com/library.js', meta({}), wholeWord)).toBe(false);
  });

  it('regex mode tests one pattern against the URL', () => {
    const tokens = parseCascadeQuery('cdn\\..*\\.js$', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(hasCascadeQueryError(tokens)).toBe(false);
    expect(matchesCascadeQuery('https://cdn.example.com/lib.js', meta({}), tokens)).toBe(true);
    expect(matchesCascadeQuery('https://openheaders.io/app.css', meta({}), tokens)).toBe(false);
  });

  it('flags a broken regex-mode pattern and matches every row', () => {
    const tokens = parseCascadeQuery('cdn(', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(hasCascadeQueryError(tokens)).toBe(true);
    expect(matchesCascadeQuery('https://openheaders.io/app.css', meta({}), tokens)).toBe(true);
  });
});
