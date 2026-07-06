/**
 * Executor fetch telemetry — entry correlation (pick the fetch's own
 * resource-timing entry out of the observed window) and request-size
 * computation (serialized headers, multipart framing estimate).
 */

import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import { describe, expect, it } from 'vitest';
import {
  estimateMultipartBytes,
  pickResourceEntry,
  serializedHeaderBytes,
  stringBodyBytes,
} from '@/background/modules/request-executor/timing';

function makeEntry(overrides: Partial<ResourceTimingEntry> = {}): ResourceTimingEntry {
  return {
    name: 'https://api.openheaders.io/v1/ping',
    initiatorType: 'fetch',
    nextHopProtocol: 'h2',
    startTime: 1000,
    duration: 120,
    workerStart: 0,
    redirectStart: 0,
    redirectEnd: 0,
    fetchStart: 1000,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    firstInterimResponseStart: 0,
    finalResponseHeadersStart: 0,
    responseEnd: 1120,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    deliveryType: '',
    responseStatus: 0,
    ...overrides,
  };
}

const MATCH = {
  submittedUrl: 'https://api.openheaders.io/v1/ping',
  finalUrl: 'https://api.openheaders.io/v1/ping',
  startedAt: 1000,
};

describe('pickResourceEntry', () => {
  it('returns undefined when nothing matches', () => {
    expect(pickResourceEntry([], MATCH)).toBeUndefined();
    expect(pickResourceEntry([makeEntry({ name: 'https://cdn.openheaders.io/other.js' })], MATCH)).toBeUndefined();
  });

  it('matches by submitted URL', () => {
    const entry = makeEntry();
    expect(pickResourceEntry([entry], MATCH)).toBe(entry);
  });

  it('falls back to the final URL for engines that name by redirect target', () => {
    const entry = makeEntry({ name: 'https://api.openheaders.io/v2/ping' });
    expect(
      pickResourceEntry([entry], {
        submittedUrl: 'https://api.openheaders.io/v1/ping',
        finalUrl: 'https://api.openheaders.io/v2/ping',
        startedAt: 1000,
      }),
    ).toBe(entry);
  });

  it('ignores entries that started before the fetch mark', () => {
    const stale = makeEntry({ startTime: 400 });
    expect(pickResourceEntry([stale], MATCH)).toBeUndefined();
  });

  it('tolerates sub-millisecond clock skew at the mark', () => {
    const entry = makeEntry({ startTime: 999.5 });
    expect(pickResourceEntry([entry], MATCH)).toBe(entry);
  });

  it('last match wins when the window holds several same-URL entries', () => {
    const first = makeEntry({ startTime: 1001 });
    const second = makeEntry({ startTime: 1005 });
    expect(pickResourceEntry([first, second], MATCH)).toBe(second);
  });
});

describe('serializedHeaderBytes', () => {
  it('sums key: value CRLF lines', () => {
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-Debug', 'on');
    // "content-type: application/json\r\n" = 32, "x-debug: on\r\n" = 13
    expect(serializedHeaderBytes(headers)).toBe(45);
  });

  it('is zero for no headers', () => {
    expect(serializedHeaderBytes(new Headers())).toBe(0);
  });

  it('counts multi-byte values as UTF-8 bytes', () => {
    const headers = new Headers();
    headers.set('X-Name', 'café');
    // "x-name: café\r\n" — 14 chars, é is 2 bytes → 15
    expect(serializedHeaderBytes(headers)).toBe(15);
  });
});

describe('stringBodyBytes', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(stringBodyBytes('abc')).toBe(3);
    expect(stringBodyBytes('café')).toBe(5);
    expect(stringBodyBytes('')).toBe(0);
  });
});

describe('estimateMultipartBytes', () => {
  // Framing per field: --<38>\r\n (42) + disposition line + \r\n (2)
  // [+ content-type line + \r\n] + blank \r\n (2) + payload + \r\n (2);
  // closing --<38>--\r\n (44).
  it('frames a single text field', () => {
    // disposition: 'Content-Disposition: form-data; name="a"' = 40
    // 42 + 40 + 2 + 2 + 5 + 2 + 44
    expect(estimateMultipartBytes([{ name: 'a', payloadBytes: 5 }])).toBe(137);
  });

  it('adds filename and content-type for file fields', () => {
    // disposition + '; filename="f.txt"' = 40 + 18 = 58
    // content-type: 'Content-Type: text/plain' = 24 (+2)
    // 42 + 58 + 2 + 24 + 2 + 2 + 10 + 2 + 44
    expect(estimateMultipartBytes([{ name: 'a', filename: 'f.txt', mimeType: 'text/plain', payloadBytes: 10 }])).toBe(
      186,
    );
  });

  it('is just the closing boundary for an empty field list', () => {
    expect(estimateMultipartBytes([])).toBe(44);
  });

  it('accumulates across fields', () => {
    const one = estimateMultipartBytes([{ name: 'a', payloadBytes: 5 }]);
    const two = estimateMultipartBytes([
      { name: 'a', payloadBytes: 5 },
      { name: 'a', payloadBytes: 5 },
    ]);
    // Second field repeats everything except the closing boundary.
    expect(two - one).toBe(137 - 44);
  });
});
