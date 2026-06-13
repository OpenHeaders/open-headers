/**
 * `startCdpFetchInterceptor` — the D1 pass-through edge of the Fetch loop:
 * each `Fetch.requestPaused` answered with an unmodified `continueRequest`
 * on the request's own session, nothing fulfilled or rewritten.
 */

import type { CdpFetchEvent } from '@openheaders/oracle/correlator-cdp';
import { createInMemoryRequestControlPort } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it } from 'vitest';

import { startCdpFetchInterceptor } from '@/background/correlator-host/cdp-fetch-interceptor';

function makePaused(overrides: Partial<CdpFetchEvent> = {}): CdpFetchEvent {
  return {
    method: 'Fetch.requestPaused',
    tabId: 7,
    sessionId: 'page',
    requestId: 'intercept-1',
    request: { url: 'https://api.openheaders.io/users', method: 'GET' },
    resourceType: 'Document',
    ...overrides,
  };
}

/** A controllable `subscribeFetch` seam — emit drives the listeners. */
function fakeFetchStream() {
  const listeners = new Set<(event: CdpFetchEvent) => void>();
  return {
    subscribeFetch: (listener: (event: CdpFetchEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (event: CdpFetchEvent) => {
      for (const l of listeners) l(event);
    },
  };
}

describe('startCdpFetchInterceptor', () => {
  it('continues each paused request unmodified on its own session', () => {
    const stream = fakeFetchStream();
    const port = createInMemoryRequestControlPort();
    startCdpFetchInterceptor({ subscribeFetch: stream.subscribeFetch, requestControlPort: port });

    stream.emit(makePaused({ requestId: 'a', sessionId: 'page' }));
    stream.emit(makePaused({ requestId: 'b', sessionId: 'child-1', tabId: 7 }));

    expect(port.reactions).toEqual([
      { kind: 'continue', target: { tabId: 7, sessionId: 'page' }, request: { requestId: 'a' } },
      { kind: 'continue', target: { tabId: 7, sessionId: 'child-1' }, request: { requestId: 'b' } },
    ]);
  });

  it('never fulfills or answers-auth — pass-through only (nothing modified)', () => {
    const stream = fakeFetchStream();
    const port = createInMemoryRequestControlPort();
    startCdpFetchInterceptor({ subscribeFetch: stream.subscribeFetch, requestControlPort: port });

    stream.emit(makePaused());

    expect(port.reactions.every((r) => r.kind === 'continue')).toBe(true);
    expect(port.reactions[0]).toMatchObject({ request: { requestId: 'intercept-1' } });
    // No url/method/headers carried — an unmodified continue.
    const reaction = port.reactions[0];
    if (reaction?.kind !== 'continue') throw new Error('expected continue');
    expect(reaction.request).toEqual({ requestId: 'intercept-1' });
  });

  it('stops answering after unsubscribe', () => {
    const stream = fakeFetchStream();
    const port = createInMemoryRequestControlPort();
    const stop = startCdpFetchInterceptor({ subscribeFetch: stream.subscribeFetch, requestControlPort: port });

    stop();
    stream.emit(makePaused());

    expect(port.reactions).toHaveLength(0);
  });
});
