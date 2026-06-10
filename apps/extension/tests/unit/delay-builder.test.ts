import type { DelayRule } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import type { CompilerContext } from '@openheaders/rule-engine/builders';
import { CHROMIUM_RESOURCE_VOCABULARY, delayCompiler } from '@openheaders/rule-engine/builders';

function makeDelayRule(overrides: Partial<DelayRule> = {}): DelayRule {
  return {
    schemaVersion: 5,
    uid: 'd1',
    path: 'rules/delay',
    name: 'Slow openheaders.io',
    type: 'delay',
    enabled: true,
    conditions: [{ uid: 'tcd00001', type: 'request-domains', values: ['openheaders.io'] }],
    action: { delayMs: 3000 },
    ...overrides,
  };
}

function makeCtx(start = 1, liveRulesMode = true): CompilerContext {
  let id = start;
  return { allocateId: () => id++, settings: { liveRulesMode, resourceVocabulary: CHROMIUM_RESOURCE_VOCABULARY } };
}

describe('delayCompiler', () => {
  it('emits a single session redirect rule for a request-domains condition', () => {
    const plan = delayCompiler.compile(makeDelayRule(), makeCtx());
    expect(plan.dynamicRules ?? []).toEqual([]);
    expect(plan.sessionRules).toHaveLength(1);
    const rule = plan.sessionRules![0]!;
    expect(rule.id).toBe(1);
    expect(rule.priority).toBe(2);
    expect(rule.action.type).toBe('redirect');
    expect(rule.action.redirect?.regexSubstitution).toContain('delay.html');
    expect(rule.action.redirect?.regexSubstitution).toContain('ms=3000');
    expect(rule.action.redirect?.regexSubstitution).toContain('#\\0');
    expect(rule.condition.requestDomains).toEqual(['openheaders.io']);
    expect(rule.condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
    expect(rule.condition.regexFilter).toBe('^.*$');
  });

  it('wraps a url-regex condition with a full-URL capture', () => {
    const plan = delayCompiler.compile(
      makeDelayRule({
        conditions: [{ uid: 'tcd00002', type: 'url-regex', values: ['openheaders\\.io/api'] }],
      }),
      makeCtx(5),
    );
    expect(plan.sessionRules).toHaveLength(1);
    expect(plan.sessionRules![0]!.condition.regexFilter).toBe('^.*(?:openheaders\\.io/api).*$');
    expect(plan.sessionRules![0]!.condition.requestDomains).toBeUndefined();
  });

  it('converts a url-filter literal into an escaped regex', () => {
    const plan = delayCompiler.compile(
      makeDelayRule({
        conditions: [{ uid: 'tcd00003', type: 'url-filter', values: ['openheaders.io/a.b'] }],
      }),
      makeCtx(),
    );
    expect(plan.sessionRules![0]!.condition.regexFilter).toBe('^.*(?:openheaders\\.io/a\\.b).*$');
  });

  it('maps `*` wildcards and `|` anchors inside url-filter patterns', () => {
    const plan = delayCompiler.compile(
      makeDelayRule({
        conditions: [{ uid: 'tcd00004', type: 'url-filter', values: ['|https://*.openheaders.io/|'] }],
      }),
      makeCtx(),
    );
    expect(plan.sessionRules![0]!.condition.regexFilter).toBe('^.*(?:^https://.*\\.openheaders\\.io/$).*$');
  });

  it('clamps delays above the hard cap to 30 seconds', () => {
    const plan = delayCompiler.compile(makeDelayRule({ action: { delayMs: 999_999 } }), makeCtx());
    expect(plan.sessionRules![0]!.action.redirect?.regexSubstitution).toContain('ms=30000');
  });

  it('skips rules with no URL condition', () => {
    const plan = delayCompiler.compile(makeDelayRule({ conditions: [] }), makeCtx());
    expect(plan.dynamicRules ?? []).toEqual([]);
    expect(plan.sessionRules ?? []).toEqual([]);
  });

  it('skips rules with zero delay', () => {
    const plan = delayCompiler.compile(makeDelayRule({ action: { delayMs: 0 } }), makeCtx());
    expect(plan.dynamicRules ?? []).toEqual([]);
    expect(plan.sessionRules ?? []).toEqual([]);
  });

  describe('resource-type reconciliation', () => {
    it('subtracts excluded resource types instead of colliding with Chrome', () => {
      // Regression: user adds `Excl. Resources: page` (main_frame) to a
      // delay rule. Chrome rejected the rule with "includes and excludes
      // the same resource" because the compiler force-set both
      // resourceTypes: ['main_frame', 'sub_frame'] AND kept the user's
      // excludedResourceTypes: ['main_frame']. Fix: subtract excluded
      // from forced, drop excludedResourceTypes from the emitted condition.
      const plan = delayCompiler.compile(
        makeDelayRule({
          conditions: [
            { uid: 'tcd00005', type: 'url-filter', values: ['*://github.com/*'] },
            { uid: 'tcd00006', type: 'exclude-resource-types', values: ['page'] },
          ],
        }),
        makeCtx(),
      );
      expect(plan.sessionRules).toHaveLength(1);
      const rule = plan.sessionRules![0]!;
      expect(rule.condition.resourceTypes).toEqual(['sub_frame']);
      expect(rule.condition.excludedResourceTypes).toBeUndefined();
    });

    it('intersects user-specified resource types with the supported set', () => {
      // User asked for only main_frame — we still emit, but only for that.
      const plan = delayCompiler.compile(
        makeDelayRule({
          conditions: [
            { uid: 'tcd00007', type: 'url-filter', values: ['*://github.com/*'] },
            { uid: 'tcd00008', type: 'resource-types', values: ['page'] },
          ],
        }),
        makeCtx(),
      );
      expect(plan.sessionRules).toHaveLength(1);
      expect(plan.sessionRules![0]!.condition.resourceTypes).toEqual(['main_frame']);
    });

    it('skips the rule when user-specified resource types leave no supported types', () => {
      // User asked only for xmlhttprequest — not delayable via DNR, so
      // the compiler emits no session rule. (The scriptable path in
      // inject-manager still runs for xhr/fetch.)
      const plan = delayCompiler.compile(
        makeDelayRule({
          conditions: [
            { uid: 'tcd00009', type: 'url-filter', values: ['*://github.com/*'] },
            { uid: 'tcd00010', type: 'resource-types', values: ['xhr'] },
          ],
        }),
        makeCtx(),
      );
      expect(plan.sessionRules ?? []).toEqual([]);
    });

    it('skips the rule when excluded types cover everything supported', () => {
      const plan = delayCompiler.compile(
        makeDelayRule({
          conditions: [
            { uid: 'tcd00011', type: 'url-filter', values: ['*://github.com/*'] },
            { uid: 'tcd00012', type: 'exclude-resource-types', values: ['page', 'sub_frame'] },
          ],
        }),
        makeCtx(),
      );
      expect(plan.sessionRules ?? []).toEqual([]);
    });
  });
});
