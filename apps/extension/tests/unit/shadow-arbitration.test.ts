import { describe, expect, it } from 'vitest';
import type { MatchingRule, MatchingRuleHeaderOp } from '@/background/modules/request-tracker';
import { arbitrate } from '@/background/modules/shadow-arbitration';

function rule(overrides: Partial<MatchingRule> & Pick<MatchingRule, 'uid' | 'type'>): MatchingRule {
  return {
    name: overrides.uid,
    pattern: '*://*.openheaders.io/*',
    deferred: false,
    ...overrides,
  };
}

function headerRule(uid: string, ops: MatchingRuleHeaderOp[], name = uid): MatchingRule {
  return {
    uid,
    name,
    type: 'header',
    pattern: '*://*.openheaders.io/*',
    deferred: false,
    headerOps: ops,
  };
}

describe('shadow-arbitration', () => {
  // ── Baseline: decoration-only ──────────────────────────────────

  it('leaves rules unchanged when no shadower is present', () => {
    const matching = [rule({ uid: 'r1', type: 'header' }), rule({ uid: 'r2', type: 'inject' })];
    const result = arbitrate(matching);

    expect(result).toHaveLength(2);
    expect(result[0]!.shadowedBy).toBeUndefined();
    expect(result[1]!.shadowedBy).toBeUndefined();
    // Every rule gets priority + actionClass decorations even without shadowing.
    expect(result[0]!.priority).toBe(100);
    expect(result[0]!.actionClass).toBe('header');
    expect(result[1]!.priority).toBe(2000);
    expect(result[1]!.actionClass).toBe('inject-csp');
  });

  it('preserves input order in the output', () => {
    const matching = [
      rule({ uid: 'header-1', type: 'header' }),
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
      rule({ uid: 'redirect-1', type: 'redirect' }),
    ];
    const result = arbitrate(matching);
    expect(result.map((r) => r.uid)).toEqual(['header-1', 'block-1', 'redirect-1']);
  });

  // ── block-terminal ────────────────────────────────────────────

  it('block shadows redirect, query-param, header, delay, mock, body at ≤ block priority', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block ads', type: 'block' }),
      rule({ uid: 'redirect-1', type: 'redirect' }),
      rule({ uid: 'query-1', type: 'query-param' }),
      rule({ uid: 'header-1', type: 'header' }),
      rule({ uid: 'delay-1', type: 'delay' }),
      rule({ uid: 'mock-1', type: 'mock' }),
      rule({ uid: 'body-1', type: 'body' }),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'block-1')!.shadowedBy).toBeUndefined();
    for (const uid of ['redirect-1', 'query-1', 'header-1', 'delay-1', 'mock-1', 'body-1']) {
      const record = result.find((r) => r.uid === uid)!;
      expect(record.shadowedBy).toEqual({ uid: 'block-1', name: 'Block ads', kind: 'block-terminal' });
    }
  });

  it('inject (CSP strip) escapes block shadowing — it runs on the response, not the request', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
      rule({ uid: 'inject-1', type: 'inject' }),
    ];
    const result = arbitrate(matching);
    expect(result.find((r) => r.uid === 'inject-1')!.shadowedBy).toBeUndefined();
  });

  it('two blocks do not shadow each other', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block ads', type: 'block' }),
      rule({ uid: 'block-2', name: 'Block trackers', type: 'block' }),
    ];
    const result = arbitrate(matching);
    for (const r of result) expect(r.shadowedBy).toBeUndefined();
  });

  // ── redirect-retarget ─────────────────────────────────────────

  it('redirect retargets lower-priority modify rules (header, body, mock, delay)', () => {
    const matching = [
      rule({ uid: 'redirect-1', name: 'Rewrite /v1 to /v2', type: 'redirect' }),
      rule({ uid: 'header-1', type: 'header' }),
      rule({ uid: 'body-1', type: 'body' }),
      rule({ uid: 'mock-1', type: 'mock' }),
      rule({ uid: 'delay-1', type: 'delay' }),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'redirect-1')!.shadowedBy).toBeUndefined();
    for (const uid of ['header-1', 'body-1', 'mock-1', 'delay-1']) {
      const record = result.find((r) => r.uid === uid)!;
      expect(record.shadowedBy).toEqual({
        uid: 'redirect-1',
        name: 'Rewrite /v1 to /v2',
        kind: 'redirect-retarget',
      });
    }
  });

  it('query-param retargets lower-priority modify rules with query-param-retarget kind', () => {
    const matching = [
      rule({ uid: 'qp-1', name: 'Strip debug', type: 'query-param' }),
      rule({ uid: 'header-1', type: 'header' }),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'header-1')!.shadowedBy).toEqual({
      uid: 'qp-1',
      name: 'Strip debug',
      kind: 'query-param-retarget',
    });
  });

  it('redirect does not shadow another redirect or a query-param rule', () => {
    const matching = [
      rule({ uid: 'redirect-1', type: 'redirect' }),
      rule({ uid: 'redirect-2', type: 'redirect' }),
      rule({ uid: 'qp-1', type: 'query-param' }),
    ];
    const result = arbitrate(matching);
    for (const r of result) expect(r.shadowedBy).toBeUndefined();
  });

  it('redirect does not shadow inject (response-side) or block (terminal)', () => {
    const matching = [rule({ uid: 'redirect-1', type: 'redirect' }), rule({ uid: 'inject-1', type: 'inject' })];
    const result = arbitrate(matching);
    expect(result.find((r) => r.uid === 'inject-1')!.shadowedBy).toBeUndefined();
  });

  it('block wins precedence over redirect when both could shadow the same rule', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
      rule({ uid: 'redirect-1', name: 'Rewrite', type: 'redirect' }),
      rule({ uid: 'header-1', type: 'header' }),
    ];
    const result = arbitrate(matching);

    // block's priority (200) > redirect's (150) so block shadows redirect AND header.
    expect(result.find((r) => r.uid === 'redirect-1')!.shadowedBy).toEqual({
      uid: 'block-1',
      name: 'Block',
      kind: 'block-terminal',
    });
    expect(result.find((r) => r.uid === 'header-1')!.shadowedBy).toEqual({
      uid: 'block-1',
      name: 'Block',
      kind: 'block-terminal',
    });
  });

  // ── mock-intercept ────────────────────────────────────────────

  it('mock intercepts body rules and response-side header rules', () => {
    const matching = [
      rule({ uid: 'mock-1', name: 'Mock api', type: 'mock' }),
      rule({ uid: 'body-1', type: 'body' }),
      headerRule('header-res', [{ side: 'response', operation: 'set', name: 'x-test' }]),
      headerRule('header-req', [{ side: 'request', operation: 'set', name: 'authorization' }]),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'body-1')!.shadowedBy).toEqual({
      uid: 'mock-1',
      name: 'Mock api',
      kind: 'mock-intercept',
    });
    expect(result.find((r) => r.uid === 'header-res')!.shadowedBy).toEqual({
      uid: 'mock-1',
      name: 'Mock api',
      kind: 'mock-intercept',
    });
    // Request-side header mods are still effective — the outgoing request is real.
    expect(result.find((r) => r.uid === 'header-req')!.shadowedBy).toBeUndefined();
  });

  // ── header-stacking-ambiguous ─────────────────────────────────

  it('flags two header rules touching the same header + same side as ambiguous', () => {
    const matching = [
      headerRule('h1', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
      headerRule('h2', [{ side: 'request', operation: 'append', name: 'x-custom' }]),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'h1')!.shadowedBy?.kind).toBe('header-stacking-ambiguous');
    expect(result.find((r) => r.uid === 'h2')!.shadowedBy?.kind).toBe('header-stacking-ambiguous');
  });

  it('does not flag header stacking when rules touch different header names', () => {
    const matching = [
      headerRule('h1', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
      headerRule('h2', [{ side: 'request', operation: 'set', name: 'authorization' }]),
    ];
    const result = arbitrate(matching);
    for (const r of result) expect(r.shadowedBy).toBeUndefined();
  });

  it('does not flag header stacking when rules touch different sides', () => {
    const matching = [
      headerRule('h1', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
      headerRule('h2', [{ side: 'response', operation: 'set', name: 'x-custom' }]),
    ];
    const result = arbitrate(matching);
    for (const r of result) expect(r.shadowedBy).toBeUndefined();
  });

  it('does not re-flag a header rule already shadowed by block', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
      headerRule('h1', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
      headerRule('h2', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
    ];
    const result = arbitrate(matching);

    // Both header rules already shadowed by block; header-stacking phase
    // has nothing active to flag.
    expect(result.find((r) => r.uid === 'h1')!.shadowedBy?.kind).toBe('block-terminal');
    expect(result.find((r) => r.uid === 'h2')!.shadowedBy?.kind).toBe('block-terminal');
  });

  // ── delay-page-intercept ──────────────────────────────────────

  it('delay shadows inject rules in the same matching set', () => {
    const matching = [
      rule({ uid: 'delay-1', name: 'Slow api', type: 'delay' }),
      rule({ uid: 'inject-1', type: 'inject' }),
    ];
    const result = arbitrate(matching);

    expect(result.find((r) => r.uid === 'inject-1')!.shadowedBy).toEqual({
      uid: 'delay-1',
      name: 'Slow api',
      kind: 'delay-page-intercept',
    });
  });

  it('delay-page phase does not touch non-inject rules (they have other phases)', () => {
    const matching = [rule({ uid: 'delay-1', type: 'delay' }), rule({ uid: 'header-1', type: 'header' })];
    const result = arbitrate(matching);
    // header rule is not shadowed by delay — delay priority is 2, below header's 100.
    expect(result.find((r) => r.uid === 'header-1')!.shadowedBy).toBeUndefined();
  });

  // ── precedence ────────────────────────────────────────────────

  it('block takes precedence over redirect, mock, delay, header-stacking in one big set', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
      rule({ uid: 'redirect-1', name: 'Rewrite', type: 'redirect' }),
      rule({ uid: 'mock-1', type: 'mock' }),
      rule({ uid: 'delay-1', type: 'delay' }),
      rule({ uid: 'inject-1', type: 'inject' }),
      headerRule('h1', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
      headerRule('h2', [{ side: 'request', operation: 'set', name: 'x-custom' }]),
    ];
    const result = arbitrate(matching);

    // Everything block-shadowable → block-terminal.
    for (const uid of ['redirect-1', 'mock-1', 'delay-1', 'h1', 'h2']) {
      expect(result.find((r) => r.uid === uid)!.shadowedBy?.kind).toBe('block-terminal');
    }
    // inject escapes block but gets delay-page-intercepted.
    expect(result.find((r) => r.uid === 'inject-1')!.shadowedBy?.kind).toBe('delay-page-intercept');
  });
});
