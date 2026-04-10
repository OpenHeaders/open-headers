import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock rule-store before importing request-tracker
const mockGetRules = vi.fn<() => V5.Rule[]>(() => []);
vi.mock('@/background/modules/rule-store', () => ({
  getRules: (...args: unknown[]) => mockGetRules(...(args as [])),
}));

vi.mock('@utils/browser-api', () => ({
  storage: { onChanged: { addListener: vi.fn() } },
  tabs: { query: vi.fn() },
}));

const mockSendMessage = vi.fn();
vi.mock('@utils/messaging', () => ({
  sendMessageWithCallback: (...args: unknown[]) => mockSendMessage(...args),
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
  precompileRulePatterns,
  tabsWithActiveRules,
} from '@/background/modules/request-tracker';

// ── Helpers ──────────────────────────────────────────────────────────

function hostConditions(domains: string[]): V5.RuleCondition[] {
  return domains.length > 0 ? [{ type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    uid: `rule-${Math.random().toString(36).slice(2, 6)}`,
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test-value' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function seedRules(rules: V5.Rule[]): void {
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

  it('returns matching enabled rules with matchedUrls', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/v2');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Rule');
    expect(result[0].ruleType).toBe('header');
    expect(result[0].isEnabled).toBe(true);
    expect(result[0].matchType).toBe('direct');
    expect(result[0].matchedUrls).toHaveLength(1);
    expect(result[0].matchedUrls[0].url).toBe('https://api.openheaders.io/v2');
    expect(result[0].matchedUrls[0].pattern).toBe('*.openheaders.io');
    expect(result[0].matchedUrls[0].timestamp).toBeGreaterThan(0);
  });

  it('returns disabled matching rules (show all matching)', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
        enabled: true,
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Disabled', value: 'test' }],
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
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Other', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.example.com']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/v2');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Rule');
  });

  it('returns rules with wildcard domain as direct matches with tab URL in matchedUrls', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Global', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://any-site.com/page');
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe('direct');
    expect(result[0].matchedUrls).toHaveLength(1);
    expect(result[0].matchedUrls[0].url).toBe('https://any-site.com/page');
    expect(result[0].matchedUrls[0].pattern).toBe('*');
    expect(result[0].matchedUrls[0].timestamp).toBeGreaterThan(0);
  });

  it('skips incomplete (draft) rules', () => {
    seedRules([
      makeHeaderRule({
        uid: 'draft-rule',
        action: { requestHeaders: [{ operation: 'override', headerName: '', value: 'test' }], responseHeaders: [] },
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
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/test');
    expect(result[0].id).toBe('my-rule-id');
    expect(result[0].key).toBe('my-rule-id');
  });

  it('includes tags and rule details in results', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [],
          responseHeaders: [{ operation: 'override', headerName: 'X-Tagged', value: 'true' }],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    const { activeRules: result } = getActiveRulesForTab(1, 'https://api.openheaders.io/test');
    expect(result[0].ruleType).toBe('header');
    expect(result[0].summary).toContain('X-Tagged');
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

    const result = checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2');
    expect(result).toBe(true);
  });

  it('returns true when URL matches a disabled rule (tracks for Active tab)', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['*.openheaders.io']),
        enabled: false,
      }),
    ]);

    const result = checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2');
    expect(result).toBe(true);
  });

  it('returns false when URL matches no rules', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['*.example.com']),
      }),
    ]);

    const result = checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2');
    expect(result).toBe(false);
  });

  it('returns false when no rules exist', () => {
    seedRules([]);

    const result = checkIfUrlMatchesAnyRule('https://api.openheaders.io/v2');
    expect(result).toBe(false);
  });

  it('matches path-based patterns against full URLs', () => {
    seedRules([
      makeHeaderRule({
        conditions: hostConditions(['github.githubassets.com/assets']),
      }),
    ]);

    const result = checkIfUrlMatchesAnyRule('https://github.githubassets.com/assets/37160-72dc5a515abc7d3b.js');
    expect(result).toBe(true);
  });
});

describe('addTrackedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
  });

  it('adds a URL with a timestamp', () => {
    const before = Date.now();
    addTrackedUrl(1, 'https://api.openheaders.io/v2');
    const after = Date.now();

    const tracked = tabsWithActiveRules.get(1)!;
    expect(tracked.has('https://api.openheaders.io/v2')).toBe(true);
    const ts = tracked.get('https://api.openheaders.io/v2')!;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('notifies popup when a new URL is tracked', () => {
    addTrackedUrl(1, 'https://api.openheaders.io/v2');

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'trackedUrlsUpdated', tabId: 1 }, expect.any(Function));
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

describe('uniqueRequestCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
    mockGetRules.mockReturnValue([]);
  });

  it('returns 0 when no rules match', () => {
    seedRules([]);
    const { uniqueRequestCount } = getActiveRulesForTab(1, 'https://openheaders.io');
    expect(uniqueRequestCount).toBe(0);
  });

  it('counts tab URL as a request when rule matches', () => {
    seedRules([makeHeaderRule({ conditions: hostConditions(['*.openheaders.io']) })]);
    const { uniqueRequestCount } = getActiveRulesForTab(1, 'https://app.openheaders.io');
    expect(uniqueRequestCount).toBe(1);
  });

  it('deduplicates the same request matched by multiple rules', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Token', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);
    addTrackedUrl(1, 'https://api.openheaders.io/data');
    const { uniqueRequestCount, activeRules } = getActiveRulesForTab(1, 'https://app.openheaders.io');
    expect(activeRules).toHaveLength(2);
    // 2 unique requests: tab URL + 1 resource URL (not doubled across rules)
    expect(uniqueRequestCount).toBe(2);
  });

  it('counts resource URLs not matching all rules correctly', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
      makeHeaderRule({
        uid: 'rule-2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Other', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.cdn.openheaders.io']),
      }),
    ]);
    addTrackedUrl(1, 'https://assets.cdn.openheaders.io/bundle.js');
    const { uniqueRequestCount } = getActiveRulesForTab(1, 'https://app.openheaders.io');
    // tab URL (matches rule-1) + resource URL (matches both rules) = 2 unique
    expect(uniqueRequestCount).toBe(2);
  });
});

describe('getActiveRulesForTab with tracked resource URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabsWithActiveRules.clear();
    mockGetRules.mockReturnValue([]);
  });

  it('returns indirect matches with timestamps from tracked URLs', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.cdn.openheaders.io']),
      }),
    ]);

    // Simulate a tracked resource URL
    addTrackedUrl(1, 'https://assets.cdn.openheaders.io/bundle.js');

    const { activeRules: result } = getActiveRulesForTab(1, 'https://openheaders.io');
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe('indirect');
    expect(result[0].matchedUrls).toHaveLength(1);
    expect(result[0].matchedUrls[0].url).toBe('https://assets.cdn.openheaders.io/bundle.js');
    expect(result[0].matchedUrls[0].timestamp).toBeGreaterThan(0);
  });

  it('returns both direct and indirect matchedUrls for a rule matching both', () => {
    seedRules([
      makeHeaderRule({
        uid: 'rule-1',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'test' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['*.openheaders.io']),
      }),
    ]);

    addTrackedUrl(1, 'https://api.openheaders.io/data');

    const { activeRules: result } = getActiveRulesForTab(1, 'https://app.openheaders.io/dashboard');
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe('direct');
    expect(result[0].matchedUrls).toHaveLength(2);
    // Direct match (tab URL)
    expect(result[0].matchedUrls[0].url).toBe('https://app.openheaders.io/dashboard');
    // Indirect match (resource URL)
    expect(result[0].matchedUrls[1].url).toBe('https://api.openheaders.io/data');
  });
});
