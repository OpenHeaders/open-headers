/**
 * The chrome control-port adapters — `ChromeCdpTabControlPort` and
 * `ChromeCdpRequestControlPort` over a real `ChromeDebuggerEventSource`'s
 * session sender. This is the Phase-C exit criterion's round-trip: a typed
 * oracle command → host adapter → session-mapped `chrome.debugger.sendCommand`.
 *
 * The tab port also proves the diff/idempotency contract end to end (no
 * command on an unchanged re-apply; the whole set re-issued after `forget`)
 * and the session mapping (root → `{tabId}`, child → `{tabId, sessionId}`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChromeCdpRequestControlPort } from '@/background/correlator-host/chrome-cdp-request-control-port';
import { ChromeCdpTabControlPort } from '@/background/correlator-host/chrome-cdp-tab-control-port';
import { ChromeDebuggerEventSource } from '@/background/correlator-host/chrome-debugger-source';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

const TAB = 7;
const ROOT = { tabId: TAB, sessionId: 'page' };
const CHILD = { tabId: TAB, sessionId: 'child-worker-1' };

function sendCalls(): Array<[chrome.debugger.DebuggerSession, string, Record<string, unknown> | undefined]> {
  return chromeMock.debugger.sendCommand.mock.calls.map(
    (c) => [c[0], c[1], c[2]] as [chrome.debugger.DebuggerSession, string, Record<string, unknown> | undefined],
  );
}

let source: ChromeDebuggerEventSource;

beforeEach(() => {
  vi.clearAllMocks();
  source = new ChromeDebuggerEventSource();
});

describe('ChromeCdpTabControlPort', () => {
  it('reports available when chrome.debugger exists', () => {
    expect(new ChromeCdpTabControlPort(source).available).toBe(true);
  });

  it('maps a set-cache-disabled diff onto Network.setCacheDisabled on the root debuggee', async () => {
    const port = new ChromeCdpTabControlPort(source);
    await port.apply(ROOT, {
      cacheDisabled: true,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([[{ tabId: TAB }, 'Network.setCacheDisabled', { cacheDisabled: true }]]);
  });

  it('issues nothing on an unchanged re-apply, then the delta on a change', async () => {
    const port = new ChromeCdpTabControlPort(source);
    const armed = {
      cacheDisabled: true,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, armed);
    await port.apply(ROOT, armed);
    expect(sendCalls()).toHaveLength(1); // second apply was a no-op

    await port.apply(ROOT, { ...armed, bypassCsp: true });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Network.setCacheDisabled', { cacheDisabled: true }],
      [{ tabId: TAB }, 'Page.setBypassCSP', { enabled: true }],
    ]);
  });

  it('replays the whole standing set after forget (the detach/reattach path)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    const armed = {
      cacheDisabled: true,
      networkConditions: { offline: false, latencyMs: 400, downloadThroughputBps: 50_000, uploadThroughputBps: 50_000 },
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, armed);
    port.forget(ROOT);
    vi.clearAllMocks();

    await port.apply(ROOT, armed);
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Network.setCacheDisabled', { cacheDisabled: true }],
      [
        { tabId: TAB },
        'Network.emulateNetworkConditions',
        { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 },
      ],
    ]);
  });

  it('clears network conditions with the no-throttle reset params', async () => {
    const port = new ChromeCdpTabControlPort(source);
    const base = {
      cacheDisabled: false,
      networkConditions: { offline: true, latencyMs: 0, downloadThroughputBps: -1, uploadThroughputBps: -1 },
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, base);
    vi.clearAllMocks();
    await port.apply(ROOT, { ...base, networkConditions: null });
    expect(sendCalls()).toEqual([
      [
        { tabId: TAB },
        'Network.emulateNetworkConditions',
        { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
      ],
    ]);
  });

  it('routes a child-session apply onto the child debuggee', async () => {
    const port = new ChromeCdpTabControlPort(source);
    await port.apply(CHILD, {
      cacheDisabled: true,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB, sessionId: 'child-worker-1' }, 'Network.setCacheDisabled', { cacheDisabled: true }],
    ]);
  });

  it('keeps prev on a command failure so a retry re-issues the whole diff', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockRejectedValueOnce(new Error('target gone'));
    await expect(
      port.apply(ROOT, {
        cacheDisabled: true,
        networkConditions: null,
        overrides: null,
        bootstrapScripts: [],
        fetchPatterns: [],
        fetchHandleAuthRequests: false,
        bypassCsp: false,
      }),
    ).rejects.toThrow('target gone');
    vi.clearAllMocks();

    // lastApplied stayed empty, so the retry re-diffs from empty.
    await port.apply(ROOT, {
      cacheDisabled: true,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([[{ tabId: TAB }, 'Network.setCacheDisabled', { cacheDisabled: true }]]);
  });

  it('maps an enable-fetch diff onto Fetch.enable carrying patterns + handleAuthRequests (D3)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [{ urlPattern: '*://staging.openheaders.io/*' }],
      fetchHandleAuthRequests: true,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [
        { tabId: TAB },
        'Fetch.enable',
        { patterns: [{ urlPattern: '*://staging.openheaders.io/*' }], handleAuthRequests: true },
      ],
    ]);
  });
});

describe('ChromeCdpRequestControlPort', () => {
  it('maps fulfill onto Fetch.fulfillRequest with header + body fields', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    await port.fulfill(ROOT, {
      requestId: 'fetch-1',
      responseCode: 200,
      responseHeaders: [{ name: 'content-type', value: 'application/json' }],
      body: 'eyJvayI6dHJ1ZX0=',
    });
    expect(sendCalls()).toEqual([
      [
        { tabId: TAB },
        'Fetch.fulfillRequest',
        {
          requestId: 'fetch-1',
          responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/json' }],
          body: 'eyJvayI6dHJ1ZX0=',
        },
      ],
    ]);
  });

  it('maps continueRequest onto Fetch.continueRequest, omitting absent fields', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    await port.continueRequest(CHILD, { requestId: 'fetch-2', url: 'https://api.openheaders.io/v2/users' });
    expect(sendCalls()).toEqual([
      [
        { tabId: TAB, sessionId: 'child-worker-1' },
        'Fetch.continueRequest',
        { requestId: 'fetch-2', url: 'https://api.openheaders.io/v2/users' },
      ],
    ]);
  });

  it('maps continueWithAuth onto Fetch.continueWithAuth with the challenge response', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    await port.continueWithAuth(ROOT, {
      requestId: 'fetch-3',
      authChallengeResponse: { response: 'ProvideCredentials', username: 'dev', password: 'secret' },
    });
    expect(sendCalls()).toEqual([
      [
        { tabId: TAB },
        'Fetch.continueWithAuth',
        {
          requestId: 'fetch-3',
          authChallengeResponse: { response: 'ProvideCredentials', username: 'dev', password: 'secret' },
        },
      ],
    ]);
  });
});
