/**
 * Wire capture — the executor-side join from a fetch window to the
 * extension-traffic webRequest chain.
 *
 * Coverage:
 *   - join rule: method + submitted URL + window timestamp; chains
 *     outside any of the three never match;
 *   - ambiguity (two candidate chains) drops the capture whole;
 *   - aggregation: Set-Cookie across redirect hops in arrival order,
 *     remote IP from the terminal onCompleted, credentialsMode carried;
 *   - end-to-end `startWireCapture` against a fake registered source,
 *     including URL normalization (fetch-normalized spelling matches);
 *   - inert without a registered source.
 */

import type { WebRequestEvent } from '@openheaders/oracle/correlator-heuristic';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateWireCapture,
  pickWireChain,
  registerExtensionTrafficSource,
  startWireCapture,
} from '@/background/modules/request-executor/wire-capture';

const T0 = 1_700_000_000_000;

function chainStart(requestId: string, url: string, overrides: Partial<WebRequestEvent> = {}): WebRequestEvent {
  return {
    method_kind: 'onBeforeRequest',
    tabId: -1,
    requestId,
    url,
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: T0 + 5,
    initiator: 'chrome-extension://test-id',
    ...overrides,
  } as WebRequestEvent;
}

function headersReceived(requestId: string, url: string, setCookie: string[]): WebRequestEvent {
  return {
    method_kind: 'onHeadersReceived',
    tabId: -1,
    requestId,
    url,
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: T0 + 20,
    statusCode: 200,
    responseHeaders: setCookie.map((value) => ({ name: 'Set-Cookie', value })),
  } as WebRequestEvent;
}

function beforeRedirect(requestId: string, url: string, redirectUrl: string, setCookie: string[]): WebRequestEvent {
  return {
    method_kind: 'onBeforeRedirect',
    tabId: -1,
    requestId,
    url,
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: T0 + 10,
    statusCode: 302,
    redirectUrl,
    responseHeaders: setCookie.map((value) => ({ name: 'Set-Cookie', value })),
    ip: '203.0.113.7',
  } as WebRequestEvent;
}

function completed(requestId: string, url: string, ip?: string): WebRequestEvent {
  return {
    method_kind: 'onCompleted',
    tabId: -1,
    requestId,
    url,
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: T0 + 30,
    statusCode: 200,
    ...(ip !== undefined ? { ip } : {}),
  } as WebRequestEvent;
}

const URL_A = 'https://api.openheaders.io/v1/session';

describe('pickWireChain', () => {
  const match = { method: 'GET', submittedUrls: [URL_A], windowStartMs: T0 };

  it('picks the single chain matching method + URL + window', () => {
    const chain = [chainStart('1', URL_A), completed('1', URL_A, '203.0.113.7')];
    const chains = new Map([['1', chain]]);
    expect(pickWireChain(chains, match)).toBe(chain);
  });

  it('rejects a chain with a different method', () => {
    const chains = new Map([['1', [chainStart('1', URL_A, { method: 'POST' })]]]);
    expect(pickWireChain(chains, match)).toBeUndefined();
  });

  it('rejects a chain with a different URL', () => {
    const chains = new Map([['1', [chainStart('1', 'https://api.openheaders.io/other')]]]);
    expect(pickWireChain(chains, match)).toBeUndefined();
  });

  it('rejects a chain that started before the window', () => {
    const chains = new Map([['1', [chainStart('1', URL_A, { timeStamp: T0 - 500 })]]]);
    expect(pickWireChain(chains, match)).toBeUndefined();
  });

  it('drops the capture whole when two chains are candidates', () => {
    const chains = new Map([
      ['1', [chainStart('1', URL_A)]],
      ['2', [chainStart('2', URL_A)]],
    ]);
    expect(pickWireChain(chains, match)).toBeUndefined();
  });
});

describe('aggregateWireCapture', () => {
  it('collects Set-Cookie across redirect hops in arrival order and the terminal ip', () => {
    const redirectTarget = 'https://api.openheaders.io/v1/session/next';
    const chain = [
      chainStart('9', URL_A),
      beforeRedirect('9', URL_A, redirectTarget, ['hop=one; Path=/']),
      headersReceived('9', redirectTarget, ['hop=two; Path=/; HttpOnly', 'extra=three']),
      completed('9', redirectTarget, '203.0.113.9'),
    ];
    expect(aggregateWireCapture(chain, 'omit')).toEqual({
      ip: '203.0.113.9',
      setCookieHeaders: ['hop=one; Path=/', 'hop=two; Path=/; HttpOnly', 'extra=three'],
      credentialsMode: 'omit',
    });
  });

  it('omits absent facts and carries the credentials mode', () => {
    const chain = [chainStart('9', URL_A), headersReceived('9', URL_A, []), completed('9', URL_A)];
    expect(aggregateWireCapture(chain, 'include')).toEqual({ credentialsMode: 'include' });
  });
});

describe('startWireCapture', () => {
  function installFakeSource(): (event: WebRequestEvent) => void {
    let listener: ((event: WebRequestEvent) => void) | null = null;
    registerExtensionTrafficSource((l) => {
      listener = l;
      return () => {
        listener = null;
      };
    });
    return (event) => listener?.(event);
  }

  it('captures a full chain end-to-end', async () => {
    const emit = installFakeSource();
    const capture = startWireCapture({ method: 'GET', url: URL_A, credentialsMode: 'omit' });
    emit(chainStart('5', URL_A, { timeStamp: Date.now() }));
    emit(headersReceived('5', URL_A, ['session=abc; Path=/; HttpOnly']));
    emit(completed('5', URL_A, '203.0.113.5'));

    await expect(capture.settle()).resolves.toEqual({
      ip: '203.0.113.5',
      setCookieHeaders: ['session=abc; Path=/; HttpOnly'],
      credentialsMode: 'omit',
    });
  });

  it('matches the fetch-normalized URL spelling', async () => {
    const emit = installFakeSource();
    const capture = startWireCapture({ method: 'GET', url: 'https://api.openheaders.io', credentialsMode: 'omit' });
    emit(chainStart('6', 'https://api.openheaders.io/', { timeStamp: Date.now() }));
    emit(completed('6', 'https://api.openheaders.io/', '203.0.113.6'));

    await expect(capture.settle()).resolves.toEqual({ ip: '203.0.113.6', credentialsMode: 'omit' });
  });

  it('settles to undefined when the join is ambiguous', async () => {
    const emit = installFakeSource();
    const capture = startWireCapture({ method: 'GET', url: URL_A, credentialsMode: 'omit' });
    emit(chainStart('7', URL_A, { timeStamp: Date.now() }));
    emit(completed('7', URL_A, '203.0.113.7'));
    emit(chainStart('8', URL_A, { timeStamp: Date.now() }));
    emit(completed('8', URL_A, '203.0.113.8'));

    await expect(capture.settle()).resolves.toBeUndefined();
  });

  it('settles to undefined when nothing matched', async () => {
    installFakeSource();
    const capture = startWireCapture({ method: 'GET', url: URL_A, credentialsMode: 'omit' });
    await expect(capture.settle()).resolves.toBeUndefined();
  });

  it('cancel unsubscribes and settle after cancel yields undefined', async () => {
    const emit = installFakeSource();
    const capture = startWireCapture({ method: 'GET', url: URL_A, credentialsMode: 'omit' });
    capture.cancel();
    emit(chainStart('9', URL_A, { timeStamp: Date.now() }));
    await expect(capture.settle()).resolves.toBeUndefined();
  });

  it('is inert when no source is registered', async () => {
    vi.resetModules();
    const fresh = await import('@/background/modules/request-executor/wire-capture');
    const capture = fresh.startWireCapture({ method: 'GET', url: URL_A, credentialsMode: 'omit' });
    await expect(capture.settle()).resolves.toBeUndefined();
  });
});
