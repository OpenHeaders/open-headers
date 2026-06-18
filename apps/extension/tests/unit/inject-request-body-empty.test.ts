/**
 * Dynamic `request-body` wrapper — a present-but-empty outgoing body is still a
 * body (PD1).
 *
 * A page that sends `fetch(url, { body: '' })` / `xhr.send('')` has explicitly
 * passed a body — an empty one. A dynamic `request-body` rule exists to
 * transform the OUTGOING body, so `modifyRequestBody('')` must run and the rule
 * must fire, matching the CDP control plane (which treats a present `postData`
 * as a body) and the static cell (which substitutes unconditionally).
 *
 * A genuinely absent body (`body` omitted, or `body: null`) still passes
 * through untouched — the browser normalizes `null` to no wire body, so the
 * transform has nothing to act on and does not fire.
 */

import type { ApiResourceType, RequestBodyRule, RequestBodyType } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { buildRequestBodyInjection } from '@openheaders/rule-engine/content-scripts';

interface OrigEnv {
  fetch: typeof window.fetch;
  xhrOpen: typeof XMLHttpRequest.prototype.open;
  xhrSend: typeof XMLHttpRequest.prototype.send;
}

let orig: OrigEnv;
let fetchSpy: ReturnType<typeof vi.fn>;
let sendSpy: ReturnType<typeof vi.fn>;
let fireSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  orig = {
    fetch: window.fetch,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
  };
  fetchSpy = vi.fn().mockResolvedValue(new Response('PASSTHROUGH', { status: 200 }));
  window.fetch = fetchSpy as unknown as typeof window.fetch;
  // Replaced BEFORE install so the wrapper captures the spy as its origXHRSend
  // — asserting the body that reaches the deepest send call site.
  sendSpy = vi.fn();
  XMLHttpRequest.prototype.send = sendSpy as unknown as typeof XMLHttpRequest.prototype.send;
  // The wrapper routes a fire through window.__ohOrig.fire (oh-setup installs it
  // in production); a spy here captures whether the rule fired.
  fireSpy = vi.fn();
  (window as unknown as { __ohOrig?: { fire: (...a: unknown[]) => void } }).__ohOrig = {
    fire: fireSpy as unknown as (...a: unknown[]) => void,
  };
});

afterEach(() => {
  window.fetch = orig.fetch;
  XMLHttpRequest.prototype.open = orig.xhrOpen;
  XMLHttpRequest.prototype.send = orig.xhrSend;
  (window as unknown as { __ohOrig?: unknown }).__ohOrig = undefined;
});

function lastFetchBody(): string | undefined {
  const last = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  if (!last) return undefined;
  const init = last[1] as RequestInit | undefined;
  return init?.body as string | undefined;
}

function lastSendBody(): unknown {
  const last = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
  return last?.[0];
}

function bodyRule(opts: { bodyType: RequestBodyType; body: string; resourceType?: ApiResourceType }): RequestBodyRule {
  return {
    schemaVersion: 5,
    uid: 'bdy00009',
    path: 'rules/body',
    name: 'Body',
    type: 'request-body',
    enabled: true,
    conditions: [{ uid: 'tcd00041', type: 'request-domains', values: ['openheaders.io'] }],
    action: {
      bodyType: opts.bodyType,
      requestBody: opts.body,
      resourceType: opts.resourceType ?? 'rest',
    },
  };
}

function installInline(code: string): void {
  new Function(code)();
}

// Echoes whether the transform saw an empty body — proves both that the
// transform ran AND that it received the page's empty string.
const ECHO_EMPTY = 'function modifyRequestBody(args){ return JSON.stringify({ wasEmpty: args.body === "" }); }';

const URL = 'https://openheaders.io/api';

describe('dynamic request-body — present-but-empty outgoing body', () => {
  function installDynamic(): void {
    const inj = buildRequestBodyInjection(bodyRule({ bodyType: 'dynamic', body: ECHO_EMPTY }));
    if (inj.kind !== 'inline-script') throw new Error('expected inline-script');
    installInline(inj.code);
  }

  it('transforms and fires on fetch(url, { body: "" })', async () => {
    installDynamic();

    await window.fetch(URL, { method: 'POST', body: '' });

    expect(lastFetchBody()).toBe('{"wasEmpty":true}');
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(fireSpy).toHaveBeenCalledWith('bdy00009', URL, 'request-body');
  });

  it('transforms and fires on xhr.send("")', () => {
    installDynamic();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', URL);
    xhr.send('');

    expect(lastSendBody()).toBe('{"wasEmpty":true}');
    expect(fireSpy).toHaveBeenCalledTimes(1);
    expect(fireSpy).toHaveBeenCalledWith('bdy00009', URL, 'request-body');
  });

  it('passes a fetch with NO body through untouched — no transform, no fire', async () => {
    installDynamic();

    await window.fetch(URL, { method: 'POST' });

    expect(lastFetchBody()).toBeUndefined();
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('passes a fetch with body: null through untouched — no transform, no fire', async () => {
    installDynamic();

    await window.fetch(URL, { method: 'POST', body: null });

    expect(lastFetchBody()).toBeNull();
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('passes xhr.send() (no body) through untouched — no transform, no fire', () => {
    installDynamic();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', URL);
    xhr.send();

    expect(lastSendBody()).toBeUndefined();
    expect(fireSpy).not.toHaveBeenCalled();
  });
});
