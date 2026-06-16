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
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  const pauses: Array<{ tabId: number; requestId: string; pausedMs: number }> = [];
  const stop = startCdpFetchInterceptor({
    subscribeFetch: stream.subscribeFetch,
    requestControlPort: port,
    getRules: () => rules,
    reportFire: (tabId, record) => fires.push({ tabId, record }),
    reportPause: (tabId, requestId, pausedMs) => pauses.push({ tabId, requestId, pausedMs }),
  });
  return { stream, port, fires, pauses, stop };
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

describe('startCdpFetchInterceptor — network-source Response-stage round-trip (D2b-1)', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A debug-tier network-source static response over `api.openheaders.io`. */
  const networkRule = (overrides: Partial<Rule> = {}): Rule =>
    mockRule({
      action: {
        responseSource: 'network',
        statusCode: 0,
        responseHeaders: { 'X-Mock': 'yes' },
        responseBody: '{"overridden":true}',
        contentType: '',
        bodyType: 'static',
      },
      ...overrides,
    } as Partial<Rule>);

  const responseStage = (overrides: Partial<CdpRequestPaused> = {}): CdpRequestPaused =>
    makePaused({
      requestId: 'resp-1',
      networkId: 'net-9',
      responseStatusCode: 200,
      responseStatusText: 'OK',
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      ...overrides,
    });

  it('continues the request stage with interceptResponse and does NOT fire yet', async () => {
    const { stream, port, fires } = harness([networkRule()]);

    stream.emit(makePaused({ requestId: 'req-1', networkId: 'net-9' }));
    await Promise.resolve();

    expect(port.reactions).toEqual([
      {
        kind: 'continue',
        target: { tabId: 7, sessionId: 'page' },
        request: { requestId: 'req-1', interceptResponse: true },
      },
    ]);
    expect(fires).toHaveLength(0);
  });

  it('fulfills at the Response stage with the literal body + merged headers, firing once', async () => {
    const { stream, port, fires } = harness([networkRule()]);

    stream.emit(makePaused({ requestId: 'req-1', networkId: 'net-9' }));
    await Promise.resolve();
    stream.emit(responseStage());
    await Promise.resolve();

    const fulfill = port.reactions.find((r) => r.kind === 'fulfill');
    if (fulfill?.kind !== 'fulfill') throw new Error('expected a fulfill');
    expect(fulfill.response.requestId).toBe('resp-1');
    expect(fulfill.response.responseCode).toBe(200);
    expect(atob(fulfill.response.body ?? '')).toBe('{"overridden":true}');
    expect(fulfill.response.responseHeaders).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Mock', value: 'yes' },
    ]);

    // Exactly one fire — at the Response stage, keyed by the store id.
    expect(fires).toHaveLength(1);
    expect(fires[0]?.record.requestId).toBe('page::net-9');
  });

  it('releases the reply with continueResponse (no fire) when no rule still matches', async () => {
    const { stream, port, fires } = harness([networkRule()]);

    stream.emit(makePaused({ requestId: 'req-1', networkId: 'net-9' }));
    await Promise.resolve();
    stream.emit(responseStage({ request: { url: 'https://other.openheaders.io/x', method: 'GET' } }));
    await Promise.resolve();

    expect(port.reactions.some((r) => r.kind === 'continue-response')).toBe(true);
    expect(port.reactions.some((r) => r.kind === 'fulfill')).toBe(false);
    expect(fires).toHaveLength(0);
  });

  it('sums the request-stage and response-stage holds into one pausedByDebugMs', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000) // request-stage receipt
      .mockReturnValueOnce(1_004) // request-stage answer-land (hold = 4)
      .mockReturnValueOnce(2_000) // response-stage receipt
      .mockReturnValue(2_010); // fire `t` + response-stage measurement (hold = 10)
    const { stream, pauses, fires } = harness([networkRule()]);

    stream.emit(makePaused({ requestId: 'req-1', networkId: 'net-9' }));
    await Promise.resolve();
    stream.emit(responseStage());
    await Promise.resolve();

    expect(pauses).toEqual([{ tabId: 7, requestId: 'page::net-9', pausedMs: 14 }]);
    expect(fires).toHaveLength(1);
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

describe('startCdpFetchInterceptor — interception-hold recording (D4c)', () => {
  // The hold = answer-land − pause-receipt. Date.now's first call is the
  // receipt stamp; every later call (the fire `t`, the pause measurement) reads
  // the answer-land value, so the difference is the controlled hold.
  afterEach(() => vi.restoreAllMocks());

  it('records a material hold for a pass-through paused request, keyed by its store id', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_042);
    const { stream, pauses } = harness([]);

    stream.emit(makePaused({ requestId: 'a', sessionId: 'page', networkId: 'net-7' }));
    await Promise.resolve();

    expect(pauses).toEqual([{ tabId: 7, requestId: 'page::net-7', pausedMs: 42 }]);
  });

  it('records the hold for a fulfilled request (the hold is independent of the answer)', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_010);
    const { stream, pauses, fires } = harness([mockRule()]);

    stream.emit(makePaused({ requestId: 'fx', networkId: 'net-9' }));
    await Promise.resolve();

    expect(pauses).toEqual([{ tabId: 7, requestId: 'page::net-9', pausedMs: 10 }]);
    expect(fires).toHaveLength(1);
  });

  it('does not record an immaterial sub-threshold hold', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(1_002);
    const { stream, pauses } = harness([]);

    stream.emit(makePaused({ networkId: 'net-7' }));
    await Promise.resolve();

    expect(pauses).toHaveLength(0);
  });

  it('does not record a hold when the pause carries no networkId (no lifecycle to join)', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(9_999);
    const { stream, pauses } = harness([]);

    stream.emit(makePaused({}));
    await Promise.resolve();

    expect(pauses).toHaveLength(0);
  });
});
