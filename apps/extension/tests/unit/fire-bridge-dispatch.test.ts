/**
 * Private fire-bridge dispatch (E4) — `oh-setup` installs ONE fire dispatcher
 * at `window.__ohOrig.fire`; every wrapper reports through it. The dispatcher
 * decides the channel once, at capture time:
 *
 *   - un-armed tab (no Runtime binding) → `window.postMessage`, the cross-browser
 *     path the always-on ISOLATED fire-bridge content script relays;
 *   - CDP-attached tab (the SW added `window[OH_BINDING]`) → that binding, so the
 *     fire reaches the debugger without ever touching the DOM (page-invisible).
 *
 * The binding reference is closure-captured, so a page overwriting the global
 * after capture cannot redirect a real fire.
 */

import type { ResponseRule } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildResponseInjection,
  buildSetupInjection,
  type FuncInjection,
  OH_BINDING,
} from '@openheaders/rule-engine/content-scripts';

interface OhWindow {
  __ohOrig?: { fire: (ruleUid: string, url: string, kind: string) => void };
  [binding: string]: unknown;
}

const ohWin = window as unknown as OhWindow;

let postMessageSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  postMessageSpy.mockRestore();
  delete ohWin.__ohOrig;
  delete ohWin[OH_BINDING];
});

function installFunc(injection: FuncInjection): void {
  (injection.func as (cfg: unknown) => void)(injection.args[0]);
}

/** Report a fire through the dispatcher oh-setup installed (the single entry
 *  point every wrapper uses); throws if oh-setup never ran. */
function fire(ruleUid: string, url: string, kind: string): void {
  const dispatcher = ohWin.__ohOrig;
  if (!dispatcher) throw new Error('oh-setup did not install __ohOrig.fire');
  dispatcher.fire(ruleUid, url, kind);
}

describe('oh-setup fire dispatcher (E4)', () => {
  it('un-armed tab: routes a fire through window.postMessage', () => {
    installFunc(buildSetupInjection());

    fire('dly00001', 'https://api.openheaders.io/x', 'delay');

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    const [payload, target] = postMessageSpy.mock.calls[0] as [Record<string, unknown>, string];
    expect(payload).toMatchObject({
      __ohFire: true,
      ruleUid: 'dly00001',
      url: 'https://api.openheaders.io/x',
      kind: 'delay',
    });
    expect(typeof payload.t).toBe('number');
    expect(target).toBe('*');
  });

  it('in-scope tab: routes a fire through the Runtime binding, not postMessage', () => {
    const binding = vi.fn();
    ohWin[OH_BINDING] = binding;
    installFunc(buildSetupInjection());

    fire('wsr00001', 'wss://stream.openheaders.io/feed', 'ws');

    expect(binding).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((binding.mock.calls[0] as [string])[0]) as Record<string, unknown>;
    expect(payload).toMatchObject({ ruleUid: 'wsr00001', url: 'wss://stream.openheaders.io/feed', kind: 'ws' });
    expect(typeof payload.t).toBe('number');
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('captures the binding into a closure — a later page overwrite cannot redirect real fires', () => {
    const real = vi.fn();
    ohWin[OH_BINDING] = real;
    installFunc(buildSetupInjection());

    // The page tampers with the global AFTER oh-setup captured it.
    const impostor = vi.fn();
    ohWin[OH_BINDING] = impostor;

    fire('rsp00001', 'https://api.openheaders.io/x', 'response');

    expect(real).toHaveBeenCalledTimes(1);
    expect(impostor).not.toHaveBeenCalled();
  });

  it('is idempotent — a binding appearing after the first oh-setup does not re-arm the document', () => {
    installFunc(buildSetupInjection()); // un-armed: no binding captured

    // A binding appears later, but oh-setup already ran — re-running is a no-op,
    // so the dispatcher keeps its postMessage decision (the current-document
    // carve-out: an arming tab keeps postMessage until the next navigation).
    const lateBinding = vi.fn();
    ohWin[OH_BINDING] = lateBinding;
    installFunc(buildSetupInjection());

    fire('dly00001', 'https://api.openheaders.io/x', 'delay');

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    expect(lateBinding).not.toHaveBeenCalled();
  });
});

describe('wrappers report through the dispatcher (E4)', () => {
  let origFetch: typeof window.fetch;

  beforeEach(() => {
    origFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = origFetch;
  });

  function mockRule(pattern: string): ResponseRule {
    return {
      schemaVersion: 5,
      uid: 'mck00099',
      path: 'rules/response',
      name: 'Mock',
      type: 'response',
      enabled: true,
      conditions: [{ uid: 'tcd00070', type: 'url-filter', values: [pattern] }],
      action: {
        responseSource: 'mock',
        statusCode: 200,
        responseHeaders: {},
        responseBody: '{"ok":true}',
        contentType: 'application/json',
        bodyType: 'static',
        resourceType: 'rest',
      },
    };
  }

  it('a response-mock wrapper fires through the binding when armed', async () => {
    const host = new URL(document.baseURI).host;
    const binding = vi.fn();
    ohWin[OH_BINDING] = binding;
    installFunc(buildSetupInjection());
    installFunc(buildResponseInjection(mockRule(`*://${host}/echo/mocked*`)) as FuncInjection);

    const res = await window.fetch('/echo/mocked');

    expect(await res.text()).toBe('{"ok":true}'); // the wrapper acted (mock body)
    expect(binding).toHaveBeenCalledTimes(1); // and reported via the binding…
    expect(postMessageSpy).not.toHaveBeenCalled(); // …not the DOM
  });
});
