/**
 * `startCdpFetchInterceptor` — the D2 rule-driven edge of the Fetch loop:
 * each `Fetch.requestPaused` is re-checked against the live rules and
 * answered (static `mock` → fulfill, static `body` → request-body rewrite,
 * everything else → pass-through), with a fulfill/rewrite reported as an
 * authoritative fire.
 */

import type { RequestRecord, Rule } from '@openheaders/core/types';
import type { CdpAuthRequired, CdpFetchEvent, CdpRequestPaused } from '@openheaders/oracle/correlator-cdp';
import { createInMemoryRequestControlPort } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it } from 'vitest';

import { startCdpFetchInterceptor } from '@/background/correlator-host/cdp-fetch-interceptor';

function makePaused(overrides: Partial<CdpRequestPaused> = {}): CdpRequestPaused {
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
    type: 'response',
    conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['api.openheaders.io'] }],
    action: {
      responseSource: 'mock',
      statusCode: 201,
      responseHeaders: { 'X-Mock': 'yes' },
      responseBody: '{"mocked":true}',
      contentType: 'application/json',
      bodyType: 'static',
    },
    ...overrides,
  } as Rule;
}

function makeAuthRequired(overrides: Partial<CdpAuthRequired> = {}): CdpAuthRequired {
  return {
    method: 'Fetch.authRequired',
    tabId: 7,
    sessionId: 'page',
    requestId: 'auth-1',
    request: { url: 'https://staging.openheaders.io/', method: 'GET' },
    resourceType: 'Document',
    authChallenge: { source: 'Proxy', origin: 'https://staging.openheaders.io', scheme: 'basic', realm: 'dev' },
    ...overrides,
  };
}

/** A debug-tier auth rule over `staging.openheaders.io`. */
function authRule(overrides: Partial<Rule> = {}): Rule {
  return {
    ...ruleBase,
    type: 'auth',
    conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['staging.openheaders.io'] }],
    action: { username: 'devuser', password: 's3cr3t-pw' },
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

  it('rewrites the request body for a matching static request-body rule', async () => {
    const bodyRule: Rule = {
      ...ruleBase,
      type: 'request-body',
      conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['api.openheaders.io'] }],
      action: { bodyType: 'static', requestBody: '{"override":1}', resourceType: 'rest' },
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
        responseSource: 'mock',
        statusCode: 200,
        responseHeaders: {},
        responseBody: 'function buildResponse(){return {}}',
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

describe('startCdpFetchInterceptor — auth challenges (D3)', () => {
  it('answers a matching challenge with ProvideCredentials and reports an authoritative fire', async () => {
    const { stream, port, fires } = harness([authRule()]);

    stream.emit(makeAuthRequired({ requestId: 'ax' }));
    await Promise.resolve();

    expect(port.reactions).toHaveLength(1);
    const reaction = port.reactions[0];
    if (reaction?.kind !== 'continue-with-auth') throw new Error('expected continue-with-auth');
    expect(reaction.target).toEqual({ tabId: 7, sessionId: 'page' });
    expect(reaction.request).toEqual({
      requestId: 'ax',
      authChallengeResponse: { response: 'ProvideCredentials', username: 'devuser', password: 's3cr3t-pw' },
    });

    expect(fires).toHaveLength(1);
    expect(fires[0]).toMatchObject({ tabId: 7, record: { ruleUid: 'r1', evidence: 'confirmed' } });
  });

  it('the auth fire record carries no credentials and no requestId (the auth event has no networkId)', async () => {
    const { stream, fires } = harness([authRule()]);

    stream.emit(makeAuthRequired());
    await Promise.resolve();

    const record = fires[0]?.record;
    expect(record?.requestId).toBeUndefined();
    // RequestRecord has no credential fields; assert the serialized record
    // never contains the secret value.
    expect(JSON.stringify(record)).not.toContain('s3cr3t-pw');
  });

  it('answers Default (no fire) when no auth rule owns the challenge', async () => {
    const { stream, port, fires } = harness([
      authRule({ conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['other.openheaders.io'] }] }),
    ]);

    stream.emit(makeAuthRequired());
    await Promise.resolve();

    expect(port.reactions).toEqual([
      {
        kind: 'continue-with-auth',
        target: { tabId: 7, sessionId: 'page' },
        request: { requestId: 'auth-1', authChallengeResponse: { response: 'Default' } },
      },
    ]);
    expect(fires).toHaveLength(0);
  });

  it('answers Default when there are no auth rules at all', () => {
    const { stream, port } = harness([mockRule()]);

    stream.emit(makeAuthRequired());

    expect(port.reactions).toEqual([
      {
        kind: 'continue-with-auth',
        target: { tabId: 7, sessionId: 'page' },
        request: { requestId: 'auth-1', authChallengeResponse: { response: 'Default' } },
      },
    ]);
  });
});
