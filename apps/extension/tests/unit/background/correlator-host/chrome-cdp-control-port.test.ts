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

  it('maps an add-bootstrap-script diff onto Page.addScriptToEvaluateOnNewDocument (E1a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ identifier: 'script-1' });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [{ key: 'wrapper', source: 'globalThis.__oh_wrap__()' }],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Page.addScriptToEvaluateOnNewDocument', { source: 'globalThis.__oh_wrap__()' }],
    ]);
  });

  it('removes a bootstrap script by the id captured from the add (E1a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ identifier: 'script-1' });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [{ key: 'wrapper', source: 'globalThis.__oh_wrap__()' }],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    vi.clearAllMocks();
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Page.removeScriptToEvaluateOnNewDocument', { identifier: 'script-1' }],
    ]);
  });

  it('re-bootstraps a changed source: removes the old id then adds and tracks the new one (E1a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ identifier: 'script-1' });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [{ key: 'wrapper', source: 'v1' }],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    vi.clearAllMocks();
    // The remove consumes the first queued value (its result is ignored); the
    // re-add consumes the second and captures the fresh id.
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({ identifier: 'script-2' });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [{ key: 'wrapper', source: 'v2' }],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Page.removeScriptToEvaluateOnNewDocument', { identifier: 'script-1' }],
      [{ tabId: TAB }, 'Page.addScriptToEvaluateOnNewDocument', { source: 'v2' }],
    ]);

    // Dropping the key now removes the NEW id, proving the id map transitioned.
    vi.clearAllMocks();
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Page.removeScriptToEvaluateOnNewDocument', { identifier: 'script-2' }],
    ]);
  });

  it('forget clears the id map so a re-apply re-adds the bootstrap script (E1a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    const withScript = {
      cacheDisabled: false,
      networkConditions: null,
      overrides: null,
      bootstrapScripts: [{ key: 'wrapper', source: 'globalThis.__oh_wrap__()' }],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ identifier: 'script-1' });
    await port.apply(ROOT, withScript);
    port.forget(ROOT);
    vi.clearAllMocks();

    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ identifier: 'script-9' });
    await port.apply(ROOT, withScript);
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Page.addScriptToEvaluateOnNewDocument', { source: 'globalThis.__oh_wrap__()' }],
    ]);
  });

  it('captures the real UA then maps a set-user-agent-override onto Network.setUserAgentOverride (F3a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    // The capture read resolves first (the page's real UA), then the override lands.
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/1.0 (openheaders.io)' } });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true }],
      [{ tabId: TAB }, 'Network.setUserAgentOverride', { userAgent: 'Spoof-UA/1.0 (openheaders.io)' }],
    ]);
  });

  it('carries acceptLanguage and platform onto Network.setUserAgentOverride (F3a)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/1.0 (openheaders.io)' } });
    await port.apply(ROOT, {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)', acceptLanguage: 'fr-FR', platform: 'Linux' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true }],
      [
        { tabId: TAB },
        'Network.setUserAgentOverride',
        { userAgent: 'Spoof-UA/1.0 (openheaders.io)', acceptLanguage: 'fr-FR', platform: 'Linux' },
      ],
    ]);
  });

  it('restores the captured real UA on clear-user-agent-override (CDP has no UA reset)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/1.0 (openheaders.io)' } });
    const overridden = {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, overridden);
    vi.clearAllMocks();
    await port.apply(ROOT, { ...overridden, overrides: null });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Network.setUserAgentOverride', { userAgent: 'Real-UA/1.0 (openheaders.io)' }],
    ]);
  });

  it('captures the real UA once per target — a second override change does not re-read it', async () => {
    const port = new ChromeCdpTabControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/1.0 (openheaders.io)' } });
    const base = {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, base);
    vi.clearAllMocks();
    await port.apply(ROOT, { ...base, overrides: { userAgent: 'Spoof-UA/2.0 (openheaders.io)' } });
    // No Runtime.evaluate this time — the cached capture is reused.
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Network.setUserAgentOverride', { userAgent: 'Spoof-UA/2.0 (openheaders.io)' }],
    ]);
  });

  it('skips the clear when the UA capture failed — the override clears on reload instead', async () => {
    const port = new ChromeCdpTabControlPort(source);
    // A non-string capture result leaves the cache empty; the override still
    // applies (the command carries its own userAgent), but a later clear has
    // nothing to restore.
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: null } });
    const overridden = {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    await port.apply(ROOT, overridden);
    vi.clearAllMocks();
    await port.apply(ROOT, { ...overridden, overrides: null });
    expect(sendCalls()).toEqual([]);
  });

  it('forget clears the captured UA so a re-apply re-reads it (the detach/reattach path)', async () => {
    const port = new ChromeCdpTabControlPort(source);
    const overridden = {
      cacheDisabled: false,
      networkConditions: null,
      overrides: { userAgent: 'Spoof-UA/1.0 (openheaders.io)' },
      bootstrapScripts: [],
      fetchPatterns: [],
      fetchHandleAuthRequests: false,
      bypassCsp: false,
    } as const;
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/1.0 (openheaders.io)' } });
    await port.apply(ROOT, overridden);
    port.forget(ROOT);
    vi.clearAllMocks();

    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ result: { value: 'Real-UA/2.0 (openheaders.io)' } });
    await port.apply(ROOT, overridden);
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Runtime.evaluate', { expression: 'navigator.userAgent', returnByValue: true }],
      [{ tabId: TAB }, 'Network.setUserAgentOverride', { userAgent: 'Spoof-UA/1.0 (openheaders.io)' }],
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

  it('maps continueRequest carrying interceptResponse onto Fetch.continueRequest (D2b-1)', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    await port.continueRequest(ROOT, { requestId: 'fetch-2b', interceptResponse: true });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB }, 'Fetch.continueRequest', { requestId: 'fetch-2b', interceptResponse: true }],
    ]);
  });

  it('maps continueResponse onto Fetch.continueResponse (the Response-stage release)', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    await port.continueResponse(CHILD, { requestId: 'fetch-2c' });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB, sessionId: 'child-worker-1' }, 'Fetch.continueResponse', { requestId: 'fetch-2c' }],
    ]);
  });

  it('maps getResponseBody onto Fetch.getResponseBody and returns the parsed body (D2b-2b)', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ body: 'eyJpZCI6MX0=', base64Encoded: true });
    const result = await port.getResponseBody(ROOT, { requestId: 'fetch-4' });
    expect(sendCalls()).toEqual([[{ tabId: TAB }, 'Fetch.getResponseBody', { requestId: 'fetch-4' }]]);
    expect(result).toEqual({ body: 'eyJpZCI6MX0=', base64Encoded: true });
  });

  it('rejects when Fetch.getResponseBody returns an unexpected shape', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ nope: true });
    await expect(port.getResponseBody(ROOT, { requestId: 'fetch-5' })).rejects.toThrow('unexpected shape');
  });

  it('maps getRequestPostData onto Fetch.getRequestPostData and returns the parsed body (D2b-2c)', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ postData: '{"q":"value"}' });
    const result = await port.getRequestPostData(CHILD, { requestId: 'fetch-6' });
    expect(sendCalls()).toEqual([
      [{ tabId: TAB, sessionId: 'child-worker-1' }, 'Fetch.getRequestPostData', { requestId: 'fetch-6' }],
    ]);
    expect(result).toEqual({ postData: '{"q":"value"}' });
  });

  it('rejects when Fetch.getRequestPostData returns an unexpected shape', async () => {
    const port = new ChromeCdpRequestControlPort(source);
    chromeMock.debugger.sendCommand.mockResolvedValueOnce({ nope: true });
    await expect(port.getRequestPostData(ROOT, { requestId: 'fetch-7' })).rejects.toThrow('unexpected shape');
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
