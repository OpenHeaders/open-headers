/**
 * Future-matches projection for the Request Rules panel —
 * `future-matches.ts`. Pins the SW-plane gates (published + enabled),
 * the fired-snapshot exclusion, URL/method condition evaluation, and
 * the no-URL-conditions = match-everything semantic.
 */

import type { DelayRule, Rule, RuleCondition } from '@openheaders/core/types';
import { VariableResolver } from '@openheaders/core/variables';
import { computeFutureMatches } from '@openheaders/ui/panel/data/future-matches';
import { describe, expect, it } from 'vitest';

const URL_MATCHED = 'https://api.openheaders.io/v1/users';

function delayRule(uid: string, overrides: Partial<DelayRule> = {}): DelayRule {
  return {
    schemaVersion: 5 as const,
    uid,
    path: `rules/API/${uid}`,
    name: `Delay ${uid}`,
    enabled: true,
    published: true,
    type: 'delay',
    conditions: [{ uid: `${uid}-c`, type: 'request-domains', values: ['api.openheaders.io'] }],
    action: { delayMs: 1000 },
    ...overrides,
  };
}

function compute(rules: Rule[], opts: { fired?: string[]; url?: string; method?: string } = {}) {
  return computeFutureMatches({
    rules,
    firedRuleUids: new Set(opts.fired ?? []),
    url: opts.url ?? URL_MATCHED,
    method: opts.method ?? 'GET',
    resolver: new VariableResolver(),
    localCollections: [],
  });
}

describe('computeFutureMatches', () => {
  it('projects a published, enabled rule whose conditions match the URL, with the admitting pattern', () => {
    const matches = compute([delayRule('R1')]);
    expect(matches.map((m) => m.rule.uid)).toEqual(['R1']);
    expect(matches[0]?.pattern).toBe('*://api.openheaders.io/*');
  });

  it('excludes rules already in the fire snapshot', () => {
    expect(compute([delayRule('R1')], { fired: ['R1'] })).toEqual([]);
  });

  it('excludes drafts and disabled rules — only the wire plane projects', () => {
    expect(compute([delayRule('R1', { published: false })])).toEqual([]);
    expect(compute([delayRule('R2', { enabled: false })])).toEqual([]);
  });

  it('excludes rules whose URL conditions miss', () => {
    expect(compute([delayRule('R1')], { url: 'https://example.org/' })).toEqual([]);
  });

  it('matches everything (with no pattern line) when the rule has no URL conditions', () => {
    const rule = delayRule('R1', { conditions: [] });
    const matches = compute([rule], { url: 'https://example.org/' });
    expect(matches.map((m) => m.rule.uid)).toEqual(['R1']);
    expect(matches[0]?.pattern).toBeNull();
  });

  it('honors request-method conditions in both directions', () => {
    const only = (type: RuleCondition['type'], values: string[]): RuleCondition[] => [
      { uid: 'c1', type: 'request-domains', values: ['api.openheaders.io'] },
      { uid: 'c2', type, values },
    ];
    expect(compute([delayRule('R1', { conditions: only('request-methods', ['post']) })], { method: 'GET' })).toEqual(
      [],
    );
    expect(
      compute([delayRule('R2', { conditions: only('request-methods', ['get']) })], { method: 'GET' }).map(
        (m) => m.rule.uid,
      ),
    ).toEqual(['R2']);
    expect(
      compute([delayRule('R3', { conditions: only('exclude-request-methods', ['get']) })], { method: 'GET' }),
    ).toEqual([]);
  });

  it('honors exclude-request-domains against the row host', () => {
    const rule = delayRule('R1', {
      conditions: [{ uid: 'c1', type: 'exclude-request-domains', values: ['openheaders.io'] }],
    });
    expect(compute([rule])).toEqual([]);
    expect(compute([rule], { url: 'https://example.org/' }).map((m) => m.rule.uid)).toEqual(['R1']);
  });

  it('drops rules whose condition templates cannot resolve into a matching pattern', () => {
    const rule = delayRule('R1', {
      conditions: [{ uid: 'c1', type: 'url-filter', values: ['https://{{workspace.MISSING_HOST}}/'] }],
    });
    expect(compute([rule])).toEqual([]);
  });
});
