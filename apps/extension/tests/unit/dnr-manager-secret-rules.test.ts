/**
 * dnr-manager and the rules carrying a secret manager's value (the
 * Secret Providers plan's P2c): the compile asks the secret-manager
 * scope before it resolves, carrying whether a person caused the
 * rebuild, and a rule the scope names as secret-bearing lands in the
 * SESSION layer only — never in the dynamic layer Chrome writes to
 * disk.
 */

import type { HeaderRule, Rule } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrepare, mockSecretBearing } = vi.hoisted(() => ({
  mockPrepare: vi.fn<(rules: readonly Rule[], options: { retryFailed: boolean }) => Promise<void> | null>(() => null),
  mockSecretBearing: vi.fn<(rules: readonly Rule[]) => Set<string>>(() => new Set()),
}));

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
vi.mock('@utils/messaging', () => ({ sendMessageWithCallback: vi.fn() }));
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
vi.mock('@utils/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@openheaders/oracle/entity/pause-markers-store', () => ({
  getPausedUids: vi.fn(() => new Set<string>()),
  applyExternalSnapshot: vi.fn(),
}));
vi.mock('@/background/modules/rules/rule-state-observer', () => ({ observeRuleState: vi.fn() }));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  resolveRulesForCompile: vi.fn((rules: Rule[]) => rules),
  getLastAggregatedResolutionErrors: vi.fn(() => []),
  getLastResolutionErrors: vi.fn(() => new Map<string, unknown>()),
  getUnresolvableRuleUids: vi.fn(() => new Set<string>()),
  computeRuleLiveBypass: vi.fn(() => new Set<string>()),
  kickSyncWarmRefreshes: vi.fn(async () => {}),
}));
vi.mock('@/background/modules/observability-log', () => ({ recordLog: vi.fn() }));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({ getRules: vi.fn(() => []) }));
vi.mock('@/background/inject-manager', () => ({ updateScriptableRules: vi.fn(() => new Set<string>()) }));
vi.mock('@/background/modules/secret-manager/compile-secret-scope', () => ({
  prepareCompileSecretManagerScope: mockPrepare,
  secretBearingRuleUids: mockSecretBearing,
}));

import { getRules } from '@openheaders/oracle/entity/rule-store';
import { declarativeNetRequest } from '@utils/browser-api';
import { applyAllRulesAsync, setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';

const mockUpdateDynamicRules = declarativeNetRequest!.updateDynamicRules as ReturnType<typeof vi.fn>;
const mockUpdateSessionRules = declarativeNetRequest!.updateSessionRules as ReturnType<typeof vi.fn>;
const mockGetRules = getRules as ReturnType<typeof vi.fn>;

function headerRule(uid: string, value: string): HeaderRule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${uid}`,
    name: uid,
    type: 'header',
    enabled: true,
    published: true,
    conditions: [{ uid: 'c1', type: 'request-domains', values: ['*.openheaders.io'] }],
    action: {
      requestHeaders: [{ uid: 'h1', operation: 'override', headerName: 'Authorization', value }],
      responseHeaders: [],
    },
  };
}

function addedRules(mock: ReturnType<typeof vi.fn>): chrome.declarativeNetRequest.Rule[] {
  const last = mock.mock.calls.at(-1)?.[0] as { addRules?: chrome.declarativeNetRequest.Rule[] } | undefined;
  return last?.addRules ?? [];
}

async function rebuilt(rules: Rule[], options?: { retryFailedSecrets: boolean }): Promise<void> {
  updateNetworkRules(rules, options);
  // The rebuild serializer settles on the DNR promises — one more turn.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  setRulesPaused(false);
  mockPrepare.mockReturnValue(null);
  mockSecretBearing.mockReturnValue(new Set());
});

describe('dnr-manager — rules carrying a secret manager’s value', () => {
  it('asks the scope before resolving, carrying whether a person caused the rebuild', async () => {
    const rules = [headerRule('r-secret', 'Bearer {{vault.ApiToken}}')];
    await rebuilt(rules, { retryFailedSecrets: true });
    expect(mockPrepare).toHaveBeenCalledWith(rules, { retryFailed: true });
    await rebuilt(rules);
    expect(mockPrepare).toHaveBeenLastCalledWith(rules, { retryFailed: false });
    mockGetRules.mockReturnValue(rules);
    await applyAllRulesAsync();
    expect(mockPrepare).toHaveBeenLastCalledWith(rules, { retryFailed: false });
  });

  it('a secret-bearing rule compiles into the session layer only; its neighbour stays dynamic', async () => {
    const secret = headerRule('r-secret', 'Bearer resolved-secret');
    const plain = headerRule('r-plain', 'Bearer plain');
    mockSecretBearing.mockReturnValue(new Set(['r-secret']));
    await rebuilt([secret, plain]);
    const dynamic = addedRules(mockUpdateDynamicRules);
    const session = addedRules(mockUpdateSessionRules);
    expect(dynamic.map((r) => r.action.requestHeaders?.[0]?.value)).toEqual(['Bearer plain']);
    expect(session.map((r) => r.action.requestHeaders?.[0]?.value)).toEqual(['Bearer resolved-secret']);
  });
});
