/**
 * `webrequest-har-synth` — pure shaping of webRequest wire facts into a
 * partial `InspectorHarEntry` for the hop slot.
 */

import { describe, expect, it } from 'vitest';

import {
  type PartialHarResponse,
  type PartialHarSeed,
  partialHarEntry,
} from '../../src/correlator-heuristic/webrequest-har-synth';

const STARTED_AT_MS = 1_700_000_000_000;

const SEED: PartialHarSeed = {
  startedAtMs: STARTED_AT_MS,
  method: 'GET',
  url: 'https://api.openheaders.io/users?page=2',
  requestHeaders: [
    { name: 'Accept', value: 'text/html' },
    { name: 'Cookie', value: 'sid=abc; theme=dark' },
  ],
};

const RESPONSE: PartialHarResponse = {
  statusCode: 200,
  statusLine: 'HTTP/1.1 200 OK',
  responseHeaders: [
    { name: 'Content-Type', value: 'text/html; charset=utf-8' },
    { name: 'Set-Cookie', value: 'a=1; Path=/' },
    { name: 'Set-Cookie', value: 'b=2; HttpOnly' },
  ],
  resourceType: 'main_frame',
};

describe('partialHarEntry — headers-received shape (no terminal)', () => {
  const har = partialHarEntry(SEED, RESPONSE);

  it('carries the wire request and response headers', () => {
    expect(har.request?.headers).toEqual([
      { name: 'Accept', value: 'text/html' },
      { name: 'Cookie', value: 'sid=abc; theme=dark' },
    ]);
    expect(har.response?.headers).toEqual([
      { name: 'Content-Type', value: 'text/html; charset=utf-8' },
      { name: 'Set-Cookie', value: 'a=1; Path=/' },
      { name: 'Set-Cookie', value: 'b=2; HttpOnly' },
    ]);
  });

  it('parses status text and http version from the status line', () => {
    expect(har.response?.status).toBe(200);
    expect(har.response?.statusText).toBe('OK');
    expect(har.response?.httpVersion).toBe('HTTP/1.1');
    expect(har.request?.httpVersion).toBe('HTTP/1.1');
  });

  it('stamps both header sections as pre-rewrite (raw) captures', () => {
    expect(har._ohHeaderCapture).toEqual({ request: 'raw', response: 'raw' });
  });

  it('parses cookies from both header sets, each Set-Cookie line its own entry', () => {
    expect(har.request?.cookies).toEqual([
      { name: 'sid', value: 'abc' },
      { name: 'theme', value: 'dark' },
    ]);
    expect(har.response?.cookies).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });

  it('derives the bare mime type and the query string', () => {
    expect(har.response?.content.mimeType).toBe('text/html');
    expect(har.request?.queryString).toEqual([{ name: 'page', value: '2' }]);
  });

  it('maps the webRequest type onto the HAR resource-type vocabulary', () => {
    expect(har._resourceType).toBe('document');
    expect(partialHarEntry(SEED, { ...RESPONSE, resourceType: 'xmlhttprequest' })._resourceType).toBe('xhr');
    expect(partialHarEntry(SEED, { ...RESPONSE, resourceType: 'stylesheet' })._resourceType).toBe('stylesheet');
  });

  it('reports no invented sizes and no timings', () => {
    expect(har.response?._transferSize).toBeUndefined();
    expect(har.response?.content.size).toBe(0);
    expect(har.request?.headersSize).toBe(-1);
    expect(har.response?.bodySize).toBe(-1);
    expect(har.timings).toBeUndefined();
    expect(har.time).toBeUndefined();
  });

  it('stamps the hop start as startedDateTime and leaves the terminal fields clean', () => {
    expect(har.startedDateTime).toBe(new Date(STARTED_AT_MS).toISOString());
    expect(har.serverIPAddress).toBe('');
    expect(har.response?._error).toBeNull();
  });

  it('reads the redirect target from the Location header', () => {
    const redirect = partialHarEntry(SEED, {
      statusCode: 302,
      statusLine: 'HTTP/1.1 302 Found',
      responseHeaders: [{ name: 'Location', value: 'https://app.openheaders.io/next' }],
      resourceType: 'main_frame',
    });
    expect(redirect.response?.redirectURL).toBe('https://app.openheaders.io/next');
    expect(har.response?.redirectURL).toBe('');
  });
});

describe('partialHarEntry — terminal refinement', () => {
  it('adds the server ip, the failure code, and the total time', () => {
    const har = partialHarEntry(SEED, RESPONSE, {
      completedAtMs: STARTED_AT_MS + 1_700,
      ip: '140.82.121.4',
      error: 'net::ERR_ABORTED',
    });
    expect(har.serverIPAddress).toBe('140.82.121.4');
    expect(har.response?._error).toBe('net::ERR_ABORTED');
    expect(har.time).toBe(1_700);
  });

  it('a clean completion carries no error and clamps a negative span to zero', () => {
    const har = partialHarEntry(SEED, RESPONSE, { completedAtMs: STARTED_AT_MS - 5 });
    expect(har.response?._error).toBeNull();
    expect(har.time).toBe(0);
  });
});

describe('partialHarEntry — degenerate inputs', () => {
  it('tolerates a missing status line and missing header sets', () => {
    const har = partialHarEntry(
      { startedAtMs: STARTED_AT_MS, method: 'GET', url: 'https://api.openheaders.io/x' },
      { statusCode: 200, resourceType: 'image' },
    );
    expect(har.response?.statusText).toBe('');
    expect(har.response?.httpVersion).toBeUndefined();
    expect(har.request?.headers).toEqual([]);
    expect(har.response?.headers).toEqual([]);
    expect(har.request?.cookies).toBeUndefined();
    expect(har.response?.content.mimeType).toBe('');
  });
});
