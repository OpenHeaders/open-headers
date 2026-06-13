/**
 * `startCdpFetchInterceptor` — the D2 rule-driven edge of the Fetch loop:
 * each `Fetch.requestPaused` is re-checked against the live rules and
 * answered (static `mock` → fulfill, static `body` → request-body rewrite,
 * everything else → pass-through), with a fulfill/rewrite reported as an
 * authoritative fire.
 */

import type { RequestRecord, Rule } from '@openheaders/core/types';
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

const ruleBase = {
  schemaVersion: 5 as const,
  uid: 'r1',
  path: 'rules/col-abc1/rule-r1',
  name: 'Test',
  enabled: true,
};

/** A debug-tier (unrestricted-reach) static mock over `api.openheaders.io`. */
function mockRule(overrides: Partial<Rule> = {}): Rule {
  return {
    ...ruleBase,
    type: 'mock',
    conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['api.openheaders.io'] }],
    action: {
      statusCode: 201,
      responseHeaders: { 'X-Mock': 'yes' },
      responseBody: '{"mocked":true}',
      contentType: 'application/json',
      bodyType: 'static',
    },
    ...overrides,
  } as Rule;
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

function harness(rules: readonly Rule[]) {
  const stream = fakeFetchStream();
  const port = createInMemoryRequestControlPort();
  const fires: Array<{ tabId: number; record: RequestRecord }> = [];
  const stop = startCdpFetchInterceptor({
    subscribeFetch: stream.subscribeFetch,
    requestControlPort: port,
    getRules: () => rules,
    reportFire: (tabId, record) => fires.push({ tabId, record }),
  });
  return { stream, port, fires, stop };
}

describe('startCdpFetchInterceptor (D2)', () => {
  it('passes through when no rule matches the paused request', () => {
    const { stream, port, fires } = harness([]);

    stream.emit(makePaused({ requestId: 'a', sessionId: 'page' }));
    stream.emit(makePaused({ requestId: 'b', sessionId: 'child-1' }));

    expect(port.reactions).toEqual([
      { kind: 'continue', target: { tabId: 7, sessionId: 'page' }, request: { requestId: 'a' } },
      { kind: 'continue', target: { tabId: 7, sessionId: 'child-1' }, request: { requestId: 'b' } },
    ]);
    expect(fires).toHaveLength(0);
  });

  it('fulfills a matching static mock and reports an authoritative fire', async () => {
    const { stream, port, fires } = harness([mockRule()]);

    stream.emit(makePaused({ requestId: 'fx', networkId: 'net-9' }));
    await Promise.resolve();

    expect(port.reactions).toHaveLength(1);
    const reaction = port.reactions[0];
    if (reaction?.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.target).toEqual({ tabId: 7, sessionId: 'page' });
    expect(reaction.response.requestId).toBe('fx');
    expect(reaction.response.responseCode).toBe(201);
    expect(reaction.response.responseHeaders).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Mock', value: 'yes' },
    ]);
    expect(atob(reaction.response.body ?? '')).toBe('{"mocked":true}');

    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({
      tabId: 7,
      record: {
        ruleUid: 'r1',
        url: 'https://api.openheaders.io/users',
        evidence: 'confirmed',
        requestId: 'page::net-9',
      },
    });
    expect(fires[0]?.record.resourceType).toBe('main_frame');
  });

  it('rewrites the request body for a matching static body rule', async () => {
    const bodyRule: Rule = {
      ...ruleBase,
      type: 'body',
      conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['api.openheaders.io'] }],
      action: { bodyType: 'static', body: '{"override":1}', resourceType: 'rest' },
    } as Rule;
    const { stream, port, fires } = harness([bodyRule]);

    stream.emit(makePaused({ requestId: 'bd', request: { url: 'https://api.openheaders.io/x', method: 'POST' } }));
    await Promise.resolve();

    const reaction = port.reactions[0];
    if (reaction?.kind !== 'continue') throw new Error('expected continue');
    expect(reaction.request.requestId).toBe('bd');
    expect(atob(reaction.request.postData ?? '')).toBe('{"override":1}');
    expect(fires).toHaveLength(1);
    expect(fires[0]?.record.ruleUid).toBe('r1');
  });

  it('passes through (no fire) a dynamic mock — the host cannot eval its body', () => {
    const dynamic = mockRule({
      action: {
        statusCode: 200,
        responseHeaders: {},
        responseBody: 'function modifyResponse(){return {}}',
        contentType: 'application/json',
        bodyType: 'dynamic',
      },
    } as Partial<Rule>);
    const { stream, port, fires } = harness([dynamic]);

    stream.emit(makePaused());

    const reaction = port.reactions[0];
    if (reaction?.kind !== 'continue') throw new Error('expected pass-through continue');
    expect(reaction.request).toEqual({ requestId: 'intercept-1' });
    expect(fires).toHaveLength(0);
  });

  it('omits the fire requestId when the pause carries no networkId', async () => {
    const { stream, fires } = harness([mockRule()]);

    stream.emit(makePaused({ requestId: 'fx' }));
    await Promise.resolve();

    expect(fires[0]?.record.requestId).toBeUndefined();
  });

  it('stops answering after unsubscribe', () => {
    const { stream, port, stop } = harness([mockRule()]);

    stop();
    stream.emit(makePaused());

    expect(port.reactions).toHaveLength(0);
  });
});
