/**
 * `resolveFetchReaction` — the authoritative request-stage re-check that
 * turns a paused request + the live rules into a fulfill / rewrite /
 * pass-through. The `Fetch.enable` urlPattern set is only coarse; this is
 * where domains, methods, resource types, the GraphQL filter, and the
 * static/dynamic split are enforced.
 */

import type { Rule } from '@openheaders/core/types';
import type { CdpAuthRequired, CdpRequestPaused } from '@openheaders/oracle/correlator-cdp';
import { describe, expect, it } from 'vitest';

import {
  buildEvalFulfill,
  buildNetworkEvalFulfill,
  buildRequestBodyEvalContinue,
  cdpResourceTypeToCondition,
  cdpResourceTypeToTracked,
  decodeResponseBody,
  mockResponseEvalArg,
  networkResponseEvalArg,
  requestBodyEvalArg,
  resolveAuthReaction,
  resolveFetchReaction,
  resolveResponseReaction,
  wrapMockResponseFn,
  wrapNetworkResponseFn,
  wrapRequestBodyFn,
} from '@/background/correlator-host/cdp-fetch-reaction';

const ruleBase = {
  schemaVersion: 5 as const,
  uid: 'r1',
  path: 'rules/col-abc1/rule-r1',
  name: 'Test',
  enabled: true,
};

function paused(overrides: Partial<CdpRequestPaused> = {}): CdpRequestPaused {
  return {
    method: 'Fetch.requestPaused',
    tabId: 1,
    sessionId: 'page',
    requestId: 'i1',
    request: { url: 'https://api.openheaders.io/users', method: 'GET' },
    resourceType: 'Document',
    ...overrides,
  };
}

function mock(conditions: Rule['conditions'], action?: Record<string, unknown>): Rule {
  return {
    ...ruleBase,
    type: 'response',
    conditions,
    action: {
      responseSource: 'mock',
      statusCode: 200,
      responseHeaders: {},
      responseBody: 'ok',
      contentType: 'text/plain',
      bodyType: 'static',
      ...action,
    },
  } as Rule;
}

const domain = (...values: string[]): Rule['conditions'][number] => ({
  uid: 'c1',
  type: 'request-domains',
  values,
});

describe('resolveFetchReaction', () => {
  it('fulfills a matching debug-tier static mock', () => {
    const reaction = resolveFetchReaction(paused(), [mock([domain('api.openheaders.io')])]);
    expect(reaction.kind).toBe('fulfill');
    if (reaction.kind !== 'fulfill') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.response.responseCode).toBe(200);
    expect(reaction.response.responseHeaders).toEqual([{ name: 'Content-Type', value: 'text/plain' }]);
    expect(atob(reaction.response.body ?? '')).toBe('ok');
  });

  it('passes through when the URL does not match', () => {
    const reaction = resolveFetchReaction(paused(), [mock([domain('other.openheaders.io')])]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('treats a no-URL debug rule as match-all (coarse pattern was *)', () => {
    const reaction = resolveFetchReaction(paused(), [mock([{ uid: 'c1', type: 'resource-types', values: ['page'] }])]);
    expect(reaction.kind).toBe('fulfill');
  });

  it('skips a standard (xhr-confined) mock — not debug-tier', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io'), { uid: 'c2', type: 'resource-types', values: ['xhr'] }]),
    ]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('enforces a resource-types restriction against the mapped CDP type', () => {
    const onlyImages = mock([domain('api.openheaders.io'), { uid: 'c2', type: 'resource-types', values: ['image'] }]);
    expect(resolveFetchReaction(paused({ resourceType: 'Document' }), [onlyImages]).kind).toBe('pass-through');
    expect(resolveFetchReaction(paused({ resourceType: 'Image' }), [onlyImages]).kind).toBe('fulfill');
  });

  it('enforces request-methods', () => {
    const postOnly = mock([domain('api.openheaders.io'), { uid: 'c2', type: 'request-methods', values: ['POST'] }]);
    expect(
      resolveFetchReaction(paused({ request: { url: 'https://api.openheaders.io/u', method: 'GET' } }), [postOnly])
        .kind,
    ).toBe('pass-through');
    expect(
      resolveFetchReaction(paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST' } }), [postOnly])
        .kind,
    ).toBe('fulfill');
  });

  it('honors exclude-request-domains (including subdomains)', () => {
    const reaction = resolveFetchReaction(paused({ request: { url: 'https://cdn.openheaders.io/a', method: 'GET' } }), [
      mock([domain('openheaders.io'), { uid: 'c2', type: 'exclude-request-domains', values: ['cdn.openheaders.io'] }]),
    ]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('passes through a rule with a condition the request stage cannot evaluate', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io'), { uid: 'c2', type: 'initiator-domains', values: ['app.openheaders.io'] }]),
    ]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('yields an eval-fulfill plan for a mock+dynamic rule (D2b-2a)', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], {
        bodyType: 'dynamic',
        responseBody: 'function buildResponse(a){return {id:a.url};}',
      }),
    ]);
    expect(reaction.kind).toBe('eval-fulfill');
    if (reaction.kind !== 'eval-fulfill') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.plan.userCode).toBe('function buildResponse(a){return {id:a.url};}');
    expect(reaction.plan.statusCode).toBe(200);
    expect(reaction.plan.contentType).toBe('text/plain');
    expect(reaction.plan.responseHeaders).toEqual({});
  });

  it('defaults a mock+dynamic plan status to 200 and CT to JSON', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], { bodyType: 'dynamic', statusCode: 0, contentType: '' }),
    ]);
    if (reaction.kind !== 'eval-fulfill') throw new Error('expected eval-fulfill');
    expect(reaction.plan.statusCode).toBe(200);
    expect(reaction.plan.contentType).toBe('application/json');
  });

  it('sends a network-source static response to the Response stage (interceptResponse, no fire yet)', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], { responseSource: 'network' }),
    ]);
    expect(reaction.kind).toBe('await-response');
    if (reaction.kind !== 'await-response') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.request).toEqual({ requestId: 'i1', interceptResponse: true });
  });

  it('defers a network-source rule with a response-header condition to the Response stage', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io'), { uid: 'c2', type: 'response-header', headerName: 'X-Cache', values: [] }], {
        responseSource: 'network',
      }),
    ]);
    expect(reaction.kind).toBe('await-response');
  });

  it('sends a network-source DYNAMIC response to the Response stage too (D2b-2b)', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], { responseSource: 'network', bodyType: 'dynamic' }),
    ]);
    expect(reaction.kind).toBe('await-response');
    if (reaction.kind !== 'await-response') return;
    expect(reaction.request).toEqual({ requestId: 'i1', interceptResponse: true });
  });

  it('rewrites the request body for a static request-body rule', () => {
    const bodyRule = {
      ...ruleBase,
      type: 'request-body',
      conditions: [domain('api.openheaders.io')],
      action: { bodyType: 'static', requestBody: '{"v":1}', resourceType: 'rest' },
    } as Rule;
    const reaction = resolveFetchReaction(
      paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST' } }),
      [bodyRule],
    );
    expect(reaction.kind).toBe('continue');
    if (reaction.kind !== 'continue') return;
    expect(atob(reaction.request.postData ?? '')).toBe('{"v":1}');
  });

  it('yields an eval-continue plan for a dynamic request-body rule (D2b-2c)', () => {
    const bodyRule = {
      ...ruleBase,
      type: 'request-body',
      conditions: [domain('api.openheaders.io')],
      action: {
        bodyType: 'dynamic',
        requestBody: 'function modifyRequestBody(a){return a.body.toUpperCase();}',
        resourceType: 'rest',
      },
    } as Rule;
    const reaction = resolveFetchReaction(
      paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST', postData: '{"v":1}' } }),
      [bodyRule],
    );
    expect(reaction.kind).toBe('eval-continue');
    if (reaction.kind !== 'eval-continue') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.plan).toEqual({ userCode: 'function modifyRequestBody(a){return a.body.toUpperCase();}' });
  });

  it('overrides the default Content-Type when the action sets one', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], { responseHeaders: { 'Content-Type': 'application/xml' } }),
    ]);
    if (reaction.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.response.responseHeaders).toEqual([{ name: 'Content-Type', value: 'application/xml' }]);
  });

  describe('GraphQL filter gate', () => {
    const gqlMock = (action: Record<string, unknown>) =>
      mock([domain('api.openheaders.io')], { resourceType: 'graphql', ...action });

    const filtered = {
      graphqlFilter: { key: 'operationName', operator: 'Equals' as const, value: 'GetUser' },
    };

    it('fulfills when the request body satisfies the filter', () => {
      const event = paused({
        request: { url: 'https://api.openheaders.io/graphql', method: 'POST', postData: '{"operationName":"GetUser"}' },
      });
      expect(resolveFetchReaction(event, [gqlMock(filtered)]).kind).toBe('fulfill');
    });

    it('passes through when the body fails the filter', () => {
      const event = paused({
        request: { url: 'https://api.openheaders.io/graphql', method: 'POST', postData: '{"operationName":"Other"}' },
      });
      expect(resolveFetchReaction(event, [gqlMock(filtered)]).kind).toBe('pass-through');
    });

    it('passes through when the filter is active but the body is absent', () => {
      const event = paused({ request: { url: 'https://api.openheaders.io/graphql', method: 'POST' } });
      expect(resolveFetchReaction(event, [gqlMock(filtered)]).kind).toBe('pass-through');
    });
  });

  it('returns the first matching rule', () => {
    const a = mock([domain('api.openheaders.io')], { responseBody: 'first' });
    const b = mock([domain('api.openheaders.io')], { responseBody: 'second' });
    const reaction = resolveFetchReaction(paused(), [{ ...a, uid: 'a' } as Rule, { ...b, uid: 'b' } as Rule]);
    if (reaction.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.ruleUid).toBe('a');
    expect(atob(reaction.response.body ?? '')).toBe('first');
  });
});

describe('resolveResponseReaction', () => {
  const networkMock = (conditions: Rule['conditions'], action?: Record<string, unknown>): Rule =>
    mock(conditions, { responseSource: 'network', ...action });

  const respPaused = (overrides: Partial<CdpRequestPaused> = {}): CdpRequestPaused =>
    paused({
      responseStatusCode: 200,
      responseStatusText: 'OK',
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'X-Origin', value: 'real' },
      ],
      ...overrides,
    });

  it('fulfills a network-source static rule with the literal body over the real status/headers', () => {
    const reaction = resolveResponseReaction(respPaused(), [
      networkMock([domain('api.openheaders.io')], {
        responseBody: 'overridden',
        statusCode: 0,
        contentType: '',
        responseHeaders: { 'X-Mock': 'yes' },
      }),
    ]);
    if (reaction.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.ruleUid).toBe('r1');
    // statusCode 0 keeps the real status; the real phrase is preserved.
    expect(reaction.response.responseCode).toBe(200);
    expect(reaction.response.responsePhrase).toBe('OK');
    expect(atob(reaction.response.body ?? '')).toBe('overridden');
    // real headers kept (empty CT = no override) + the override appended.
    expect(reaction.response.responseHeaders).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Origin', value: 'real' },
      { name: 'X-Mock', value: 'yes' },
    ]);
  });

  it('overrides the real status and Content-Type when set', () => {
    const reaction = resolveResponseReaction(respPaused(), [
      networkMock([domain('api.openheaders.io')], { statusCode: 503, contentType: 'text/plain' }),
    ]);
    if (reaction.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.response.responseCode).toBe(503);
    expect(reaction.response.responseHeaders).toEqual([
      { name: 'X-Origin', value: 'real' },
      { name: 'Content-Type', value: 'text/plain' },
    ]);
  });

  it('drops body-framing headers (the substituted body invalidates them)', () => {
    const reaction = resolveResponseReaction(
      respPaused({
        responseHeaders: [
          { name: 'Content-Encoding', value: 'gzip' },
          { name: 'Content-Length', value: '999' },
          { name: 'X-Keep', value: '1' },
        ],
      }),
      [networkMock([domain('api.openheaders.io')], { contentType: '' })],
    );
    if (reaction.kind !== 'fulfill') throw new Error('expected fulfill');
    expect(reaction.response.responseHeaders).toEqual([{ name: 'X-Keep', value: '1' }]);
  });

  it('evaluates a response-header condition against the real reply', () => {
    const rule = networkMock([
      domain('api.openheaders.io'),
      { uid: 'c2', type: 'response-header', headerName: 'X-Origin', values: ['real'] },
    ]);
    expect(resolveResponseReaction(respPaused(), [rule]).kind).toBe('fulfill');
    expect(
      resolveResponseReaction(respPaused({ responseHeaders: [{ name: 'X-Origin', value: 'cache' }] }), [rule]).kind,
    ).toBe('pass-through');
  });

  it('honors exclude-response-header (a present-and-matching header disqualifies)', () => {
    const rule = networkMock([
      domain('api.openheaders.io'),
      { uid: 'c2', type: 'exclude-response-header', headerName: 'X-Origin', values: ['real'] },
    ]);
    expect(resolveResponseReaction(respPaused(), [rule]).kind).toBe('pass-through');
  });

  it('passes through when the real request failed (responseErrorReason set)', () => {
    const reaction = resolveResponseReaction(
      respPaused({ responseStatusCode: undefined, responseHeaders: undefined, responseErrorReason: 'Failed' }),
      [networkMock([domain('api.openheaders.io')])],
    );
    expect(reaction.kind).toBe('pass-through');
  });

  it('ignores a mock-source rule (it acts at the request stage, not the response stage)', () => {
    expect(resolveResponseReaction(respPaused(), [mock([domain('api.openheaders.io')])]).kind).toBe('pass-through');
  });

  it('yields an eval-response-fulfill plan for a network+dynamic rule (D2b-2b)', () => {
    const reaction = resolveResponseReaction(respPaused(), [
      networkMock([domain('api.openheaders.io')], {
        bodyType: 'dynamic',
        responseBody: 'function modifyResponse(a){return a.response;}',
        statusCode: 0,
        contentType: '',
        responseHeaders: { 'X-Mod': 'yes' },
      }),
    ]);
    expect(reaction.kind).toBe('eval-response-fulfill');
    if (reaction.kind !== 'eval-response-fulfill') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.plan.userCode).toBe('function modifyResponse(a){return a.response;}');
    // Network envelope: no mock defaults — 0 keeps the real status, '' keeps CT.
    expect(reaction.plan.statusCode).toBe(0);
    expect(reaction.plan.contentType).toBe('');
    expect(reaction.plan.responseHeaders).toEqual({ 'X-Mod': 'yes' });
  });

  it('still evaluates response-header conditions for a network+dynamic rule', () => {
    const rule = networkMock(
      [domain('api.openheaders.io'), { uid: 'c2', type: 'response-header', headerName: 'X-Origin', values: ['real'] }],
      { bodyType: 'dynamic' },
    );
    expect(resolveResponseReaction(respPaused(), [rule]).kind).toBe('eval-response-fulfill');
    expect(
      resolveResponseReaction(respPaused({ responseHeaders: [{ name: 'X-Origin', value: 'cache' }] }), [rule]).kind,
    ).toBe('pass-through');
  });
});

function authChallenge(overrides: Partial<CdpAuthRequired> = {}): CdpAuthRequired {
  return {
    method: 'Fetch.authRequired',
    tabId: 1,
    sessionId: 'page',
    requestId: 'i1',
    request: { url: 'https://staging.openheaders.io/', method: 'GET' },
    resourceType: 'Document',
    authChallenge: { source: 'Proxy', origin: 'https://staging.openheaders.io', scheme: 'basic', realm: 'dev' },
    ...overrides,
  };
}

function authRule(conditions: Rule['conditions'], action?: Record<string, unknown>): Rule {
  return {
    ...ruleBase,
    type: 'auth',
    conditions,
    action: { username: 'devuser', password: 's3cr3t', ...action },
  } as Rule;
}

describe('resolveAuthReaction', () => {
  it('provides the matching auth rule credentials', () => {
    const reaction = resolveAuthReaction(authChallenge(), [authRule([domain('staging.openheaders.io')])]);
    expect(reaction.kind).toBe('provide');
    if (reaction.kind !== 'provide') return;
    expect(reaction.ruleUid).toBe('r1');
    expect(reaction.username).toBe('devuser');
    expect(reaction.password).toBe('s3cr3t');
  });

  it('answers Default when no auth rule matches the challenged URL (never cancels)', () => {
    const reaction = resolveAuthReaction(authChallenge(), [authRule([domain('other.openheaders.io')])]);
    expect(reaction.kind).toBe('default');
  });

  it('answers Default when there is no auth rule at all', () => {
    const reaction = resolveAuthReaction(authChallenge(), [mock([domain('staging.openheaders.io')])]);
    expect(reaction.kind).toBe('default');
  });

  it('answers Default for an auth rule carrying a condition the stage cannot evaluate (never over-applies)', () => {
    const reaction = resolveAuthReaction(authChallenge(), [
      authRule([
        domain('staging.openheaders.io'),
        { uid: 'c2', type: 'initiator-domains', values: ['app.openheaders.io'] },
      ]),
    ]);
    expect(reaction.kind).toBe('default');
  });

  it('enforces request-methods on the challenged request', () => {
    const postOnly = authRule([
      domain('staging.openheaders.io'),
      { uid: 'c2', type: 'request-methods', values: ['POST'] },
    ]);
    expect(resolveAuthReaction(authChallenge(), [postOnly]).kind).toBe('default');
    expect(
      resolveAuthReaction(authChallenge({ request: { url: 'https://staging.openheaders.io/', method: 'POST' } }), [
        postOnly,
      ]).kind,
    ).toBe('provide');
  });

  it('returns the first matching auth rule', () => {
    const a = { ...authRule([domain('staging.openheaders.io')], { username: 'first' }), uid: 'a' } as Rule;
    const b = { ...authRule([domain('staging.openheaders.io')], { username: 'second' }), uid: 'b' } as Rule;
    const reaction = resolveAuthReaction(authChallenge(), [a, b]);
    if (reaction.kind !== 'provide') throw new Error('expected provide');
    expect(reaction.ruleUid).toBe('a');
    expect(reaction.username).toBe('first');
  });
});

describe('CDP resource-type mapping', () => {
  it('maps the condition vocabulary', () => {
    expect(cdpResourceTypeToCondition('Document')).toBe('page');
    expect(cdpResourceTypeToCondition('XHR')).toBe('xhr');
    expect(cdpResourceTypeToCondition('Fetch')).toBe('xhr');
    expect(cdpResourceTypeToCondition('WebSocket')).toBe('websocket');
    expect(cdpResourceTypeToCondition('EventSource')).toBe('other');
  });

  it('maps the fire-record vocabulary', () => {
    expect(cdpResourceTypeToTracked('Document')).toBe('main_frame');
    expect(cdpResourceTypeToTracked('XHR')).toBe('xmlhttprequest');
    expect(cdpResourceTypeToTracked('Fetch')).toBe('xmlhttprequest');
    expect(cdpResourceTypeToTracked('Other')).toBe('other');
  });
});

describe('mock+dynamic eval helpers (D2b-2a)', () => {
  it('mockResponseEvalArg sources method/url/requestBody from the paused request', () => {
    const arg = mockResponseEvalArg(
      paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST', postData: '{"a":1}' } }),
    );
    expect(arg).toEqual({ method: 'POST', url: 'https://api.openheaders.io/u', requestBody: '{"a":1}' });
  });

  it('mockResponseEvalArg defaults an absent request body to empty string', () => {
    expect(mockResponseEvalArg(paused()).requestBody).toBe('');
  });

  it('wrapMockResponseFn defines buildResponse, calls it, and JSON-stringifies an object result in-realm', () => {
    const decl = wrapMockResponseFn('function buildResponse(a){ return { id: a.url }; }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({ method: 'GET', url: 'u', requestBody: '' })).toBe('{"id":"u"}');
  });

  it('wrapMockResponseFn String()-coerces a non-object result (matching the injection path)', () => {
    const decl = wrapMockResponseFn('function buildResponse(){ return 42; }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({})).toBe('42');
  });

  it('buildEvalFulfill lays the plan envelope (status/CT/headers) over the eval body', () => {
    const fulfill = buildEvalFulfill(
      'req-1',
      { userCode: '', statusCode: 201, contentType: 'application/json', responseHeaders: { 'X-Mock': 'yes' } },
      '{"ok":1}',
    );
    expect(fulfill.requestId).toBe('req-1');
    expect(fulfill.responseCode).toBe(201);
    expect(fulfill.responseHeaders).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Mock', value: 'yes' },
    ]);
    expect(atob(fulfill.body ?? '')).toBe('{"ok":1}');
  });
});

describe('network+dynamic eval helpers (D2b-2b)', () => {
  const utf8B64 = (s: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

  const respWithBody = (overrides: Partial<CdpRequestPaused> = {}): CdpRequestPaused =>
    paused({
      responseStatusCode: 200,
      responseStatusText: 'OK',
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Content-Length', value: '5' },
        { name: 'X-Origin', value: 'real' },
      ],
      ...overrides,
    });

  it('networkResponseEvalArg builds the faithful modifyArgs from the request + real reply', () => {
    const event = paused({
      request: {
        url: 'https://api.openheaders.io/u',
        method: 'POST',
        postData: '{"q":1}',
        headers: { 'X-Token': 'abc' },
      },
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    });
    expect(networkResponseEvalArg(event, '{"id":7}')).toEqual({
      method: 'POST',
      url: 'https://api.openheaders.io/u',
      response: '{"id":7}',
      responseType: 'application/json',
      requestHeaders: { 'X-Token': 'abc' },
      requestData: '{"q":1}',
      responseJSON: { id: 7 },
    });
  });

  it('networkResponseEvalArg reads responseType case-insensitively from the real headers', () => {
    const arg = networkResponseEvalArg(paused({ responseHeaders: [{ name: 'content-type', value: 'text/html' }] }), '');
    expect(arg.responseType).toBe('text/html');
  });

  it('networkResponseEvalArg guards responseJSON to null and defaults absent request fields', () => {
    const arg = networkResponseEvalArg(paused(), 'not json');
    expect(arg.responseJSON).toBeNull();
    expect(arg.requestData).toBeNull();
    expect(arg.requestHeaders).toEqual({});
  });

  it('wrapNetworkResponseFn defines modifyResponse, calls it, and JSON-stringifies an object result in-realm', () => {
    const decl = wrapNetworkResponseFn('function modifyResponse(a){ return { echoed: a.response }; }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({ response: 'hi' })).toBe('{"echoed":"hi"}');
  });

  it('wrapNetworkResponseFn String()-coerces a non-object result (matching the injection path)', () => {
    const decl = wrapNetworkResponseFn('function modifyResponse(a){ return a.response.toUpperCase(); }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({ response: 'hi' })).toBe('HI');
  });

  it('buildNetworkEvalFulfill lays the eval body over the real status/headers (status 0 keeps real)', () => {
    const fulfill = buildNetworkEvalFulfill(
      respWithBody(),
      { userCode: '', statusCode: 0, contentType: '', responseHeaders: { 'X-Mod': 'yes' } },
      '{"transformed":1}',
    );
    expect(fulfill.responseCode).toBe(200);
    expect(fulfill.responsePhrase).toBe('OK');
    expect(atob(fulfill.body ?? '')).toBe('{"transformed":1}');
    // Real headers minus framing (Content-Length dropped), override appended.
    expect(fulfill.responseHeaders).toEqual([
      { name: 'Content-Type', value: 'application/json' },
      { name: 'X-Origin', value: 'real' },
      { name: 'X-Mod', value: 'yes' },
    ]);
  });

  it('buildNetworkEvalFulfill applies a status + Content-Type override', () => {
    const fulfill = buildNetworkEvalFulfill(
      respWithBody({ responseHeaders: [{ name: 'X-Origin', value: 'real' }] }),
      { userCode: '', statusCode: 503, contentType: 'text/plain', responseHeaders: {} },
      'down',
    );
    expect(fulfill.responseCode).toBe(503);
    expect(fulfill.responseHeaders).toEqual([
      { name: 'X-Origin', value: 'real' },
      { name: 'Content-Type', value: 'text/plain' },
    ]);
  });

  it('decodeResponseBody returns plain text verbatim and decodes base64 as UTF-8', () => {
    expect(decodeResponseBody({ body: 'hello', base64Encoded: false })).toBe('hello');
    expect(decodeResponseBody({ body: utf8B64('héllo ☕'), base64Encoded: true })).toBe('héllo ☕');
  });
});

describe('request-body+dynamic eval helpers (D2b-2c)', () => {
  it('requestBodyEvalArg builds the faithful modifyArgs (method/url/body/bodyAsJson)', () => {
    const event = paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST' } });
    expect(requestBodyEvalArg(event, '{"q":1}')).toEqual({
      method: 'POST',
      url: 'https://api.openheaders.io/u',
      body: '{"q":1}',
      bodyAsJson: { q: 1 },
    });
  });

  it('requestBodyEvalArg guards bodyAsJson to null on a non-JSON body', () => {
    const arg = requestBodyEvalArg(paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST' } }), 'raw');
    expect(arg.body).toBe('raw');
    expect(arg.bodyAsJson).toBeNull();
  });

  it('wrapRequestBodyFn defines modifyRequestBody, calls it, and JSON-stringifies an object result in-realm', () => {
    const decl = wrapRequestBodyFn('function modifyRequestBody(a){ return { wrapped: a.bodyAsJson }; }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({ body: '{"v":1}', bodyAsJson: { v: 1 } })).toBe('{"wrapped":{"v":1}}');
  });

  it('wrapRequestBodyFn String()-coerces a non-object result (matching the injection path)', () => {
    const decl = wrapRequestBodyFn('function modifyRequestBody(a){ return a.body.toUpperCase(); }');
    const fn = new Function(`return (${decl})`)() as (arg: unknown) => string;
    expect(fn({ body: 'hi' })).toBe('HI');
  });

  it('buildRequestBodyEvalContinue base64-encodes the eval body onto the continue', () => {
    const cont = buildRequestBodyEvalContinue('req-9', '{"new":1}');
    expect(cont.requestId).toBe('req-9');
    expect(atob(cont.postData ?? '')).toBe('{"new":1}');
  });
});
