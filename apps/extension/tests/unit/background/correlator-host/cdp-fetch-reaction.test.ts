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
  cdpResourceTypeToCondition,
  cdpResourceTypeToTracked,
  resolveAuthReaction,
  resolveFetchReaction,
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

  it('passes through a dynamic mock (host cannot eval the body)', () => {
    const reaction = resolveFetchReaction(paused(), [mock([domain('api.openheaders.io')], { bodyType: 'dynamic' })]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('passes through a network-source response (request stage cannot realize a real-reply modify)', () => {
    const reaction = resolveFetchReaction(paused(), [
      mock([domain('api.openheaders.io')], { responseSource: 'network' }),
    ]);
    expect(reaction.kind).toBe('pass-through');
  });

  it('rewrites the request body for a static body rule', () => {
    const bodyRule = {
      ...ruleBase,
      type: 'body',
      conditions: [domain('api.openheaders.io')],
      action: { bodyType: 'static', body: '{"v":1}', resourceType: 'rest' },
    } as Rule;
    const reaction = resolveFetchReaction(
      paused({ request: { url: 'https://api.openheaders.io/u', method: 'POST' } }),
      [bodyRule],
    );
    expect(reaction.kind).toBe('continue');
    if (reaction.kind !== 'continue') return;
    expect(atob(reaction.request.postData ?? '')).toBe('{"v":1}');
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
