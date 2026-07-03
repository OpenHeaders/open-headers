import { formatHeaderName, type HeaderNameCase } from '@openheaders/ui/panel/data/headers/header-name-case';
import { describe, expect, it } from 'vitest';

const ORIGINAL: HeaderNameCase = 'original';
const TRAIN: HeaderNameCase = 'train';

describe('formatHeaderName', () => {
  it('returns input as-is for original mode', () => {
    expect(formatHeaderName('content-type', ORIGINAL)).toBe('content-type');
    expect(formatHeaderName('CF-Cache-Status', ORIGINAL)).toBe('CF-Cache-Status');
    expect(formatHeaderName(':method', ORIGINAL)).toBe(':method');
  });

  it('train-cases simple lowercase headers', () => {
    expect(formatHeaderName('content-type', TRAIN)).toBe('Content-Type');
    expect(formatHeaderName('set-cookie', TRAIN)).toBe('Set-Cookie');
    expect(formatHeaderName('cache-control', TRAIN)).toBe('Cache-Control');
    expect(formatHeaderName('access-control-allow-origin', TRAIN)).toBe('Access-Control-Allow-Origin');
  });

  it('honors specials with acronyms or non-standard caps', () => {
    expect(formatHeaderName('etag', TRAIN)).toBe('ETag');
    expect(formatHeaderName('www-authenticate', TRAIN)).toBe('WWW-Authenticate');
    expect(formatHeaderName('dnt', TRAIN)).toBe('DNT');
    expect(formatHeaderName('x-xss-protection', TRAIN)).toBe('X-XSS-Protection');
    expect(formatHeaderName('cf-cache-status', TRAIN)).toBe('CF-Cache-Status');
    expect(formatHeaderName('cf-ray', TRAIN)).toBe('CF-Ray');
    expect(formatHeaderName('sec-ch-ua', TRAIN)).toBe('Sec-CH-UA');
    expect(formatHeaderName('sec-ch-ua-mobile', TRAIN)).toBe('Sec-CH-UA-Mobile');
    expect(formatHeaderName('sec-websocket-key', TRAIN)).toBe('Sec-WebSocket-Key');
    expect(formatHeaderName('sec-gpc', TRAIN)).toBe('Sec-GPC');
    expect(formatHeaderName('nel', TRAIN)).toBe('NEL');
  });

  it('keeps pseudo-headers lowercase in train mode', () => {
    expect(formatHeaderName(':authority', TRAIN)).toBe(':authority');
    expect(formatHeaderName(':method', TRAIN)).toBe(':method');
    expect(formatHeaderName(':status', TRAIN)).toBe(':status');
  });

  it('keeps W3C trace-context headers all-lowercase as the spec requires', () => {
    expect(formatHeaderName('traceparent', TRAIN)).toBe('traceparent');
    expect(formatHeaderName('tracestate', TRAIN)).toBe('tracestate');
    expect(formatHeaderName('baggage', TRAIN)).toBe('baggage');
  });

  it('is case-insensitive on the input lookup', () => {
    expect(formatHeaderName('CONTENT-TYPE', TRAIN)).toBe('Content-Type');
    expect(formatHeaderName('Set-COOKIE', TRAIN)).toBe('Set-Cookie');
  });
});
