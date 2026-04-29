import type { V5 } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('@utils/browser-api', () => ({
  declarativeNetRequest: {
    getDynamicRules: vi.fn(() => Promise.resolve([])),
    updateDynamicRules: vi.fn(() => Promise.resolve()),
  },
  storage: { sync: { get: vi.fn((_k: string[], cb: (r: Record<string, unknown>) => void) => cb({})) } },
}));

vi.mock('@utils/messaging', () => ({
  sendMessageWithCallback: vi.fn(),
}));

// Mock the settings store so dnr-manager's `getSetting` reads resolve to
// stable defaults instead of throwing "no definition registered". The
// unit under test is the rule compiler, not the settings layer.
vi.mock('@/workbench/settings/store', () => ({
  get: vi.fn((key: string) => {
    switch (key) {
      case 'rulesEngine.maxActiveRules':
        return 5000;
      case 'rulesEngine.warnOnLargeRuleSets':
        return false;
      case 'rulesEngine.largeRuleSetThreshold':
        return 4000;
      case 'network.userAgentOverride':
        return '';
      case 'network.blockThirdPartyCookies':
        return false;
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

import { formatUrlPattern } from '@openheaders/core/utils';
import { declarativeNetRequest } from '@utils/browser-api';
import { setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';
import { __setMarkersForTests as setPauseMarkers } from '@/background/modules/pause-markers-store';

const mockGetDynamicRules = declarativeNetRequest!.getDynamicRules as ReturnType<typeof vi.fn>;
const mockUpdateDynamicRules = declarativeNetRequest!.updateDynamicRules as ReturnType<typeof vi.fn>;

/** Flush the getDynamicRules().then(...) promise chain */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ── Helpers ──────────────────────────────────────────────────────────

/** Helper: build conditions from domain strings. */
function hostConditions(domains: string[]): V5.RuleCondition[] {
  return domains.length > 0 ? [{ type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    schemaVersion: 5,
    uid: `rule-${crypto.randomUUID?.() ?? 'a1b2'}`.slice(0, 8),
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'Bearer test-token' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function getRulesFromLastCall(): unknown[] {
  const lastCall = mockUpdateDynamicRules.mock.calls.at(-1);
  return lastCall?.[0]?.addRules ?? [];
}

// ── Tests ────────────────────────────────────────────────────────────

describe('header-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRulesPaused(false);
    setPauseMarkers({});
    mockGetDynamicRules.mockResolvedValue([]);
    mockUpdateDynamicRules.mockResolvedValue(undefined);
  });

  // ── Static header injection ──

  describe('static header injection', () => {
    it('injects header rule with static value', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Custom', value: 'static-value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      expect(mockUpdateDynamicRules).toHaveBeenCalledTimes(1);
      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { header: string; value: string }[] } };
      expect(dnrRule.action.requestHeaders[0].header).toBe('X-Custom');
      expect(dnrRule.action.requestHeaders[0].value).toBe('static-value');
    });

    it('skips rule with empty static value', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: '   ' }],
          responseHeaders: [],
        },
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('skips rule with no static value (undefined)', async () => {
      const rule = makeHeaderRule({
        action: { requestHeaders: [{ operation: 'override', headerName: 'Authorization' }], responseHeaders: [] },
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });
  });

  // ── Header operations ──

  describe('header operations', () => {
    it('uses "set" operation for override', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { operation: string }[] } };
      expect(dnrRule.action.requestHeaders[0].operation).toBe('set');
    });

    it('uses "append" operation for add on allowlisted headers', async () => {
      // Chrome DNR only accepts `append` on its built-in allowlist of standard
      // multi-value headers (Cookie, X-Forwarded-For, etc.). Custom X- headers
      // are rejected, which makes the rule a draft — covered separately below.
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'add', headerName: 'X-Forwarded-For', value: '10.0.0.1' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { operation: string }[] } };
      expect(dnrRule.action.requestHeaders[0].operation).toBe('append');
    });

    it('drops rules with "add" on non-appendable custom headers (becomes a draft)', async () => {
      // Authoring append on a non-allowlisted header must NOT produce any DNR
      // rule — isRuleComplete rejects it, so the compiler skips the rule
      // entirely and the rest of the ruleset still applies cleanly.
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'add', headerName: 'X-OH-Stack', value: 'a' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBe(0);
    });

    it('creates remove rules without needing a value', async () => {
      const rule = makeHeaderRule({
        action: { requestHeaders: [{ operation: 'remove', headerName: 'X-Unwanted' }], responseHeaders: [] },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { operation: string; header: string }[] } };
      expect(dnrRule.action.requestHeaders[0].operation).toBe('remove');
      expect(dnrRule.action.requestHeaders[0].header).toBe('X-Unwanted');
    });
  });

  // ── Disabled rules ──

  describe('disabled rules', () => {
    it('skips disabled rules entirely', async () => {
      const rule = makeHeaderRule({ enabled: false });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });
  });

  // ── Paused state ──

  describe('paused state', () => {
    it('clears all rules when paused', async () => {
      setRulesPaused(true);

      updateNetworkRules([makeHeaderRule()]);
      await flushPromises();

      expect(mockUpdateDynamicRules).toHaveBeenCalledWith(expect.objectContaining({ addRules: [] }));
    });
  });

  // ── Paused collections/folders ──

  describe('pause markers (collection/folder paths)', () => {
    it('skips rules under a paused collection path', async () => {
      setPauseMarkers({ 'rules/api-collection': 'paused' });
      const rule = makeHeaderRule({
        path: 'rules/api-collection/my-rule-a1b2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Api', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('allows rules from non-paused collections', async () => {
      setPauseMarkers({ 'rules/api-collection': 'paused' });
      const rule = makeHeaderRule({
        path: 'rules/other-collection/my-rule-c3d4',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Other', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('skips rules under a paused sub-folder', async () => {
      setPauseMarkers({ 'rules/my-collection/staging-folder': 'paused' });
      const rule = makeHeaderRule({
        path: 'rules/my-collection/staging-folder/my-rule-e5f6',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Staged', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('allows rules when collection is unpaused', async () => {
      setPauseMarkers({ 'rules/api-collection': 'paused' });
      const rule = makeHeaderRule({
        path: 'rules/api-collection/my-rule-a1b2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Api', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();
      expect(getRulesFromLastCall()).toHaveLength(0);

      // Unpause
      setPauseMarkers({});
      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('honors an unpaused override on a folder beneath a paused collection', async () => {
      // Closest-specifier wins: collection paused, but the staging folder
      // carries an explicit 'unpaused' override so its rules still fire.
      setPauseMarkers({
        'rules/api-collection': 'paused',
        'rules/api-collection/staging-folder': 'unpaused',
      });
      const overriddenRule = makeHeaderRule({
        path: 'rules/api-collection/staging-folder/my-rule-x1y2',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Override', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });
      const stillPausedRule = makeHeaderRule({
        path: 'rules/api-collection/other-folder/my-rule-z3w4',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Other', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([overriddenRule, stillPausedRule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      // The stringified rule list should mention X-Override but not X-Other.
      const serialized = JSON.stringify(rules);
      expect(serialized).toContain('X-Override');
      expect(serialized).not.toContain('X-Other');
    });
  });

  // ── Response headers ──

  describe('response headers', () => {
    it('creates response header rules with higher priority', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [],
          responseHeaders: [{ operation: 'override', headerName: 'X-Frame-Options', value: 'DENY' }],
        },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { priority: number; action: { responseHeaders: { header: string }[] } };
      expect(dnrRule.priority).toBe(1000);
      expect(dnrRule.action.responseHeaders[0].header).toBe('X-Frame-Options');
    });
  });

  // ── Multiple domains ──

  describe('multiple domains', () => {
    it('emits one DNR rule with requestDomains carrying every domain (Chrome ORs the list)', async () => {
      // Pre-architectural cleanup, the compiler emitted one DNR rule per
      // domain with a per-domain `urlFilter`. That burned rule-cap quota
      // and contradicted Chrome's native list semantics. The new shape:
      // one rule whose `requestDomains` carries the OR'd hostname list.
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io', 'api.openheaders.io', 'cdn.openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall() as Array<{ condition: { requestDomains?: string[]; urlFilter?: string } }>;
      expect(rules).toHaveLength(1);
      expect(rules[0]!.condition.requestDomains).toEqual([
        'openheaders.io',
        'api.openheaders.io',
        'cdn.openheaders.io',
      ]);
      // No per-domain urlFilter — the new shape uses Chrome's native domain list.
      expect(rules[0]!.condition.urlFilter).toBeUndefined();
    });

    it('skips empty domain strings inside the list', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions(['openheaders.io', '', '  ']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall() as Array<{ condition: { requestDomains?: string[] } }>;
      expect(rules).toHaveLength(1);
      expect(rules[0]!.condition.requestDomains).toEqual(['openheaders.io']);
    });
  });

  // ── No domains ──

  describe('no domains', () => {
    it('skips rule with empty domains array', async () => {
      const rule = makeHeaderRule({
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Test', value: 'value' }],
          responseHeaders: [],
        },
        conditions: hostConditions([]),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });
  });

  // ── Non-header rule types are ignored ──

  describe('non-header rule types', () => {
    it('ignores desktop-only rule types (body, delay, mock)', async () => {
      const bodyRule: V5.Rule = {
        schemaVersion: 5,
        uid: 'bdy1',
        path: 'rules/body',
        name: 'Body Rule',
        type: 'body',
        enabled: true,
        conditions: hostConditions(['openheaders.io']),
        action: { bodyType: 'static', body: '{"replaced": true}', resourceType: 'rest' },
      };

      updateNetworkRules([bodyRule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });
  });

  // ── formatUrlPattern ──

  describe('formatUrlPattern', () => {
    it('wraps plain domain with protocol wildcard and path', () => {
      expect(formatUrlPattern('openheaders.io')).toBe('*://openheaders.io/*');
    });

    it('preserves explicit protocol', () => {
      expect(formatUrlPattern('https://openheaders.io')).toBe('https://openheaders.io/*');
    });

    it('preserves explicit protocol with path', () => {
      expect(formatUrlPattern('https://openheaders.io/api')).toBe('https://openheaders.io/api');
    });

    it('handles wildcard subdomain', () => {
      expect(formatUrlPattern('*.openheaders.io')).toBe('*://*.openheaders.io/*');
    });

    it('handles IP address', () => {
      expect(formatUrlPattern('192.168.1.1')).toBe('*://192.168.1.1/*');
    });

    it('handles IP address with port', () => {
      expect(formatUrlPattern('192.168.1.1:8080')).toBe('*://192.168.1.1:8080/*');
    });

    it('handles localhost', () => {
      expect(formatUrlPattern('localhost')).toBe('*://localhost/*');
    });

    it('handles localhost with port', () => {
      expect(formatUrlPattern('localhost:3000')).toBe('*://localhost:3000/*');
    });
  });
});
