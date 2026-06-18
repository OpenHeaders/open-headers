/**
 * Network-source response — body-framing header faithfulness.
 *
 * When a `network`-source `response` rule swaps the real body, the original
 * content-encoding / content-length / transfer-encoding describe the OLD
 * bytes. The page-context injection must drop them so a page can't read a
 * stale length or a now-wrong encoding off the substituted reply — matching
 * the attached (CDP) fulfill path, which strips the same set and lets the
 * browser recompute framing from the new body. A page reading those headers
 * sees the same (absent) value whether the rule runs via injection or attach.
 *
 * Covers the two fetch builders that start from the real response headers:
 *   - static network  → buildHeaders(real)
 *   - dynamic network → __ohMergeHeaders(real)
 * XHR exposes no writable response-header surface, so it can't carry the fix.
 */

import type { ResponseBodyType, ResponseRule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildResponseInjection, type FuncInjection } from '@openheaders/rule-engine/content-scripts';

interface OrigEnv {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
}

let orig: OrigEnv;

beforeEach(() => {
  orig = {
    fetch: window.fetch,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
  };
});

afterEach(() => {
  window.fetch = orig.fetch;
  XMLHttpRequest.prototype.open = orig.xhrOpen;
  XMLHttpRequest.prototype.send = orig.xhrSend;
});

const URL = 'https://openheaders.io/api/data';

/** Stub the deepest fetch to a real reply carrying the given headers. Must be
 *  set BEFORE installing the patch — the chain captures it as `origFetch`. */
function stubRealResponse(headers: Record<string, string>, body = '{"real":true}'): void {
  window.fetch = vi
    .fn()
    .mockResolvedValue(new Response(body, { status: 200, headers })) as unknown as typeof window.fetch;
}

function networkResponseRule(opts: {
  bodyType: ResponseBodyType;
  responseBody: string;
  contentType?: string;
  responseHeaders?: Record<string, string>;
}): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rsp00002',
    path: 'rules/response',
    name: 'Response',
    type: 'response',
    enabled: true,
    conditions: [{ uid: 'tcd00038', type: 'request-domains', values: ['openheaders.io'] }],
    action: {
      responseSource: 'network',
      statusCode: 0,
      responseHeaders: opts.responseHeaders ?? {},
      responseBody: opts.responseBody,
      contentType: opts.contentType ?? '',
      bodyType: opts.bodyType,
      resourceType: 'rest',
      graphqlFilter: undefined,
    },
  };
}

function installFunc(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

function installInline(code: string): void {
  new Function(code)();
}

const FRAMING = {
  'content-encoding': 'gzip',
  'content-length': '9999',
  'transfer-encoding': 'chunked',
  'x-trace': 'keep-me',
};

describe('static network response — body-framing headers', () => {
  it('drops content-encoding / content-length / transfer-encoding, keeps others', async () => {
    stubRealResponse(FRAMING);
    const rule = networkResponseRule({
      bodyType: 'static',
      responseBody: '{"swapped":true}',
      contentType: 'application/json',
    });
    installFunc(buildResponseInjection(rule) as FuncInjection);

    const res = await window.fetch(URL);
    expect(await res.text()).toBe('{"swapped":true}');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBeNull();
    expect(res.headers.get('transfer-encoding')).toBeNull();
    // Non-framing real headers and the CT override survive the strip.
    expect(res.headers.get('x-trace')).toBe('keep-me');
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('an explicit content-length override still applies (drop precedes overrides)', async () => {
    stubRealResponse({ 'content-length': '9999' }, 'x');
    const rule = networkResponseRule({
      bodyType: 'static',
      responseBody: 'x',
      responseHeaders: { 'Content-Length': '42' },
    });
    installFunc(buildResponseInjection(rule) as FuncInjection);

    const res = await window.fetch(URL);
    // The stale real value is gone; the user's explicit override survives.
    expect(res.headers.get('content-length')).toBe('42');
  });
});

describe('dynamic network response — body-framing headers', () => {
  it('drops content-encoding / content-length / transfer-encoding, keeps others', async () => {
    stubRealResponse(FRAMING, '{"users":[{"id":1}]}');
    const rule = networkResponseRule({
      bodyType: 'dynamic',
      responseBody: 'function modifyResponse(args){ return JSON.stringify({ wrapped: args.responseJSON }); }',
      contentType: 'application/json',
    });
    const inj = buildResponseInjection(rule);
    expect(inj.kind).toBe('inline-script');
    if (inj.kind !== 'inline-script') return;
    installInline(inj.code);

    const res = await window.fetch(URL);
    expect(await res.text()).toBe('{"wrapped":{"users":[{"id":1}]}}');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.headers.get('content-length')).toBeNull();
    expect(res.headers.get('transfer-encoding')).toBeNull();
    expect(res.headers.get('x-trace')).toBe('keep-me');
  });
});
