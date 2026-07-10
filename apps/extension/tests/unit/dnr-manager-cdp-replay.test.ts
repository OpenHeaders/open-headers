/**
 * dnr-manager — CDP standing-state replay on rule changes.
 *
 * A rule created/edited after a tab attached must reach that tab's CDP
 * planes (Fetch.enable patterns, document-bootstrap scripts) without a
 * re-attach: the registered replay runs after every COMMITTED rebuild
 * and on pause, and is skipped when the DNR apply fails (nothing
 * committed — the CDP planes must not run ahead of the DNR layer).
 */

import type { HeaderRule, Rule, RuleCondition } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/browser-api', () => ({
  isChrome: true,
  isEdge: false,
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

vi.mock('@openheaders/oracle/entity/pause-markers-store', () => ({
  getPauseMarkers: vi.fn(() => new Map<string, 'paused' | 'unpaused'>()),
  applyExternalSnapshot: vi.fn(),
}));

vi.mock('@/background/modules/rules/rule-state-observer', () => ({
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

vi.mock('@/background/inject-manager', () => ({
  updateScriptableRules: vi.fn(() => new Set<string>()),
}));

import { declarativeNetRequest } from '@utils/browser-api';
import { registerCdpRulesReplay, setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';

const mockUpdateDynamicRules = declarativeNetRequest!.updateDynamicRules as ReturnType<typeof vi.fn>;

function hostConditions(domains: string[]): RuleCondition[] {
  return [{ uid: 'tcd00015', type: 'request-domains', values: domains }];
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

describe('dnr-manager — CDP standing-state replay', () => {
  const replay = vi.fn();

  beforeEach(() => {
    replay.mockClear();
    setRulesPaused(false);
    mockUpdateDynamicRules.mockResolvedValue(undefined);
    registerCdpRulesReplay(replay);
  });

  it('runs after a committed rebuild', async () => {
    await rebuildWith([makeHeaderRule()]);
    expect(replay).toHaveBeenCalledTimes(1);
  });

  it('runs on pause so the CDP planes empty with the DNR layer', async () => {
    setRulesPaused(true);
    await rebuildWith([makeHeaderRule()]);
    expect(replay).toHaveBeenCalledTimes(1);
    setRulesPaused(false);
  });

  it('is skipped when the DNR apply fails — nothing committed', async () => {
    mockUpdateDynamicRules.mockRejectedValueOnce(new Error('quota'));
    await rebuildWith([makeHeaderRule()]);
    expect(replay).not.toHaveBeenCalled();
  });
});
