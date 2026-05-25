/**
 * `cors-classifier` — pure CORS header extraction + verdict computation.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyCors,
  extractHeader,
  isCrossOrigin,
} from '../../src/correlator-heuristic/cors-classifier';
import type { WebRequestHeader } from '../../src/correlator-heuristic/events';

describe('extractHeader', () => {
  it('returns null when headers are absent', () => {
    expect(extractHeader(undefined, 'Origin')).toBeNull();
  });

  it('returns null when the header is not present', () => {
    const headers: WebRequestHeader[] = [{ name: 'Content-Type', value: 'application/json' }];
    expect(extractHeader(headers, 'Origin')).toBeNull();
  });

  it('matches case-insensitively', () => {
    const headers: WebRequestHeader[] = [{ name: 'origin', value: 'https://app.openheaders.io' }];
    expect(extractHeader(headers, 'Origin')).toBe('https://app.openheaders.io');
  });

  it('returns null when the header carries no value', () => {
    const headers: WebRequestHeader[] = [{ name: 'Origin' }];
    expect(extractHeader(headers, 'Origin')).toBeNull();
  });

  it('returns the empty string when the value is intentionally empty', () => {
    const headers: WebRequestHeader[] = [{ name: 'Origin', value: '' }];
    expect(extractHeader(headers, 'Origin')).toBe('');
  });
});

describe('isCrossOrigin', () => {
  const requestUrl = 'https://api.openheaders.io/v1/widgets';

  it('returns false for a null origin', () => {
    expect(isCrossOrigin(null, requestUrl)).toBe(false);
  });

  it('returns false for the literal "null" sandbox origin', () => {
    expect(isCrossOrigin('null', requestUrl)).toBe(false);
  });

  it('returns false for a same-origin request', () => {
    expect(isCrossOrigin('https://api.openheaders.io', requestUrl)).toBe(false);
  });

  it('returns true when scheme differs', () => {
    expect(isCrossOrigin('http://api.openheaders.io', requestUrl)).toBe(true);
  });

  it('returns true when host differs', () => {
    expect(isCrossOrigin('https://app.openheaders.io', requestUrl)).toBe(true);
  });

  it('returns true when port differs', () => {
    expect(isCrossOrigin('https://api.openheaders.io:8443', requestUrl)).toBe(true);
  });

  it('returns false when origin is malformed', () => {
    expect(isCrossOrigin('not-a-url', requestUrl)).toBe(false);
  });
});

describe('classifyCors', () => {
  const requestUrl = 'https://api.openheaders.io/x';

  it('same-origin: returns no-rejection', () => {
    expect(classifyCors({ origin: 'https://api.openheaders.io', requestUrl, acao: null })).toEqual({
      isCrossOrigin: false,
      rejection: { kind: 'no-rejection' },
    });
  });

  it('cross-origin + missing ACAO: missing-acao', () => {
    expect(classifyCors({ origin: 'https://app.openheaders.io', requestUrl, acao: null })).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'missing-acao' },
    });
  });

  it('cross-origin + ACAO=* : no-rejection', () => {
    expect(classifyCors({ origin: 'https://app.openheaders.io', requestUrl, acao: '*' })).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'no-rejection' },
    });
  });

  it('cross-origin + ACAO=origin : no-rejection', () => {
    expect(
      classifyCors({
        origin: 'https://app.openheaders.io',
        requestUrl,
        acao: 'https://app.openheaders.io',
      }),
    ).toEqual({ isCrossOrigin: true, rejection: { kind: 'no-rejection' } });
  });

  it('cross-origin + ACAO=other: origin-mismatch surfaces the offending acao', () => {
    expect(
      classifyCors({
        origin: 'https://app.openheaders.io',
        requestUrl,
        acao: 'https://other.openheaders.io',
      }),
    ).toEqual({
      isCrossOrigin: true,
      rejection: { kind: 'origin-mismatch', acao: 'https://other.openheaders.io' },
    });
  });

  it('null sandbox origin treated as same-origin (no rejection)', () => {
    expect(classifyCors({ origin: 'null', requestUrl, acao: null })).toEqual({
      isCrossOrigin: false,
      rejection: { kind: 'no-rejection' },
    });
  });
});
