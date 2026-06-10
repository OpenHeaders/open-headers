/**
 * `cdp-body-synth` — pure projection of a fetched CDP response body into
 * `InspectorHarBody`, plus the size cap.
 */

import { describe, expect, it } from 'vitest';

import {
  type CdpBodySourceRequest,
  cdpBodyToHarBody,
  emptyCdpHarBody,
  isTextMimeType,
  MAX_CDP_RESPONSE_BODY_CHARS,
  streamedCdpBodyToHarBody,
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

describe('isTextMimeType', () => {
  it.each([
    'text/html',
    'text/plain',
    'multipart/form-data',
    'application/json',
    'application/manifest+json',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/javascript',
    'application/x-javascript',
  ])('treats %s as text', (mime) => {
    expect(isTextMimeType(mime)).toBe(true);
  });

  it.each([
    'image/png',
    'application/octet-stream',
    'font/woff2',
    'video/mp4',
    'application/wasm',
  ])('treats %s as binary', (mime) => {
    expect(isTextMimeType(mime)).toBe(false);
  });
});

describe('streamedCdpBodyToHarBody', () => {
  // 'PCFkb2N0eXBlIGh0bWw+' === base64('<!doctype html>')
  const HTML_B64 = 'PCFkb2N0eXBlIGh0bWw+';

  it('decodes a text-MIME buffered body to text (empty encoding)', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, HTML_B64, 'text/html', 'utf-8');
    expect(body.content).toBe('<!doctype html>');
    expect(body.encoding).toBe('');
  });

  it('decodes multibyte UTF-8 correctly', () => {
    // 'Z3LDvG4=' === base64(utf8('grün'))
    const body = streamedCdpBodyToHarBody(SOURCE, 'Z3LDvG4=', 'text/plain', undefined);
    expect(body.content).toBe('grün');
  });

  it('falls back to UTF-8 on an unknown charset label', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, HTML_B64, 'text/html', 'no-such-charset');
    expect(body.content).toBe('<!doctype html>');
    expect(body.encoding).toBe('');
  });

  it('keeps a non-text MIME body as base64', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, 'AQID', 'image/png', undefined);
    expect(body.content).toBe('AQID');
    expect(body.encoding).toBe('base64');
  });

  it('keeps an unknown-MIME body as base64 (no response seen yet)', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, 'AQID', undefined, undefined);
    expect(body.content).toBe('AQID');
    expect(body.encoding).toBe('base64');
  });

  it('keeps a malformed base64 text-MIME body as base64 rather than corrupting it', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, '!!!not-base64!!!', 'text/html', 'utf-8');
    expect(body.content).toBe('!!!not-base64!!!');
    expect(body.encoding).toBe('base64');
  });

  it('truncates over-cap decoded text to the head', () => {
    // 'YWJjZGVmZ2hpag==' === base64('abcdefghij')
    const body = streamedCdpBodyToHarBody(SOURCE, 'YWJjZGVmZ2hpag==', 'text/plain', undefined, 8);
    expect(body.content).toBe('abcdefgh');
    expect(body.encoding).toBe('');
  });

  it('drops an over-cap binary body to empty (a truncated base64 string is unusable)', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, 'QUJDREVG', 'image/png', undefined, 4);
    expect(body.content).toBe('');
    expect(body.encoding).toBe('');
  });

  it('carries the source request fields for context', () => {
    const body = streamedCdpBodyToHarBody(SOURCE, HTML_B64, 'text/html', 'utf-8');
    expect(body.method).toBe('GET');
    expect(body.url).toBe('https://api.openheaders.io/data');
    expect(body.startedDateTime).toBe('2026-06-05T12:00:00.000Z');
  });
});
