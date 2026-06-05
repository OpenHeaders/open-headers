/**
 * `cdp-body-synth` — pure projection of a fetched CDP response body into
 * `InspectorHarBody`, plus the size cap.
 */

import { describe, expect, it } from 'vitest';

import {
  type CdpBodySourceRequest,
  cdpBodyToHarBody,
  emptyCdpHarBody,
  MAX_CDP_RESPONSE_BODY_CHARS,
} from '../../src/correlator-cdp/cdp-body-synth';

const SOURCE: CdpBodySourceRequest = {
  method: 'GET',
  url: 'https://api.openheaders.io/data',
  startedDateTime: '2026-06-05T12:00:00.000Z',
};

describe('cdpBodyToHarBody', () => {
  it('maps a text body to empty encoding, content verbatim', () => {
    const body = cdpBodyToHarBody(SOURCE, { body: '{"ok":true}', base64Encoded: false });
    expect(body).toEqual({
      method: 'GET',
      url: 'https://api.openheaders.io/data',
      startedDateTime: '2026-06-05T12:00:00.000Z',
      content: '{"ok":true}',
      encoding: '',
    });
  });

  it('maps a base64 body to base64 encoding', () => {
    const body = cdpBodyToHarBody(SOURCE, { body: 'AQID', base64Encoded: true });
    expect(body.encoding).toBe('base64');
    expect(body.content).toBe('AQID');
  });

  it('carries the source request fields for context', () => {
    const body = cdpBodyToHarBody(SOURCE, { body: '', base64Encoded: false });
    expect(body.method).toBe('GET');
    expect(body.url).toBe('https://api.openheaders.io/data');
    expect(body.startedDateTime).toBe('2026-06-05T12:00:00.000Z');
  });

  it('truncates over-cap text to the head', () => {
    const cap = 8;
    const body = cdpBodyToHarBody(SOURCE, { body: 'abcdefghij', base64Encoded: false }, cap);
    expect(body.content).toBe('abcdefgh');
    expect(body.content.length).toBe(cap);
    expect(body.encoding).toBe('');
  });

  it('keeps text exactly at the cap intact', () => {
    const cap = 5;
    const body = cdpBodyToHarBody(SOURCE, { body: 'abcde', base64Encoded: false }, cap);
    expect(body.content).toBe('abcde');
  });

  it('drops over-cap binary to an empty body (a truncated base64 string is unusable)', () => {
    const cap = 4;
    const body = cdpBodyToHarBody(SOURCE, { body: 'QUJDREVG', base64Encoded: true }, cap);
    expect(body.content).toBe('');
    expect(body.encoding).toBe('');
  });

  it('defaults the cap generously (does not trim a routine body)', () => {
    const big = 'x'.repeat(1_000_000);
    const body = cdpBodyToHarBody(SOURCE, { body: big, base64Encoded: false });
    expect(body.content).toBe(big);
    expect(MAX_CDP_RESPONSE_BODY_CHARS).toBeGreaterThan(big.length);
  });
});

describe('emptyCdpHarBody', () => {
  it('produces an empty body that carries the source fields', () => {
    expect(emptyCdpHarBody(SOURCE)).toEqual({
      method: 'GET',
      url: 'https://api.openheaders.io/data',
      startedDateTime: '2026-06-05T12:00:00.000Z',
      content: '',
      encoding: '',
    });
  });
});
