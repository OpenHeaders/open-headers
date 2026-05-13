import type { HeaderRule, Rule, RuleCondition } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock rule-store before importing request-tracker
const mockGetRules = vi.fn<() => Rule[]>(() => []);
vi.mock('@/background/modules/rule-store', () => ({
  getRules: (...args: unknown[]) => mockGetRules(...(args as [])),
}));

vi.mock('@utils/browser-api', () => ({
  storage: { onChanged: { addListener: vi.fn() } },
  tabs: { query: vi.fn() },
}));

const mockSendMessage = vi.fn();
vi.mock('@utils/bridge', () => ({
  broadcast: (type: string, payload: Record<string, unknown>) => mockSendMessage({ type, ...payload }),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  addTrackedUrl,
  checkIfUrlMatchesAnyRule,
  getActiveRulesForTab,
  ingestPerfEntries,
  matchRulesToRequest,
  precompileRulePatterns,
  tabsWithActiveRules,
} from '@/background/modules/request-tracker';

// ── Helpers ──────────────────────────────────────────────────────────

function hostConditions(domains: string[]): RuleCondition[] {
  return domains.length > 0 ? [{ uid: 'tcd00041', type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: `rule-${Math.random().toString(36).slice(2, 6)}`,
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      requestHeaders: [{ uid: 'thm00073', operation: 'override', headerName: 'X-Debug', value: 'test-value' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function seedRules(rules: Rule[]): void {
  mockGetRules.mockReturnValue(rules);
  precompileRulePatterns();
}

// ── Tests ────────────────────────────────────────────────────────────

describe('getActiveRulesForTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
    mockGetRules.mockReturnValue([]);
  });

  it('returns empty array for non-trackable URLs', () => {
    const { activeRules: result } = getActiveRulesForTab(1, 'chrome://extensions');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty URL', () => {
    const { activeRules: result } = getActiveRulesForTab(1, '');
    expect(result).toEqual([]);
  });

  it('returns rules whose URL conditions match the tab URL', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ uid: 'thm00074', operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/v2');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Test Rule');
    expect(result[0]!.ruleType).toBe('header');
    expect(result[0]!.isEnabled).toBe(true);
    expect(result[0]!.id).toBe('rule-1');
  });

  it('returns disabled matching rules (popup still shows them for toggling)', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
        enabled: true,
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ uid: 'thm00075', operation: 'override', headerName: 'X-Disabled', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
        enabled: false,
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/v2');
    expect(result).toHaveLength(2);
    const enabled = result.find((r) => r.id === 'rule-1');
    const disabled = result.find((r) => r.id === 'rule-2');
    expect(enabled?.isEnabled).toBe(true);
    expect(disabled?.isEnabled).toBe(false);
  });

  it('does not return rules that do not match the domain', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ uid: 'thm00076', operation: 'override', headerName: 'X-Other', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.example.com']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/v2');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Test Rule');
  });

  it('returns rules with wildcard domain for any tab URL', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ uid: 'thm00077', operation: 'override', headerName: 'X-Global', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://any-site.com/page');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('rule-1');
  });

  it('skips incomplete (draft) rules', () => {
    seedRules([
      makeHeaderRule({
        uid: 'draft-rule',
        action: { requestHeaders: [{ uid: 'thm00078', operation: 'override', headerName: '', value: 'test' }], responseHeaders: [] },
        conditions: hostConditions([]),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://openheaders.io');
    expect(result).toHaveLength(0);
  });

  it('preserves rule uid in results', () => {
    seedRules([
      makeHeaderRule({
        uid: 'my-rule-id',
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/test');
    expect(result[0]!.id).toBe('my-rule-id');
    expect(result[0]!.key).toBe('my-rule-id');
  });

  it('includes action details in results', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [],
          responseHeaders: [{ uid: 'thm00079', operation: 'override', headerName: 'X-Tagged', value: 'true' }],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/test');
    expect(result[0]!.ruleType).toBe('header');
    expect(result[0]!.summary).toContain('X-Tagged');
  });

  it('returns rule as applicable when any previously-tracked resource URL matches', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.cdn.openheaders.io']),
      }),
    ]);
    addTrackedUrl(1, 'https://assets.cdn.openheaders.io/bundle.js');

    // Tab URL doesn't match the rule — but a tracked sub-resource does, so
    // the rule is still applicable to this page.
    const { activeRules: result } = getActiveRulesForTab(1, 'https://openheaders.io');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('rule-1');
  });

  it('does not duplicate the rule when both tab URL and tracked resource match', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);
    addTrackedUrl(1, 'https://api.openheaders.io/data');

    const { activeRules: result } = getActiveRulesForTab(1, 'https://app.openheaders.io/dashboard');
    expect(result).toHaveLength(1);
  });
});

describe('checkIfUrlMatchesAnyRule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
    mockGetRules.mockReturnValue([]);
  });

  it('returns true when URL matches an enabled rule', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['*.openheaders.io']),
        enabled: true,
      }),
    ]);
    expect(checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2')).toBe(true);
  });

  it('returns true when URL matches a disabled rule (tracks for Active tab)', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['*.openheaders.io']),
        enabled: false,
      }),
    ]);
    expect(checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2')).toBe(true);
  });

  it('returns false when URL matches no rules', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['*.example.com']),
      }),
    ]);
    expect(checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2')).toBe(false);
  });

  it('returns false when no rules exist', () => {
    seedRules([]);
    expect(checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2')).toBe(false);
  });

  it('matches path-based patterns against full URLs', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['github.githubassets.com/assets']),
      }),
    ]);
    expect(checkIfUrlMatchesAnyRule('https://github.githubassets.com/assets/37160-72dc5a515abc7d3b.js')).toBe(true);
  });
});

describe('matchRulesToRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRules.mockReturnValue([]);
  });

  it('returns uid, name, type, pattern, and deferred flag for every enabled matching rule', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        type: 'header',
        conditions: hostConditions(['*.openheaders.io']),
      }),
      makeHeaderRule({
        uid: 'rule-2',
        type: 'header',
        conditions: hostConditions(['*.example.com']),
      }),
    ]);

    const result = matchRulesToRequest('https://api.openheaders.io/v2');
    expect(result).toHaveLength(1);
    expect(result[0]!).toEqual({
      uid: 'rule-1',
      name: 'Test Rule',
      type: 'header',
      pattern: '*://*.openheaders.io/*',
      // Plain override header rule — no merge action, so not deferred.
      deferred: false,
      // Arbitration metadata — normalized X-Debug / override → request-side set.
      headerOps: [{ side: 'request', operation: 'set', name: 'x-debug' }],
    });
  });

  it('marks header rules with a request-header merge operation as deferred', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
        action: {
          requestHeaders: [
            {
              uid: 'thm00080', operation: 'merge',
              headerName: 'X-Stacked',
              value: 'a',
              mergeSeparator: ',',
            },
          ],
          responseHeaders: [],
        },
      }),
    ]);
    const result = matchRulesToRequest('https://api.openheaders.io/v2');
    expect(result[0]!.deferred).toBe(true);
  });

  it('marks header rules with a response-header merge operation as deferred', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
        action: {
          requestHeaders: [],
          responseHeaders: [
            {
              uid: 'thm00081', operation: 'merge',
              headerName: 'X-Stacked',
              value: 'a',
              mergeSeparator: ',',
            },
          ],
        },
      }),
    ]);
    const result = matchRulesToRequest('https://api.openheaders.io/v2');
    expect(result[0]!.deferred).toBe(true);
  });

  it('excludes disabled rules from matchRulesToRequest', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        conditions: hostConditions(['*.openheaders.io']),
        enabled: false,
      }),
    ]);

    expect(matchRulesToRequest('https://api.openheaders.io/v2')).toEqual([]);
  });
});

describe('addTrackedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
  });

  it('adds a URL with a timestamp and resource type', () => {
    const before = Date.now();
    addTrackedUrl(1, 'https://api.openheaders.io/v2', 'xmlhttprequest');
    const after = Date.now();

    const tracked = tabsWithActiveRules.get(1)!;
    expect(tracked.has('https://api.openheaders.io/v2')).toBe(true);
    const res = tracked.get('https://api.openheaders.io/v2')!;
    expect(res.timestamp).toBeGreaterThanOrEqual(before);
    expect(res.timestamp).toBeLessThanOrEqual(after);
    expect(res.resourceType).toBe('xmlhttprequest');
  });

  it('notifies popup when a new URL is tracked', () => {
    addTrackedUrl(1, 'https://api.openheaders.io/v2');
    // Bridge broadcast path: direct `sendMessage({...})` without a callback
    // so Firefox promise rejects stay silent when no page is open.
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'trackedUrlsUpdated', tabId: 1 });
  });

  it('does not notify for duplicate URLs', () => {
    addTrackedUrl(1, 'https://api.openheaders.io/v2');
    mockSendMessage.mockClear();
    addTrackedUrl(1, 'https://api.openheaders.io/v2');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('creates tab entry if it does not exist', () => {
    expect(tabsWithActiveRules.has(42)).toBe(false);
    addTrackedUrl(42, 'https://openheaders.io');
    expect(tabsWithActiveRules.has(42)).toBe(true);
  });

  it('tracks all URLs without a cap', () => {
    for (let i = 0; i < 100; i++) {
      addTrackedUrl(1, `https://openheaders.io/page/${i}`);
    }
    expect(tabsWithActiveRules.get(1)!.size).toBe(100);

    addTrackedUrl(1, 'https://openheaders.io/page/new');
    expect(tabsWithActiveRules.get(1)!.size).toBe(101);
    expect(tabsWithActiveRules.get(1)!.has('https://openheaders.io/page/0')).toBe(true);
    expect(tabsWithActiveRules.get(1)!.has('https://openheaders.io/page/new')).toBe(true);
  });
});

describe('ingestPerfEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
    mockGetRules.mockReturnValue([]);
  });

  it('adds matching URLs with source=perfObserver and the cache flag', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*.cdn.openheaders.io']) })]);
    const count = ingestPerfEntries(5, [
      { url: 'https://assets.cdn.openheaders.io/chunk.js', initiatorType: 'script', servedFromCache: true },
    ]);
    expect(count).toBe(1);
    const tracked = tabsWithActiveRules.get(5)!;
    const entry = [...tracked.values()][0]!;
    expect(entry.sources.has('perfObserver')).toBe(true);
    expect(entry.servedFromCache).toBe(true);
    expect(entry.resourceType).toBe('script');
  });

  it('skips non-matching URLs', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*.openheaders.io']) })]);
    const count = ingestPerfEntries(5, [
      { url: 'https://unrelated.com/chunk.js', initiatorType: 'script', servedFromCache: true },
    ]);
    expect(count).toBe(0);
    expect(tabsWithActiveRules.has(5)).toBe(false);
  });

  it('skips non-trackable URLs (chrome://, etc.)', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*']) })]);
    const count = ingestPerfEntries(5, [
      { url: 'chrome://extensions', initiatorType: 'other', servedFromCache: false },
    ]);
    expect(count).toBe(0);
  });

  it('maps perf initiator types to tracked resource types', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*']) })]);
    ingestPerfEntries(5, [
      { url: 'https://a.openheaders.io/x.js', initiatorType: 'script', servedFromCache: false },
      { url: 'https://a.openheaders.io/y.png', initiatorType: 'img', servedFromCache: false },
      { url: 'https://a.openheaders.io/z.css', initiatorType: 'css', servedFromCache: false },
      { url: 'https://a.openheaders.io/api', initiatorType: 'fetch', servedFromCache: false },
    ]);
    const tracked = tabsWithActiveRules.get(5)!;
    const byType = [...tracked.values()].reduce<Record<string, number>>((acc, r) => {
      acc[r.resourceType] = (acc[r.resourceType] ?? 0) + 1;
      return acc;
    }, {});
    expect(byType).toEqual({ script: 1, image: 1, stylesheet: 1, xmlhttprequest: 1 });
  });

  it('preserves webRequest provenance when a URL is re-observed via perf', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*.openheaders.io']) })]);
    addTrackedUrl(5, 'https://api.openheaders.io/v2', 'xmlhttprequest');
    ingestPerfEntries(5, [{ url: 'https://api.openheaders.io/v2', initiatorType: 'fetch', servedFromCache: true }]);
    const entry = tabsWithActiveRules.get(5)!.get('https://api.openheaders.io/v2')!;
    expect(entry.sources.has('webRequest')).toBe(true);
    expect(entry.sources.has('perfObserver')).toBe(true);
    // servedFromCache was false from webRequest path — a subsequent
    // cache-served perf observation shouldn't flip it back to true.
    expect(entry.servedFromCache).toBe(false);
  });

  it('ignores empty input and invalid tab ids', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*']) })]);
    expect(ingestPerfEntries(0, [])).toBe(0);
    expect(
      ingestPerfEntries(-1, [{ url: 'https://openheaders.io/', initiatorType: 'script', servedFromCache: false }]),
    ).toBe(0);
  });
});
