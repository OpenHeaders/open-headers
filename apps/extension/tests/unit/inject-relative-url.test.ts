/**
 * Relative-URL resolution for in-page interceptors.
 *
 * `fetch('/api/x')` and `xhr.open('GET', '/api/x')` hand a RELATIVE url to
 * the patched fetch/XHR. The rule's regexes are compiled from absolute
 * patterns (what the network layer — and the rule author — see), so the
 * interceptor must resolve the request url against the page base before
 * matching.
 *
 * Regression: a mock scoped to an absolute pattern never fired on a
 * same-origin relative fetch — standard-mode mocking silently did nothing
 * (the request hit the network and the popup showed `matched-fallback`),
 * while CDP mode worked because it sees the resolved absolute URL.
 */

import type { ResponseRule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildResponseInjection, type FuncInjection } from '@openheaders/rule-engine/content-scripts';

const host = new URL(document.baseURI).host;

interface OrigEnv {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
}

let orig: OrigEnv;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  orig = {
    fetch: window.fetch,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
  };
  fetchSpy = vi.fn().mockResolvedValue(new Response('PASSTHROUGH', { status: 200 }));
  window.fetch = fetchSpy as unknown as typeof window.fetch;
});

afterEach(() => {
  window.fetch = orig.fetch;
  XMLHttpRequest.prototype.open = orig.xhrOpen;
  XMLHttpRequest.prototype.send = orig.xhrSend;
});

function mockRuleFor(pattern: string): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'mck00099',
    path: 'rules/response',
    name: 'Mock echo',
    type: 'response',
    enabled: true,
    conditions: [{ uid: 'tcd00070', type: 'url-filter', values: [pattern] }],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      responseHeaders: {},
      responseBody: '{"oh":"mocked"}',
      contentType: 'application/json',
      bodyType: 'static',
      resourceType: 'rest',
    },
  };
}

function install(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

describe('in-page interceptor — relative URL resolution', () => {
  it('intercepts a same-origin RELATIVE fetch against an absolute pattern', async () => {
    install(buildResponseInjection(mockRuleFor(`*://${host}/echo/mocked*`)) as FuncInjection);

    const res = await window.fetch('/echo/mocked?test=mock-fetch&run=abc');
    expect(res.status).toBe(418);
    expect(await res.text()).toBe('{"oh":"mocked"}');
    // The synthetic response short-circuits — the real fetch never runs.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes a relative fetch that resolves to a NON-matching path through to the network', async () => {
    install(buildResponseInjection(mockRuleFor(`*://${host}/echo/mocked*`)) as FuncInjection);

    const res = await window.fetch('/echo/other?test=x');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('PASSTHROUGH');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('still intercepts an absolute fetch (idempotent under resolution)', async () => {
    install(buildResponseInjection(mockRuleFor(`*://${host}/echo/mocked*`)) as FuncInjection);

    const res = await window.fetch(`http://${host}/echo/mocked?test=abs`);
    expect(res.status).toBe(418);
    expect(await res.text()).toBe('{"oh":"mocked"}');
  });

  it('intercepts a relative XHR too', async () => {
    install(buildResponseInjection(mockRuleFor(`*://${host}/echo/mocked*`)) as FuncInjection);

    const xhr = new XMLHttpRequest();
    const done = new Promise<void>((resolve) => {
      xhr.onload = () => resolve();
    });
    xhr.open('GET', '/echo/mocked?test=xhr');
    xhr.send();
    await done;

    expect(xhr.status).toBe(418);
    expect(xhr.responseText).toBe('{"oh":"mocked"}');
  });
});
