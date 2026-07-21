/**
 * Enforcement-planner laws (PROXY_PLAN.md Phase 3). Pure module — the
 * plan is derived from an injected rule source and one request's facts:
 *  - matching rides the core rule-matcher predicates: URL conditions
 *    required (no conditions ⇒ no match), method gates, resource-type
 *    conditions judge against the wire plane's `other` bucket;
 *  - header ops apply with extension-identical semantics (override /
 *    add / remove / merge), skipping capability-refused names;
 *  - block wins outright; redirect rewrites once; query-param mutates
 *    on top; delay rules sum;
 *  - a response-gated rule acts only on the response side, judged
 *    against the arrived headers.
 */

import type { HeaderModification, Rule, RuleCondition } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { createProxyRuleEnforcer } from '../../../src/daemon/proxy/rule-enforcement';

let seq = 0;
const uid = (): string => `uid-${++seq}`;

function urlCondition(pattern: string): RuleCondition {
  return { uid: uid(), type: 'url-filter', values: [pattern] };
}

function baseRule(type: Rule['type'], conditions: RuleCondition[]) {
  const id = uid();
  return {
    schemaVersion: 5,
    uid: id,
    path: `rules/collection/${id}`,
    name: `rule-${id}`,
    type,
    enabled: true,
    published: true,
    conditions,
  };
}

function headerRule(
  conditions: RuleCondition[],
  requestHeaders: Omit<HeaderModification, 'uid'>[],
  responseHeaders: Omit<HeaderModification, 'uid'>[] = [],
): Rule {
  return {
    ...baseRule('header', conditions),
    type: 'header',
    action: {
      requestHeaders: requestHeaders.map((m) => ({ uid: uid(), ...m })),
      responseHeaders: responseHeaders.map((m) => ({ uid: uid(), ...m })),
    },
  } as Rule;
}

function enforcerOf(rules: Rule[]) {
  return createProxyRuleEnforcer({ getRules: () => rules });
}

const URL = 'https://api.openheaders.io/v1/items?keep=1';

describe('proxy rule enforcement planner', () => {
  it('does not match a rule without URL conditions', () => {
    const rule = headerRule([], [{ operation: 'override', headerName: 'X-Test', value: 'v' }]);
    const plan = enforcerOf([rule]).planRequest({ url: URL, method: 'GET', headers: [] });
    expect(plan.appliedRuleUids).toHaveLength(0);
    expect(plan.requestHeaders).toHaveLength(0);
  });

  it('applies override / add / remove / merge request-header ops', () => {
    const rule = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [
        { operation: 'override', headerName: 'X-Token', value: 'minted' },
        { operation: 'add', headerName: 'Via', value: 'oh-proxy' },
        { operation: 'remove', headerName: 'X-Drop' },
        { operation: 'merge', headerName: 'Accept', value: 'text/html', mergeSeparator: ', ' },
      ],
    );
    const plan = enforcerOf([rule]).planRequest({
      url: URL,
      method: 'GET',
      headers: [
        { name: 'X-Token', value: 'stale' },
        { name: 'x-drop', value: 'gone' },
        { name: 'Accept', value: 'application/json' },
        { name: 'Via', value: '1.1 upstream' },
      ],
    });
    expect(plan.appliedRuleUids).toEqual([rule.uid]);
    const byName = (n: string) => plan.requestHeaders.filter((h) => h.name.toLowerCase() === n);
    expect(byName('x-token')).toEqual([{ name: 'X-Token', value: 'minted' }]);
    expect(byName('x-drop')).toHaveLength(0);
    expect(byName('accept')).toEqual([{ name: 'Accept', value: 'application/json, text/html' }]);
    expect(byName('via')).toHaveLength(2);
  });

  it('skips a capability-refused header name, keeping the rest of the rule', () => {
    const rule = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [
        { operation: 'override', headerName: 'Content-Length', value: '0' },
        { operation: 'override', headerName: 'X-Kept', value: 'yes' },
      ],
    );
    const plan = enforcerOf([rule]).planRequest({
      url: URL,
      method: 'GET',
      headers: [{ name: 'Content-Length', value: '42' }],
    });
    expect(plan.requestHeaders).toEqual([
      { name: 'Content-Length', value: '42' },
      { name: 'X-Kept', value: 'yes' },
    ]);
  });

  it('gates on request-methods conditions', () => {
    const conditions = [urlCondition('*://api.openheaders.io/*')];
    const rule = {
      ...headerRule(conditions, [{ operation: 'override', headerName: 'X-Test', value: 'v' }]),
    } as Rule;
    rule.conditions.push({ uid: uid(), type: 'request-methods', values: ['POST'] });
    const enforcer = enforcerOf([rule]);
    expect(enforcer.planRequest({ url: URL, method: 'GET', headers: [] }).appliedRuleUids).toHaveLength(0);
    expect(enforcer.planRequest({ url: URL, method: 'POST', headers: [] }).appliedRuleUids).toEqual([rule.uid]);
  });

  it('judges resource-type conditions against the wire plane’s `other` bucket', () => {
    const xhrOnly = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [{ operation: 'override', headerName: 'X-Test', value: 'v' }],
    );
    xhrOnly.conditions.push({ uid: uid(), type: 'resource-types', values: ['xhr'] });
    const otherToo = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [{ operation: 'override', headerName: 'X-Test', value: 'v' }],
    );
    otherToo.conditions.push({ uid: uid(), type: 'resource-types', values: ['other'] });
    expect(enforcerOf([xhrOnly]).planRequest({ url: URL, method: 'GET', headers: [] }).appliedRuleUids).toHaveLength(0);
    expect(enforcerOf([otherToo]).planRequest({ url: URL, method: 'GET', headers: [] }).appliedRuleUids).toEqual([
      otherToo.uid,
    ]);
  });

  it('block wins outright and suppresses every other action', () => {
    const block: Rule = {
      ...baseRule('block', [urlCondition('*://api.openheaders.io/*')]),
      type: 'block',
      action: {},
    } as Rule;
    const header = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [{ operation: 'override', headerName: 'X-Test', value: 'v' }],
    );
    const plan = enforcerOf([header, block]).planRequest({ url: URL, method: 'GET', headers: [] });
    expect(plan.blockedBy).toBe(block.uid);
    expect(plan.appliedRuleUids).toEqual([block.uid]);
    expect(plan.requestHeaders).toHaveLength(0);
  });

  it('redirect rewrites once and records the internal hop; query-param mutates on top', () => {
    const redirect: Rule = {
      ...baseRule('redirect', [urlCondition('*://api.openheaders.io/*')]),
      type: 'redirect',
      action: { redirectTo: 'https://staging.openheaders.io/v1/items?keep=1' },
    } as Rule;
    const qp: Rule = {
      ...baseRule('query-param', [urlCondition('*://api.openheaders.io/*')]),
      type: 'query-param',
      action: {
        params: [
          { uid: uid(), param: 'trace', operation: 'add', value: 'on' },
          { uid: uid(), param: 'keep', operation: 'remove' },
        ],
      },
    } as Rule;
    const plan = enforcerOf([redirect, qp]).planRequest({ url: URL, method: 'GET', headers: [] });
    expect(plan.url).toBe('https://staging.openheaders.io/v1/items?trace=on');
    expect(plan.rewrites).toHaveLength(2);
    expect(plan.rewrites[0]).toMatchObject({ ruleUid: redirect.uid, sourceUrl: URL });
    expect(plan.rewrites[1].ruleUid).toBe(qp.uid);
    expect(plan.appliedRuleUids).toEqual([redirect.uid, qp.uid]);
  });

  it('sums matched delay rules', () => {
    const mkDelay = (delayMs: number): Rule =>
      ({
        ...baseRule('delay', [urlCondition('*://api.openheaders.io/*')]),
        type: 'delay',
        action: { delayMs },
      }) as Rule;
    const plan = enforcerOf([mkDelay(30), mkDelay(20)]).planRequest({ url: URL, method: 'GET', headers: [] });
    expect(plan.delayMs).toBe(50);
  });

  it('applies response-side mods, honoring response-header gates at arrival', () => {
    const gated = headerRule(
      [urlCondition('*://api.openheaders.io/*')],
      [{ operation: 'override', headerName: 'X-Never', value: 'nope' }],
      [{ operation: 'override', headerName: 'Cache-Control', value: 'no-store' }],
    );
    gated.conditions.push({ uid: uid(), type: 'response-header', values: [], headerName: 'X-Flag' });
    const enforcer = enforcerOf([gated]);
    const plan = enforcer.planRequest({ url: URL, method: 'GET', headers: [] });
    // Request side untouched — the gate is unjudgeable before the wire.
    expect(plan.appliedRuleUids).toHaveLength(0);
    expect(plan.requestHeaders).toHaveLength(0);

    const denied = enforcer.applyResponseHeaders(plan, [{ name: 'Content-Type', value: 'text/plain' }]);
    expect(denied.appliedRuleUids).toHaveLength(0);

    const approved = enforcer.applyResponseHeaders(plan, [
      { name: 'Content-Type', value: 'text/plain' },
      { name: 'X-Flag', value: 'yes' },
      { name: 'Cache-Control', value: 'max-age=60' },
    ]);
    expect(approved.appliedRuleUids).toEqual([gated.uid]);
    expect(approved.headers.filter((h) => h.name.toLowerCase() === 'cache-control')).toEqual([
      { name: 'Cache-Control', value: 'no-store' },
    ]);
  });
});
