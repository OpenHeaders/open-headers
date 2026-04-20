/**
 * HAR import — parser coverage.
 *
 * Exercises each supported field, each documented drop/transform, and
 * the common failure modes (malformed JSON, missing `log`, noise
 * entries that should be skipped without failing the whole import).
 */

import { describe, expect, it } from 'vitest';
import { HarParseError, parseHar, selectHarEntries } from '../../src/import/har';

/** Build a minimal valid HAR 1.2 file with the given entries. */
function harFile(entries: unknown[]): string {
  return JSON.stringify({ log: { version: '1.2', creator: { name: 't', version: '1' }, entries } });
}

/** Build a minimal valid request entry for the HAR schema. */
function harEntry(request: Record<string, unknown>): Record<string, unknown> {
  return { request };
}

describe('parseHar — top-level shape', () => {
  it('throws on malformed JSON', () => {
    expect(() => parseHar('{not json')).toThrow(HarParseError);
  });

  it('throws on a non-object root', () => {
    expect(() => parseHar('[]')).toThrow(HarParseError);
  });

  it('throws when `log` is missing', () => {
    expect(() => parseHar('{}')).toThrow(HarParseError);
  });

  it('accepts an empty entries array', () => {
    const { entries, report } = parseHar(harFile([]));
    expect(entries).toEqual([]);
    expect(report.summary.imported).toBe(0);
  });
});

describe('parseHar — method + URL', () => {
  it('parses a simple GET', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io/v1/ping',
          headers: [],
          queryString: [],
        }),
      ]),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].request.method).toBe('GET');
    expect(entries[0].request.url).toBe('https://api.openheaders.io/v1/ping');
  });

  it('normalizes method casing', () => {
    const { entries } = parseHar(
      harFile([harEntry({ method: 'post', url: 'https://api.openheaders.io', headers: [] })]),
    );
    expect(entries[0].request.method).toBe('POST');
  });

  it('records a drop + defaults to GET when the method is unknown', () => {
    const { entries, report } = parseHar(
      harFile([harEntry({ method: 'PURGE', url: 'https://api.openheaders.io', headers: [] })]),
    );
    expect(entries[0].request.method).toBe('GET');
    expect(report.drops.some((d) => d.reason.includes('Unknown HTTP method'))).toBe(true);
  });

  it('skips entries with no URL (logged as drops, not exceptions)', () => {
    const { entries, report } = parseHar(
      harFile([
        harEntry({ method: 'GET', url: '', headers: [] }),
        harEntry({ method: 'GET', url: 'https://api.openheaders.io', headers: [] }),
      ]),
    );
    expect(entries).toHaveLength(1);
    expect(report.summary.imported).toBe(1);
    expect(report.drops.some((d) => d.reason.includes('no URL'))).toBe(true);
  });

  it('skips entries that are missing the request field', () => {
    const { entries, report } = parseHar(harFile([{ response: {} }]));
    expect(entries).toEqual([]);
    expect(report.drops.some((d) => d.reason.includes('missing the `request` field'))).toBe(true);
  });
});

describe('parseHar — query params', () => {
  it('extracts params from the URL and ignores structured duplicates', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io/search?q=hi&page=2',
          headers: [],
          queryString: [
            { name: 'q', value: 'hi' },
            { name: 'page', value: '2' },
          ],
        }),
      ]),
    );
    expect(entries[0].request.params).toEqual([
      { key: 'q', value: 'hi' },
      { key: 'page', value: '2' },
    ]);
  });

  it('falls back to structured queryString when URL has no query part', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io/search',
          headers: [],
          queryString: [{ name: 'q', value: 'hi' }],
        }),
      ]),
    );
    expect(entries[0].request.params).toEqual([{ key: 'q', value: 'hi' }]);
  });

  it('logs a transform when structured entries contain keys the URL misses', () => {
    const { report } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io/search?q=hi',
          headers: [],
          queryString: [
            { name: 'q', value: 'hi' },
            { name: 'hidden', value: 'oops' },
          ],
        }),
      ]),
    );
    expect(report.transforms.some((t) => t.to.includes('derived from URL'))).toBe(true);
  });
});

describe('parseHar — headers', () => {
  it('keeps regular headers', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io',
          headers: [
            { name: 'accept', value: 'application/json' },
            { name: 'x-client', value: 'oh' },
          ],
        }),
      ]),
    );
    expect(entries[0].request.headers).toEqual([
      { key: 'accept', value: 'application/json' },
      { key: 'x-client', value: 'oh' },
    ]);
  });

  it('strips HTTP/2 pseudo-headers and records one aggregate transform', () => {
    const { entries, report } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io/v1',
          headers: [
            { name: ':method', value: 'GET' },
            { name: ':authority', value: 'api.openheaders.io' },
            { name: ':path', value: '/v1' },
            { name: ':scheme', value: 'https' },
            { name: 'accept', value: 'application/json' },
          ],
        }),
      ]),
    );
    expect(entries[0].request.headers).toEqual([{ key: 'accept', value: 'application/json' }]);
    expect(report.transforms.some((t) => t.from.includes('pseudo-header'))).toBe(true);
  });
});

describe('parseHar — auth promotion', () => {
  it('promotes Authorization: Bearer to auth.bearer', () => {
    const { entries, report } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io',
          headers: [{ name: 'Authorization', value: 'Bearer xyz.abc' }],
        }),
      ]),
    );
    expect(entries[0].request.auth).toEqual({ type: 'bearer', token: 'xyz.abc' });
    expect(entries[0].request.headers.find((h) => h.key.toLowerCase() === 'authorization')).toBeUndefined();
    expect(report.transforms.some((t) => t.to === 'auth.bearer')).toBe(true);
  });

  it('promotes Authorization: Basic to auth.basic', () => {
    const encoded = `Basic ${Buffer.from('alice:s3cret').toString('base64')}`;
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io',
          headers: [{ name: 'Authorization', value: encoded }],
        }),
      ]),
    );
    expect(entries[0].request.auth).toEqual({ type: 'basic', username: 'alice', password: 's3cret' });
  });

  it('keeps an unparseable Authorization header as a raw header', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io',
          headers: [{ name: 'Authorization', value: 'Custom xyz' }],
        }),
      ]),
    );
    expect(entries[0].request.auth).toEqual({ type: 'none' });
    expect(entries[0].request.headers).toContainEqual({ key: 'Authorization', value: 'Custom xyz' });
  });
});

describe('parseHar — body', () => {
  it('maps JSON postData.text to body.json when the mime says so', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io/v1',
          headers: [{ name: 'content-type', value: 'application/json' }],
          postData: { mimeType: 'application/json', text: '{"a":1}' },
        }),
      ]),
    );
    expect(entries[0].request.body).toEqual({ type: 'json', content: '{"a":1}' });
  });

  it('maps form-urlencoded postData.text to body.form', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io/echo',
          headers: [{ name: 'content-type', value: 'application/x-www-form-urlencoded' }],
          postData: { mimeType: 'application/x-www-form-urlencoded', text: 'a=1&b=2' },
        }),
      ]),
    );
    expect(entries[0].request.body).toEqual({ type: 'form', content: 'a=1&b=2' });
  });

  it('synthesizes body.form from postData.params when text is missing', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io/echo',
          headers: [],
          postData: {
            mimeType: 'application/x-www-form-urlencoded',
            params: [
              { name: 'a', value: '1' },
              { name: 'b', value: 'hello world' },
            ],
          },
        }),
      ]),
    );
    expect(entries[0].request.body).toEqual({ type: 'form', content: 'a=1&b=hello%20world' });
  });

  it('reconciles multipart bodies into placeholder-file parts', () => {
    const { entries, report } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io/upload',
          headers: [{ name: 'content-type', value: 'multipart/form-data; boundary=x' }],
          postData: {
            mimeType: 'multipart/form-data; boundary=x',
            params: [
              { name: 'title', value: 'my photo' },
              { name: 'image', fileName: 'kitten.png', contentType: 'image/png' },
            ],
          },
        }),
      ]),
    );
    const body = entries[0].request.body;
    expect(body.type).toBe('multipart');
    expect(body.multipartParts).toEqual([
      { kind: 'text', name: 'title', value: 'my photo' },
      {
        kind: 'file',
        name: 'image',
        fileRefs: [
          {
            fileId: expect.stringMatching(/^placeholder:/),
            hash: expect.stringMatching(/^placeholder:/),
            filename: 'kitten.png',
            mimeType: 'image/png',
            size: 0,
          },
        ],
      },
    ]);
    expect(
      report.transforms.some(
        (t) => t.to === 'multipart with placeholder FileRefs' && t.tracking === '#todo-file-blobs',
      ),
    ).toBe(true);
  });

  it('maps XML body', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io',
          headers: [{ name: 'content-type', value: 'application/xml' }],
          postData: { mimeType: 'application/xml', text: '<x/>' },
        }),
      ]),
    );
    expect(entries[0].request.body).toEqual({ type: 'xml', content: '<x/>' });
  });

  it('falls back to body.text for unrecognized content types', () => {
    const { entries } = parseHar(
      harFile([
        harEntry({
          method: 'POST',
          url: 'https://api.openheaders.io',
          headers: [],
          postData: { mimeType: 'text/plain', text: 'hello' },
        }),
      ]),
    );
    expect(entries[0].request.body).toEqual({ type: 'text', content: 'hello' });
  });
});

describe('parseHar — cookies', () => {
  it('drops `request.cookies` with a single aggregate report entry', () => {
    const { entries, report } = parseHar(
      harFile([
        harEntry({
          method: 'GET',
          url: 'https://api.openheaders.io',
          headers: [],
          cookies: [
            { name: 'session', value: 'abc' },
            { name: 'pref', value: 'dark' },
          ],
        }),
      ]),
    );
    expect(entries[0].request.headers).toEqual([]);
    expect(report.drops.some((d) => d.reason.includes('2 cookies'))).toBe(true);
  });
});

describe('parseHar — naming', () => {
  it('derives a readable name from the method + host + path', () => {
    const { entries } = parseHar(
      harFile([harEntry({ method: 'POST', url: 'https://api.openheaders.io/v1/things?a=1', headers: [] })]),
    );
    expect(entries[0].request.name).toBe('POST api.openheaders.io/v1/things');
  });

  it('falls back gracefully for non-URL inputs (templates)', () => {
    const { entries } = parseHar(harFile([harEntry({ method: 'GET', url: '{{BASE}}/ping', headers: [] })]));
    expect(entries[0].request.name).toBe('GET {{BASE}}/ping');
  });
});

describe('parseHar — realistic shape', () => {
  it('round-trips a DevTools-style HAR snippet into a usable request', () => {
    const har = JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'WebInspector', version: '537.36' },
        entries: [
          {
            startedDateTime: '2026-04-19T12:00:00.000Z',
            time: 120,
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/v1/things?page=2',
              httpVersion: 'HTTP/2',
              headers: [
                { name: ':method', value: 'POST' },
                { name: ':authority', value: 'api.openheaders.io' },
                { name: ':scheme', value: 'https' },
                { name: ':path', value: '/v1/things?page=2' },
                { name: 'accept', value: 'application/json' },
                { name: 'authorization', value: 'Bearer xyz.abc.123' },
                { name: 'content-type', value: 'application/json' },
              ],
              queryString: [{ name: 'page', value: '2' }],
              cookies: [{ name: 'session', value: 'dev' }],
              postData: { mimeType: 'application/json', text: '{"name":"hello"}' },
              headersSize: 420,
              bodySize: 17,
            },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2',
              headers: [],
              content: { size: 0, mimeType: '' },
              cookies: [],
            },
            cache: {},
            timings: { send: 0, wait: 120, receive: 0 },
          },
        ],
      },
    });

    const { entries, report } = parseHar(har);
    expect(entries).toHaveLength(1);
    const r = entries[0].request;
    expect(r.method).toBe('POST');
    expect(r.url).toBe('https://api.openheaders.io/v1/things');
    expect(r.params).toEqual([{ key: 'page', value: '2' }]);
    expect(r.auth).toEqual({ type: 'bearer', token: 'xyz.abc.123' });
    // Pseudo-headers stripped, Authorization promoted, content-type + accept remain.
    const keys = r.headers.map((h) => h.key.toLowerCase());
    expect(keys).toEqual(['accept', 'content-type']);
    expect(r.body).toEqual({ type: 'json', content: '{"name":"hello"}' });
    // One transform per class: pseudo strip, auth promotion.
    expect(report.transforms.length).toBeGreaterThanOrEqual(2);
    // One drop per class: cookies.
    expect(report.drops.some((d) => d.reason.includes('1 cookie'))).toBe(true);
  });
});

describe('selectHarEntries', () => {
  it('narrows entries by original index', () => {
    const base = parseHar(
      harFile([
        harEntry({ method: 'GET', url: 'https://a', headers: [] }),
        harEntry({ method: 'GET', url: 'https://b', headers: [] }),
        harEntry({ method: 'GET', url: 'https://c', headers: [] }),
      ]),
    );
    expect(base.entries).toHaveLength(3);
    const narrowed = selectHarEntries(base, [0, 2]);
    expect(narrowed.entries.map((e) => e.index)).toEqual([0, 2]);
    expect(narrowed.report.summary.imported).toBe(2);
    // Report drops/transforms survive (they describe SOURCE lossiness).
    expect(narrowed.report.drops).toEqual(base.report.drops);
    expect(narrowed.report.transforms).toEqual(base.report.transforms);
  });
});
