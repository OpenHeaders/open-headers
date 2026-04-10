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

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { declarativeNetRequest } from '@utils/browser-api';
import { setPausedGroups, setRulesPaused, updateNetworkRules } from '@/background/dnr-manager';
import { formatUrlPattern } from '@/background/modules/url-utils';

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
    uid: `rule-${crypto.randomUUID?.() ?? 'a1b2'}`.slice(0, 8),
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      operation: 'override',
      headerName: 'Authorization',
      isResponse: false,
      value: 'Bearer test-token',
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
    setPausedGroups([]);
    mockGetDynamicRules.mockResolvedValue([]);
    mockUpdateDynamicRules.mockResolvedValue(undefined);
  });

  // ── Static header injection ──

  describe('static header injection', () => {
    it('injects header rule with static value', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'X-Custom', isResponse: false, value: 'static-value' },
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
        action: { operation: 'override', headerName: 'Authorization', isResponse: false, value: '   ' },
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('skips rule with no static value (undefined)', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'Authorization', isResponse: false, value: undefined },
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
        action: { operation: 'override', headerName: 'X-Test', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { operation: string }[] } };
      expect(dnrRule.action.requestHeaders[0].operation).toBe('set');
    });

    it('uses "append" operation for add', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'add', headerName: 'X-Test', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
      const dnrRule = rules[0] as { action: { requestHeaders: { operation: string }[] } };
      expect(dnrRule.action.requestHeaders[0].operation).toBe('append');
    });

    it('creates remove rules without needing a value', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'remove', headerName: 'X-Unwanted', isResponse: false, value: undefined },
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

  describe('paused groups (collection/folder paths)', () => {
    it('skips rules under a paused collection path', async () => {
      setPausedGroups(['rules/api-collection']);
      const rule = makeHeaderRule({
        path: 'rules/api-collection/my-rule-a1b2',
        action: { operation: 'override', headerName: 'X-Api', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('allows rules from non-paused collections', async () => {
      setPausedGroups(['rules/api-collection']);
      const rule = makeHeaderRule({
        path: 'rules/other-collection/my-rule-c3d4',
        action: { operation: 'override', headerName: 'X-Other', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('skips rules under a paused sub-folder', async () => {
      setPausedGroups(['rules/my-collection/staging-folder']);
      const rule = makeHeaderRule({
        path: 'rules/my-collection/staging-folder/my-rule-e5f6',
        action: { operation: 'override', headerName: 'X-Staged', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(0);
    });

    it('allows rules when collection is unpaused', async () => {
      setPausedGroups(['rules/api-collection']);
      const rule = makeHeaderRule({
        path: 'rules/api-collection/my-rule-a1b2',
        action: { operation: 'override', headerName: 'X-Api', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();
      expect(getRulesFromLastCall()).toHaveLength(0);

      // Unpause
      setPausedGroups([]);
      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  // ── Response headers ──

  describe('response headers', () => {
    it('creates response header rules with higher priority', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'X-Frame-Options', isResponse: true, value: 'DENY' },
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
    it('creates one rule per domain', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'X-Test', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io', 'api.openheaders.io', 'cdn.openheaders.io']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(3);
    });

    it('skips empty domain strings', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'X-Test', isResponse: false, value: 'value' },
        conditions: hostConditions(['openheaders.io', '', '  ']),
      });

      updateNetworkRules([rule]);
      await flushPromises();

      const rules = getRulesFromLastCall();
      expect(rules).toHaveLength(1);
    });
  });

  // ── No domains ──

  describe('no domains', () => {
    it('skips rule with empty domains array', async () => {
      const rule = makeHeaderRule({
        action: { operation: 'override', headerName: 'X-Test', isResponse: false, value: 'value' },
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
