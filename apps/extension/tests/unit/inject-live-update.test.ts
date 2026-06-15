/**
 * Live-update mechanism for in-page interceptors (no page reload).
 *
 * Interceptors chain over the current fetch/XHR reference, so a rule edit
 * is applied by: setup (capture pristine refs at load) → reset (restore
 * them, dropping every chained patch) → re-inject the current rule set.
 * No stacking, deletes take effect, and the new config goes live without
 * navigating.
 */

import type { ResponseRule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildResetInjection,
  buildResponseInjection,
  buildSetupInjection,
  type FuncInjection,
} from '@openheaders/rule-engine/content-scripts';

const host = new URL(document.baseURI).host;

let origFetch: typeof window.fetch;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  origFetch = window.fetch;
  fetchSpy = vi.fn().mockResolvedValue(new Response('PASSTHROUGH', { status: 200 }));
  window.fetch = fetchSpy as unknown as typeof window.fetch;
});

afterEach(() => {
  window.fetch = origFetch;
  delete (window as unknown as { __ohOrig?: unknown }).__ohOrig;
});

function mockRuleFor(body: string): ResponseRule {
  return {
    schemaVersion: 5,
    uid: 'mck00088',
    path: 'rules/response',
    name: 'Mock',
    type: 'response',
    enabled: true,
    conditions: [{ uid: 'tcd00080', type: 'url-filter', values: [`*://${host}/echo/mocked*`] }],
    action: {
      responseSource: 'mock',
      statusCode: 418,
      responseHeaders: {},
      responseBody: body,
      contentType: 'application/json',
      bodyType: 'static',
      resourceType: 'rest',
    },
  };
}

function install(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

describe('interceptor live-update (setup / reset / re-inject)', () => {
  it('applies a rule-body edit in place without a reload', async () => {
    install(buildSetupInjection());
    install(buildResponseInjection(mockRuleFor('{"v":1}')) as FuncInjection);

    let res = await window.fetch('/echo/mocked');
    expect(await res.text()).toBe('{"v":1}');

    // Edit lands: reset drops the patch, re-inject installs the new body.
    install(buildResetInjection());
    res = await window.fetch('/echo/mocked');
    expect(await res.text()).toBe('PASSTHROUGH'); // reset restored the real fetch

    install(buildResponseInjection(mockRuleFor('{"v":2}')) as FuncInjection);
    res = await window.fetch('/echo/mocked');
    expect(await res.text()).toBe('{"v":2}'); // new value live, no reload
  });

  it('reset fully removes interception (a deleted rule stops firing)', async () => {
    install(buildSetupInjection());
    install(buildResponseInjection(mockRuleFor('{"v":1}')) as FuncInjection);
    expect(await (await window.fetch('/echo/mocked')).text()).toBe('{"v":1}');

    install(buildResetInjection());
    const res = await window.fetch('/echo/mocked');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('PASSTHROUGH');
  });

  it('reset is a no-op when nothing was set up (no __ohOrig)', async () => {
    // Should not throw and should leave the current fetch intact.
    install(buildResetInjection());
    const res = await window.fetch('/echo/mocked');
    expect(await res.text()).toBe('PASSTHROUGH');
  });
});
