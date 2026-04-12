import { describe, expect, it } from 'vitest';
import type { MatchingRule } from '@/background/modules/request-tracker';
import { arbitrate } from '@/background/modules/shadow-arbitration';

function rule(overrides: Partial<MatchingRule> & Pick<MatchingRule, 'uid' | 'type'>): MatchingRule {
  return {
    name: overrides.uid,
    pattern: '*://*.openheaders.io/*',
    deferred: false,
    ...overrides,
  };
}

describe('shadow-arbitration', () => {
  it('leaves rules unchanged when no block is present', () => {
    const matching = [rule({ uid: 'r1', type: 'header' }), rule({ uid: 'r2', type: 'redirect' })];
    const result = arbitrate(matching);

    expect(result).toHaveLength(2);
    expect(result[0]!.shadowedBy).toBeUndefined();
    expect(result[1]!.shadowedBy).toBeUndefined();
    // Every rule gets priority + actionClass decorations even without shadowing.
    expect(result[0]!.priority).toBe(100);
    expect(result[0]!.actionClass).toBe('header');
    expect(result[1]!.priority).toBe(150);
    expect(result[1]!.actionClass).toBe('redirect');
  });

  it('block shadows redirect, query-param, header, delay, mock, body at or below its priority', () => {
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

    // block itself is not shadowed
    expect(result.find((r) => r.uid === 'block-1')!.shadowedBy).toBeUndefined();
    // every other rule is shadowed by the block
    for (const uid of ['redirect-1', 'query-1', 'header-1', 'delay-1', 'mock-1', 'body-1']) {
      const record = result.find((r) => r.uid === uid)!;
      expect(record.shadowedBy).toEqual({ uid: 'block-1', name: 'Block ads' });
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

  it('higher-priority non-block rules escape block shadowing', () => {
    // inject priority 2000 > block priority 200 → not shadowed
    const matching = [
      rule({ uid: 'inject-1', type: 'inject' }),
      rule({ uid: 'block-1', name: 'Block', type: 'block' }),
    ];
    const result = arbitrate(matching);
    expect(result.find((r) => r.uid === 'inject-1')!.shadowedBy).toBeUndefined();
    expect(result.find((r) => r.uid === 'block-1')!.shadowedBy).toBeUndefined();
  });

  it('two blocks do not shadow each other', () => {
    const matching = [
      rule({ uid: 'block-1', name: 'Block ads', type: 'block' }),
      rule({ uid: 'block-2', name: 'Block trackers', type: 'block' }),
    ];
    const result = arbitrate(matching);
    for (const r of result) expect(r.shadowedBy).toBeUndefined();
  });

  it('picks the highest-priority block as the shadower when multiple exist (ties break by insertion order)', () => {
    // Both blocks share priority 200; the first one encountered is the
    // "winner" used in shadowedBy attribution.
    const matching = [
      rule({ uid: 'block-a', name: 'Block A', type: 'block' }),
      rule({ uid: 'block-b', name: 'Block B', type: 'block' }),
      rule({ uid: 'header-1', type: 'header' }),
    ];
    const result = arbitrate(matching);
    expect(result.find((r) => r.uid === 'header-1')!.shadowedBy).toEqual({ uid: 'block-a', name: 'Block A' });
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

  it('decorates every rule with priority + actionClass even when not shadowed', () => {
    const matching = [rule({ uid: 'r1', type: 'mock' })];
    const result = arbitrate(matching);
    expect(result[0]!.priority).toBe(100);
    expect(result[0]!.actionClass).toBe('scriptable');
  });
});
