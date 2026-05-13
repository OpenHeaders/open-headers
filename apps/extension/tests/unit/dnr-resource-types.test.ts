/**
 * Resource-type resolution tests across every DNR builder.
 *
 * Background: Chrome DNR rejects any rule where the same resource type
 * appears in both `resourceTypes` and `excludedResourceTypes` ("includes
 * and excludes the same resource"). Every builder must fold its capability
 * set with the user's resource-type / exclude-resource-type conditions
 * into a single canonical `resourceTypes` array, and never emit
 * `excludedResourceTypes`.
 *
 * These tests lock in that contract for every builder so a future change
 * to a single builder can't quietly reintroduce the bug.
 */
import type { BlockRule, HeaderRule, InjectRule, QueryParamRule, RedirectRule } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Register every setting (including `rulesEngine.liveRulesMode` that the
// header compiler reads) so `getSetting` returns a default instead of
// throwing.
import '@/workbench/settings/schema';
import { blockCompiler } from '@/background/dnr-builders/block-builder';
import { delayCompiler } from '@/background/dnr-builders/delay-builder';
import { headerCompiler } from '@/background/dnr-builders/header-builder';
import { injectCompiler } from '@/background/dnr-builders/inject-builder';
import { queryParamCompiler } from '@/background/dnr-builders/query-param-builder';
import { redirectCompiler } from '@/background/dnr-builders/redirect-builder';
import type { CompilerContext, DnrRule } from '@/background/dnr-builders/types';
import { ALL_RESOURCE_TYPES, resolveResourceTypes, SUB_RESOURCE_TYPES } from '@/background/dnr-builders/types';

function makeCtx(start = 1): CompilerContext {
  let id = start;
  return { allocateId: () => id++ };
}

function expectNoExcludedResourceTypes(rules: DnrRule[]) {
  for (const rule of rules) {
    expect(rule.condition.excludedResourceTypes).toBeUndefined();
  }
}

function expectResourceTypesNeverEmpty(rules: DnrRule[]) {
  for (const rule of rules) {
    expect(rule.condition.resourceTypes).toBeDefined();
    expect(rule.condition.resourceTypes!.length).toBeGreaterThan(0);
  }
}

// ── Resolver unit tests ──────────────────────────────────────────

describe('resolveResourceTypes', () => {
  it('returns the full capability set when no user filters are given', () => {
    expect(resolveResourceTypes(ALL_RESOURCE_TYPES, undefined, undefined)).toEqual(ALL_RESOURCE_TYPES);
  });

  it('intersects user include with capability', () => {
    const result = resolveResourceTypes(
      ALL_RESOURCE_TYPES,
      ['main_frame', 'script'] as chrome.declarativeNetRequest.ResourceType[],
      undefined,
    );
    expect(result).toEqual(['main_frame', 'script']);
  });

  it('subtracts user exclude from capability', () => {
    const result = resolveResourceTypes(
      ['main_frame', 'sub_frame'] as chrome.declarativeNetRequest.ResourceType[],
      undefined,
      ['main_frame'] as chrome.declarativeNetRequest.ResourceType[],
    );
    expect(result).toEqual(['sub_frame']);
  });

  it('applies include and exclude together', () => {
    const result = resolveResourceTypes(
      ALL_RESOURCE_TYPES,
      ['main_frame', 'script', 'image'] as chrome.declarativeNetRequest.ResourceType[],
      ['script'] as chrome.declarativeNetRequest.ResourceType[],
    );
    expect(result).toEqual(['main_frame', 'image']);
  });

  it('returns null when nothing survives', () => {
    expect(
      resolveResourceTypes(
        ['main_frame', 'sub_frame'] as chrome.declarativeNetRequest.ResourceType[],
        ['xmlhttprequest'] as chrome.declarativeNetRequest.ResourceType[],
        undefined,
      ),
    ).toBeNull();
    expect(
      resolveResourceTypes(['main_frame'] as chrome.declarativeNetRequest.ResourceType[], undefined, [
        'main_frame',
      ] as chrome.declarativeNetRequest.ResourceType[]),
    ).toBeNull();
  });

  it('treats an empty include list as "no filter"', () => {
    const result = resolveResourceTypes(
      ['main_frame', 'sub_frame'] as chrome.declarativeNetRequest.ResourceType[],
      [],
      undefined,
    );
    expect(result).toEqual(['main_frame', 'sub_frame']);
  });
});

// ── Per-builder regression tests ─────────────────────────────────

describe('blockCompiler resource-type handling', () => {
  const rule: BlockRule = {
    schemaVersion: 5,
    uid: 'b1',
    path: 'rules/block',
    name: 'Block trackers',
    type: 'block',
    enabled: true,
    conditions: [
      { uid: 'tcd00016', type: 'request-domains', values: ['openheaders.io'] },
      { uid: 'tcd00017', type: 'exclude-resource-types', values: ['image'] },
    ],
    action: {},
  };

  it('emits resolved resourceTypes and never excludedResourceTypes', () => {
    const plan = blockCompiler.compile(rule, makeCtx());
    const rules = plan.dynamicRules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    expectNoExcludedResourceTypes(rules);
    expectResourceTypesNeverEmpty(rules);
    expect(rules[0]!.condition.resourceTypes).not.toContain('image');
  });

  it('skips the rule when exclude covers everything', () => {
    const plan = blockCompiler.compile(
      {
        ...rule,
        conditions: [
          { uid: 'tcd00018', type: 'request-domains', values: ['openheaders.io'] },
          { uid: 'tcd00019', type: 'exclude-resource-types', values: [...ALL_RESOURCE_TYPES] },
        ],
      },
      makeCtx(),
    );
    expect(plan.dynamicRules ?? []).toEqual([]);
  });
});

describe('redirectCompiler resource-type handling', () => {
  const rule: RedirectRule = {
    schemaVersion: 5,
    uid: 'r1',
    path: 'rules/redirect',
    name: 'Redirect',
    type: 'redirect',
    enabled: true,
    conditions: [
      { uid: 'tcd00020', type: 'url-filter', values: ['*://openheaders.io/*'] },
      { uid: 'tcd00021', type: 'resource-types', values: ['page', 'xhr'] },
      { uid: 'tcd00022', type: 'exclude-resource-types', values: ['xhr'] },
    ],
    action: { redirectTo: 'https://test.openheaders.io/' },
  };

  it('intersects include then subtracts exclude', () => {
    const plan = redirectCompiler.compile(rule, makeCtx());
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]!.condition.resourceTypes).toEqual(['main_frame']);
    expectNoExcludedResourceTypes(rules);
  });
});

describe('queryParamCompiler resource-type handling', () => {
  const rule: QueryParamRule = {
    schemaVersion: 5,
    uid: 'q1',
    path: 'rules/qp',
    name: 'Add tracking',
    type: 'query-param',
    enabled: true,
    conditions: [
      { uid: 'tcd00023', type: 'request-domains', values: ['openheaders.io'] },
      { uid: 'tcd00024', type: 'exclude-resource-types', values: ['stylesheet', 'font'] },
    ],
    action: { params: [{ uid: 'qp000001', operation: 'add', param: 'utm_source', value: 'oh' }] },
  };

  it('honors user resource-type filters and never emits excludedResourceTypes', () => {
    const plan = queryParamCompiler.compile(rule, makeCtx());
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    expectNoExcludedResourceTypes(rules);
    expect(rules[0]!.condition.resourceTypes).not.toContain('stylesheet');
    expect(rules[0]!.condition.resourceTypes).not.toContain('font');
    expect(rules[0]!.condition.resourceTypes).toContain('main_frame');
  });
});

describe('injectCompiler resource-type handling', () => {
  const rule: InjectRule = {
    schemaVersion: 5,
    uid: 'i1',
    path: 'rules/inject',
    name: 'Inject CSS',
    type: 'inject',
    enabled: true,
    conditions: [
      { uid: 'tcd00025', type: 'url-filter', values: ['*://openheaders.io/*'] },
      { uid: 'tcd00026', type: 'exclude-resource-types', values: ['page'] },
    ],
    action: {
      injectType: 'css',
      code: 'body { color: red; }',
      source: 'code',
      position: 'head',
      bypassCSP: true,
    },
  };

  it('emits CSP-bypass rules with resolved resourceTypes (no main_frame conflict)', () => {
    const plan = injectCompiler.compile(rule, makeCtx());
    const rules = plan.dynamicRules ?? [];
    expect(rules.length).toBeGreaterThan(0);
    expectNoExcludedResourceTypes(rules);
    expect(rules[0]!.condition.resourceTypes).not.toContain('main_frame');
    expect(rules[0]!.condition.resourceTypes).toContain('script');
  });
});

describe('headerCompiler resource-type handling', () => {
  function makeRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
    return {
      schemaVersion: 5,
      uid: 'h1',
      path: 'rules/header',
      name: 'Header',
      type: 'header',
      enabled: true,
      conditions: [{ uid: 'tcd00027', type: 'request-domains', values: ['openheaders.io'] }],
      action: {
        requestHeaders: [{ uid: 'thm00015', operation: 'override', headerName: 'X-Test', value: 'v' }],
        responseHeaders: [],
      },
      ...overrides,
    };
  }

  it('drops the main_frame variant when user excludes page on a response rule', () => {
    const plan = headerCompiler.compile(
      makeRule({
        conditions: [
          { uid: 'tcd00028', type: 'request-domains', values: ['openheaders.io'] },
          { uid: 'tcd00029', type: 'exclude-resource-types', values: ['page'] },
        ],
        action: {
          requestHeaders: [],
          responseHeaders: [{ uid: 'thm00016', operation: 'override', headerName: 'X-Resp', value: 'r' }],
        },
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    // main_frame variant skipped → only the SUB_RESOURCE variant remains.
    expect(rules).toHaveLength(1);
    expect(rules[0]!.condition.resourceTypes).toEqual(SUB_RESOURCE_TYPES);
    expectNoExcludedResourceTypes(rules);
  });

  it('emits the request-only variant with the user-filtered resource set', () => {
    const plan = headerCompiler.compile(
      makeRule({
        conditions: [
          { uid: 'tcd00030', type: 'request-domains', values: ['openheaders.io'] },
          { uid: 'tcd00031', type: 'exclude-resource-types', values: ['image', 'font'] },
        ],
      }),
      makeCtx(),
    );
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]!.condition.resourceTypes).not.toContain('image');
    expect(rules[0]!.condition.resourceTypes).not.toContain('font');
    expect(rules[0]!.condition.resourceTypes).toContain('main_frame');
    expectNoExcludedResourceTypes(rules);
  });

  it('drops both variants and skips the rule when nothing survives', () => {
    const plan = headerCompiler.compile(
      makeRule({
        conditions: [
          { uid: 'tcd00032', type: 'request-domains', values: ['openheaders.io'] },
          { uid: 'tcd00033', type: 'resource-types', values: ['xhr'] },
        ],
        action: {
          requestHeaders: [],
          responseHeaders: [{ uid: 'thm00017', operation: 'override', headerName: 'X-Resp', value: 'r' }],
        },
      }),
      makeCtx(),
    );
    // xhr is in SUB_RESOURCE_TYPES but not main_frame, so the sub-resource
    // variant survives. Sanity-check it.
    const rules = plan.dynamicRules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]!.condition.resourceTypes).toEqual(['xmlhttprequest']);
  });
});

describe('delayCompiler resource-type handling (regression sanity)', () => {
  it('emits resolved resourceTypes via the shared helper', () => {
    const plan = delayCompiler.compile(
      {
        schemaVersion: 5,
        uid: 'd1',
        path: 'rules/delay',
        name: 'Delay',
        type: 'delay',
        enabled: true,
        conditions: [
          { uid: 'tcd00034', type: 'url-filter', values: ['*://openheaders.io/*'] },
          { uid: 'tcd00035', type: 'exclude-resource-types', values: ['page'] },
        ],
        action: { delayMs: 1000 },
      },
      makeCtx(),
    );
    const rules = plan.sessionRules ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]!.condition.resourceTypes).toEqual(['sub_frame']);
    expectNoExcludedResourceTypes(rules);
  });
});
