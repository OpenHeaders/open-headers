import type { HeaderRule, Rule, RuleCondition } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn((key: string) => {
    switch (key) {
      case 'rulesEngine.maxActiveRules':
        return 5000;
      case 'rulesEngine.warnOnLargeRuleSets':
        return false;
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

vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  resolveRulesForCompile: vi.fn((rules: Rule[]) => rules),
  getLastAggregatedResolutionErrors: vi.fn(() => []),
  getLastResolutionErrors: vi.fn(() => new Map<string, unknown>()),
  getUnresolvableRuleUids: vi.fn(() => new Set<string>()),
  computeRuleLiveBypass: vi.fn(() => new Set<string>()),
  kickSyncWarmRefreshes: vi.fn(async () => {}),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getRules: vi.fn(() => []),
}));

// Mirrors the real return for the rules used here: plain override header
// rules install no in-page artifact, so the contribution is empty.
vi.mock('@/background/inject-manager', () => ({
  updateScriptableRules: vi.fn(() => new Set<string>()),
}));

import { declarativeNetRequest } from '@utils/browser-api';
import { applyAllRulesAsync, getEffectiveFireUids, setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';

const mockUpdateDynamicRules = declarativeNetRequest!.updateDynamicRules as ReturnType<typeof vi.fn>;

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
      requestHeaders: [
        { uid: 'thm00013', operation: 'override', headerName: 'Authorization', value: 'Bearer test-token' },
      ],
      responseHeaders: [],
    },
    ...overrides,
  };
}

async function rebuildWith(rules: Rule[]): Promise<void> {
  updateNetworkRules(rules);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('dnr-manager — getEffectiveFireUids', () => {
  beforeEach(() => {
    setRulesPaused(false);
    mockUpdateDynamicRules.mockResolvedValue(undefined);
  });

  it('is null before the first rebuild commits', () => {
    expect(getEffectiveFireUids()).toBeNull();
  });

  it('contains the uid of every rule that produced a live artifact', async () => {
    await rebuildWith([makeHeaderRule({ uid: 'aa111111' }), makeHeaderRule({ uid: 'bb222222' })]);
    const uids = getEffectiveFireUids();
    expect(uids).not.toBeNull();
    expect([...uids!].sort()).toEqual(['aa111111', 'bb222222']);
  });

  it('excludes unpublished drafts and disabled rules', async () => {
    await rebuildWith([
      makeHeaderRule({ uid: 'aa111111' }),
      makeHeaderRule({ uid: 'bb222222', published: false }),
      makeHeaderRule({ uid: 'cc333333', enabled: false }),
    ]);
    expect([...getEffectiveFireUids()!]).toEqual(['aa111111']);
  });

  it('excludes rules dropped over the active-rule cap', async () => {
    const { get } = await import('@openheaders/ui/workbench/settings/store');
    const mockGet = get as unknown as ReturnType<typeof vi.fn>;
    const defaultImpl = mockGet.getMockImplementation();
    mockGet.mockImplementation((key: string) => {
      if (key === 'rulesEngine.maxActiveRules') return 1;
      if (key === 'rulesEngine.warnOnLargeRuleSets') return false;
      if (key === 'rulesEngine.largeRuleSetThreshold') return 4000;
      return undefined;
    });
    try {
      await rebuildWith([makeHeaderRule({ uid: 'aa111111' }), makeHeaderRule({ uid: 'bb222222' })]);
      expect([...getEffectiveFireUids()!]).toEqual(['aa111111']);
    } finally {
      if (defaultImpl) mockGet.mockImplementation(defaultImpl);
    }
  });

  it('is empty while the engine is paused', async () => {
    setRulesPaused(true);
    try {
      await applyAllRulesAsync();
      expect(getEffectiveFireUids()?.size).toBe(0);
    } finally {
      setRulesPaused(false);
    }
  });

  it('retains the previous snapshot when the DNR apply fails', async () => {
    await rebuildWith([makeHeaderRule({ uid: 'aa111111' })]);
    expect([...getEffectiveFireUids()!]).toEqual(['aa111111']);

    mockUpdateDynamicRules.mockRejectedValueOnce(new Error('quota exceeded'));
    await rebuildWith([makeHeaderRule({ uid: 'bb222222' })]);

    expect([...getEffectiveFireUids()!]).toEqual(['aa111111']);
  });
});
