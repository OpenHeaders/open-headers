/**
 * Terminal-shadow arbitration — block rules beat scriptable wrappers.
 *
 * DNR resolves conflicts by priority with terminal actions winning; the
 * in-page wrappers act BEFORE DNR, so each wrapper config carries the
 * effective block rules' matchers and stands down on requests a block
 * owns (no action, no fire). Pins:
 *
 *   - compileTerminalBlockSources folds only in-page-evaluable block
 *     rules (URL conditions; resource-types only when it takes xhr);
 *   - the delay wrapper does not hold a blocked request;
 *   - the mock response wrapper does not serve a body for a blocked
 *     request (a mock never touches the network — without arbitration
 *     it silently defeats the block);
 *   - the request-body wrapper does not rewrite a blocked request;
 *   - non-blocked requests behave exactly as before.
 */

import type { BlockRule, DelayRule, RequestBodyRule, ResponseRule, Rule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildDelayInjection,
  buildRequestBodyInjection,
  buildResponseInjection,
  compileTerminalBlockSources,
  type FuncInjection,
} from '@openheaders/rule-engine/content-scripts';

const BLOCKED_URL = 'https://api.openheaders.io/blocked/data';
const OPEN_URL = 'https://api.openheaders.io/open/data';

function blockRule(overrides: Partial<BlockRule> = {}): BlockRule {
  return {
    schemaVersion: 5,
    uid: 'blk00001',
    path: 'rules/block',
    name: 'Block /blocked',
    type: 'block',
    enabled: true,
    published: true,
    conditions: [{ uid: 'bcd00001', type: 'url-filter', values: ['*://api.openheaders.io/blocked/*'] }],
    action: {},
    ...overrides,
  };
}

function delayRule(): DelayRule {
  return {
    schemaVersion: 5,
    uid: 'dly00001',
    path: 'rules/delay',
    name: 'Delay api',
    type: 'delay',
    enabled: true,
    published: true,
    conditions: [{ uid: 'dcd00001', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { delayMs: 1000 },
  };
}

function mockResponseRule(): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'rsp00001',
    path: 'rules/response',
    name: 'Mock api',
    type: 'response',
    enabled: true,
    published: true,
    conditions: [{ uid: 'rcd00001', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: {
      responseSource: 'mock',
      bodyType: 'static',
      responseBody: '{"mocked":true}',
      statusCode: 200,
      contentType: 'application/json',
      responseHeaders: {},
    },
  };
}

function requestBodyRule(): RequestBodyRule {
  return {
    schemaVersion: 5,
    uid: 'bdy00001',
    path: 'rules/request-body',
    name: 'Rewrite api bodies',
    type: 'request-body',
    enabled: true,
    published: true,
    conditions: [{ uid: 'ycd00001', type: 'url-filter', values: ['*://api.openheaders.io/*'] }],
    action: { bodyType: 'static', requestBody: '{"rewritten":true}', resourceType: 'rest' },
  };
}

describe('compileTerminalBlockSources — eligibility', () => {
  it('folds URL-conditioned block rules and ignores non-block types', () => {
    const sources = compileTerminalBlockSources([blockRule(), delayRule() as Rule]);
    expect(sources).toHaveLength(1);
    expect(new RegExp(sources[0]!, 'i').test(BLOCKED_URL)).toBe(true);
    expect(new RegExp(sources[0]!, 'i').test(OPEN_URL)).toBe(false);
  });

  it('folds a resource-types condition only when it takes xhr', () => {
    const withXhr = blockRule({
      conditions: [
        { uid: 'bcd00001', type: 'url-filter', values: ['*://api.openheaders.io/blocked/*'] },
        { uid: 'bcd00002', type: 'resource-types', values: ['xhr', 'script'] },
      ],
    });
    const withoutXhr = blockRule({
      conditions: [
        { uid: 'bcd00001', type: 'url-filter', values: ['*://api.openheaders.io/blocked/*'] },
        { uid: 'bcd00002', type: 'resource-types', values: ['image'] },
      ],
    });
    expect(compileTerminalBlockSources([withXhr])).toHaveLength(1);
    expect(compileTerminalBlockSources([withoutXhr])).toHaveLength(0);
  });

  it('skips block rules with conditions the wrapper cannot evaluate', () => {
    const methodGated = blockRule({
      conditions: [
        { uid: 'bcd00001', type: 'url-filter', values: ['*://api.openheaders.io/blocked/*'] },
        { uid: 'bcd00002', type: 'request-methods', values: ['post'] },
      ],
    });
    expect(compileTerminalBlockSources([methodGated])).toHaveLength(0);
  });

  it('skips an exclude-resource-types condition that excludes xhr', () => {
    const excludesXhr = blockRule({
      conditions: [
        { uid: 'bcd00001', type: 'url-filter', values: ['*://api.openheaders.io/blocked/*'] },
        { uid: 'bcd00002', type: 'exclude-resource-types', values: ['xhr'] },
      ],
    });
    expect(compileTerminalBlockSources([excludesXhr])).toHaveLength(0);
  });
});

describe('wrapper stand-down on terminal-shadowed requests', () => {
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.fetch = orig.fetch;
    XMLHttpRequest.prototype.open = orig.xhrOpen;
    XMLHttpRequest.prototype.send = orig.xhrSend;
  });

  function install(injection: FuncInjection): void {
    (injection.func as unknown as (cfg: unknown) => void)(injection.args[0]);
  }

  const terminal = () => compileTerminalBlockSources([blockRule()]);

  it('delay: a blocked request passes through with no timer', async () => {
    install(buildDelayInjection(delayRule(), terminal()));
    const p = window.fetch(BLOCKED_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await expect(p).resolves.toBeInstanceOf(Response);
  });

  it('delay: a non-blocked request still waits the configured delay', () => {
    install(buildDelayInjection(delayRule(), terminal()));
    void window.fetch(OPEN_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('mock response: a blocked request reaches the network instead of the mock', async () => {
    install(buildResponseInjection(mockResponseRule(), terminal()) as FuncInjection);
    const res = await window.fetch(BLOCKED_URL);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await expect(res.text()).resolves.toBe('PASSTHROUGH');
  });

  it('mock response: a non-blocked request is still mocked without touching the network', async () => {
    install(buildResponseInjection(mockResponseRule(), terminal()) as FuncInjection);
    const res = await window.fetch(OPEN_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(res.text()).resolves.toBe('{"mocked":true}');
  });

  it('request-body: a blocked request keeps its original body', async () => {
    install(buildRequestBodyInjection(requestBodyRule(), terminal()) as FuncInjection);
    await window.fetch(BLOCKED_URL, { method: 'POST', body: '{"original":true}' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"original":true}');
  });

  it('request-body: a non-blocked request is still rewritten', async () => {
    install(buildRequestBodyInjection(requestBodyRule(), terminal()) as FuncInjection);
    await window.fetch(OPEN_URL, { method: 'POST', body: '{"original":true}' });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"rewritten":true}');
  });

  it('empty terminal sources keep the unshadowed behavior (wrapper acts)', async () => {
    install(buildResponseInjection(mockResponseRule(), []) as FuncInjection);
    const res = await window.fetch(BLOCKED_URL);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(res.text()).resolves.toBe('{"mocked":true}');
  });
});
