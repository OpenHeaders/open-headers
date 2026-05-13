import type { HeaderRule, Rule, RuleCondition } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/browser-api', () => ({
  declarativeNetRequest: {
    getDynamicRules: vi.fn(() => Promise.resolve([])),
    updateDynamicRules: vi.fn(() => Promise.resolve()),
    getSessionRules: vi.fn(() => Promise.resolve([])),
    updateSessionRules: vi.fn(() => Promise.resolve()),
  },
  storage: { sync: { get: vi.fn((_k: string[], cb: (r: Record<string, unknown>) => void) => cb({})) } },
}));

vi.mock('@utils/messaging', () => ({
  sendMessageWithCallback: vi.fn(),
}));

vi.mock('@/workbench/settings/store', () => ({
  get: vi.fn((key: string) => {
    switch (key) {
      case 'rulesEngine.maxActiveRules':
        return 5000;
      case 'rulesEngine.warnOnLargeRuleSets':
        return true;
      case 'rulesEngine.largeRuleSetThreshold':
        return 4000;
      default:
        return undefined;
    }
  }),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/background/modules/test-runner', () => ({
  getActiveRunSnapshots: vi.fn(() => []),
  getActiveTestTabIds: vi.fn(() => []),
}));

vi.mock('@openheaders/oracle/entity/pause-markers-store', () => ({
  getPauseMarkers: vi.fn(() => new Map<string, 'paused' | 'unpaused'>()),
  applyExternalSnapshot: vi.fn(),
}));

vi.mock('@/background/modules/rule-state-observer', () => ({
  observeRuleState: vi.fn(),
}));

vi.mock('@/background/modules/variables-resolver', () => ({
  resolveRulesForCompile: vi.fn((rules: Rule[]) => rules),
  getLastAggregatedResolutionErrors: vi.fn(() => []),
  getLastResolutionErrors: vi.fn(() => new Map<string, unknown>()),
  // Compile pipeline drops rules whose `uid` is in this set before
  // handing to Chrome DNR. Status tests don't exercise the unresolved
  // gate — default to "none unresolved" so every rule compiles.
  getUnresolvableRuleUids: vi.fn(() => new Set<string>()),
  // DNR compile pipeline now consults this for live-bypass exclusion;
  // status tests don't touch Live Variables so the default is "no
  // workflow uids referenced" — no excludedRequestHeaders attached.
  computeRuleLiveBypass: vi.fn(() => new Set<string>()),
  // Sync-warm pre-compile hook — no-op in status tests (no LV opts in).
  kickSyncWarmRefreshes: vi.fn(async () => {}),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getRules: vi.fn(() => []),
}));

vi.mock('@/background/inject-manager', () => ({
  updateScriptableRules: vi.fn(),
}));

import { declarativeNetRequest } from '@utils/browser-api';
import { applyAllRulesAsync, setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';
import { getLastAggregatedResolutionErrors, getLastResolutionErrors } from '@/background/modules/variables-resolver';
import { __resetStatusForTests, getStatusSnapshot, type StatusSnapshot } from '@/shared/status';
import { get as getSetting } from '@/workbench/settings/store';

const mockGetDynamicRules = declarativeNetRequest!.getDynamicRules as ReturnType<typeof vi.fn>;
const mockUpdateDynamicRules = declarativeNetRequest!.updateDynamicRules as ReturnType<typeof vi.fn>;
const mockGetSessionRules = declarativeNetRequest!.getSessionRules as ReturnType<typeof vi.fn>;
const mockUpdateSessionRules = declarativeNetRequest!.updateSessionRules as ReturnType<typeof vi.fn>;
const mockGetSetting = getSetting as unknown as ReturnType<typeof vi.fn>;
const mockAggregatedErrors = getLastAggregatedResolutionErrors as ReturnType<typeof vi.fn>;
const mockResolutionErrors = getLastResolutionErrors as ReturnType<typeof vi.fn>;

function hostConditions(domains: string[]): RuleCondition[] {
  return domains.length > 0 ? [{ uid: 'tcd00015', type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'r1a2b3c4',
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    published: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      requestHeaders: [{ uid: 'thm00013', operation: 'override', headerName: 'Authorization', value: 'Bearer test-token' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function rulesSnapshot(): StatusSnapshot['rules'] {
  return getStatusSnapshot().rules;
}

describe('dnr-manager Status reporting (rules subsystem)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStatusForTests();
    setRulesPaused(false);
    mockGetDynamicRules.mockResolvedValue([]);
    mockUpdateDynamicRules.mockResolvedValue(undefined);
    mockGetSessionRules.mockResolvedValue([]);
    mockUpdateSessionRules.mockResolvedValue(undefined);
    mockAggregatedErrors.mockReturnValue([]);
    mockResolutionErrors.mockReturnValue(new Map());
    mockGetSetting.mockImplementation((key: string) => {
      switch (key) {
        case 'rulesEngine.maxActiveRules':
          return 5000;
        case 'rulesEngine.warnOnLargeRuleSets':
          return true;
        case 'rulesEngine.largeRuleSetThreshold':
          return 4000;
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    __resetStatusForTests();
  });

  it('reports green with active count after a successful rebuild', async () => {
    await applyAllRulesAsync();
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('green');
    expect(entry?.message).toMatch(/0 active DNR rule/);
  });

  it('includes active count in message + context', async () => {
    updateNetworkRules([makeHeaderRule()]);
    // Wait for the async rebuild to resolve.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('green');
    expect(entry?.message).toBe('1 active DNR rule');
    expect(entry?.context?.active).toBe(1);
  });

  it('reports green "Rule execution paused" when paused', async () => {
    setRulesPaused(true);
    try {
      await applyAllRulesAsync();
      const entry = rulesSnapshot();
      expect(entry?.state).toBe('green');
      expect(entry?.message).toBe('Rule execution paused');
    } finally {
      setRulesPaused(false);
    }
  });

  it('reports red with error when updateDynamicRules rejects', async () => {
    mockUpdateDynamicRules.mockRejectedValueOnce(new Error('quota exceeded'));
    await applyAllRulesAsync();
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/Failed to apply dynamic DNR rules: quota exceeded/);
    expect(entry?.context?.layer).toBe('dynamic');
  });

  it('reports red when updateSessionRules rejects', async () => {
    mockUpdateSessionRules.mockRejectedValueOnce(new Error('session layer down'));
    await applyAllRulesAsync();
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/Failed to apply session DNR rules: session layer down/);
    expect(entry?.context?.layer).toBe('session');
  });

  it('reports yellow with dropped count when rule cap is exceeded', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 1;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return false;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 4000;
      return undefined;
    });
    const rules = [
      makeHeaderRule({ uid: 'aa111111' }),
      makeHeaderRule({ uid: 'bb222222' }),
      makeHeaderRule({ uid: 'cc333333' }),
    ];
    updateNetworkRules(rules);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toMatch(/Dropped 2 rules over cap \(1\)/);
    expect(entry?.context?.dropped).toBe(2);
    expect(entry?.context?.cap).toBe(1);
  });

  it('reports yellow "approaching DNR capacity" when over threshold', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 5000;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return true;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 2;
      return undefined;
    });
    const rules = [
      makeHeaderRule({ uid: 'aa111111' }),
      makeHeaderRule({ uid: 'bb222222' }),
      makeHeaderRule({ uid: 'cc333333' }),
    ];
    updateNetworkRules(rules);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toMatch(/Approaching DNR capacity \(3 ≥ 2\)/);
  });

  it('cap breach wins over large-ruleset warning (worst-first priority)', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 2;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return true;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 1;
      return undefined;
    });
    const rules = [
      makeHeaderRule({ uid: 'aa111111' }),
      makeHeaderRule({ uid: 'bb222222' }),
      makeHeaderRule({ uid: 'cc333333' }),
    ];
    updateNetworkRules(rules);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toMatch(/Dropped 1 rule over cap \(2\)/);
  });

  it('reports yellow with unresolved-variable summary when resolver returns errors', async () => {
    mockAggregatedErrors.mockReturnValue([
      { reference: 'TOKEN', reason: 'unresolved', namespace: null, variableName: 'TOKEN', hint: 'Unknown variable' },
      {
        reference: 'env.API_URL',
        reason: 'unset-in-scope',
        namespace: 'env',
        variableName: 'API_URL',
        activeEnvironmentId: 'env-staging',
        defaultEnvironmentId: null,
        hint: 'Add API_URL to staging',
      },
    ]);
    mockResolutionErrors.mockReturnValue(
      new Map([
        ['rule-a', [{ reference: 'TOKEN' }]],
        ['rule-b', [{ reference: 'env.API_URL' }]],
      ]),
    );
    await applyAllRulesAsync();
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toBe('2 unresolved variables in 2 rules');
    expect(entry?.context?.unresolvedCount).toBe(2);
    expect(entry?.context?.affectedRuleCount).toBe(2);
    expect(entry?.context?.firstReference).toBe('TOKEN');
  });

  it('unresolved variables win over cap breach (worst-first priority)', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 1;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return false;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 4000;
      return undefined;
    });
    mockAggregatedErrors.mockReturnValue([
      { reference: 'TOKEN', reason: 'unresolved', namespace: null, variableName: 'TOKEN', hint: 'x' },
    ]);
    mockResolutionErrors.mockReturnValue(new Map([['rule-a', [{ reference: 'TOKEN' }]]]));
    updateNetworkRules([
      makeHeaderRule({ uid: 'aa111111' }),
      makeHeaderRule({ uid: 'bb222222' }),
      makeHeaderRule({ uid: 'cc333333' }),
    ]);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('yellow');
    expect(entry?.message).toMatch(/unresolved variable/);
  });

  it('transport failure still wins over unresolved variables', async () => {
    mockAggregatedErrors.mockReturnValue([
      { reference: 'TOKEN', reason: 'unresolved', namespace: null, variableName: 'TOKEN', hint: 'x' },
    ]);
    mockResolutionErrors.mockReturnValue(new Map([['rule-a', [{ reference: 'TOKEN' }]]]));
    mockUpdateDynamicRules.mockRejectedValueOnce(new Error('boom'));
    await applyAllRulesAsync();
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/dynamic DNR rules: boom/);
  });

  it('dynamic-layer failure wins over cap breach (worst-first priority)', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 1;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return false;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 4000;
      return undefined;
    });
    mockUpdateDynamicRules.mockRejectedValueOnce(new Error('broken'));
    updateNetworkRules([makeHeaderRule({ uid: 'aa111111' }), makeHeaderRule({ uid: 'bb222222' })]);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const entry = rulesSnapshot();
    expect(entry?.state).toBe('red');
    expect(entry?.message).toMatch(/dynamic DNR rules: broken/);
  });
});
