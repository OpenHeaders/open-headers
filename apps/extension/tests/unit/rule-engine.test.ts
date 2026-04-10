import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock header-manager before importing rule-engine
vi.mock('@/background/dnr-manager', () => ({
  updateNetworkRules: vi.fn(),
}));

vi.mock('@/background/modules/rule-store', () => ({
  getRules: vi.fn(() => []),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { updateNetworkRules } from '@/background/dnr-manager';
import { getLastRulesHash, scheduleUpdate, setLastRulesHash } from '@/background/modules/rule-engine';
import { getRules } from '@/background/modules/rule-store';

const mockUpdateNetworkRules = updateNetworkRules as ReturnType<typeof vi.fn>;
const mockGetRules = getRules as ReturnType<typeof vi.fn>;

function hostConditions(domains: string[]): V5.RuleCondition[] {
  return domains.length > 0 ? [{ type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    uid: 'r1a2',
    path: 'rules/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: { operation: 'override', headerName: 'Authorization', isResponse: false, value: 'Bearer test-token' },
    ...overrides,
  };
}

describe('RuleEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setLastRulesHash('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scheduleUpdate with immediate: true', () => {
    it('calls updateNetworkRules immediately', () => {
      const rules = [makeHeaderRule()];
      mockGetRules.mockReturnValue(rules);

      scheduleUpdate('init', { immediate: true });

      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);
      expect(mockUpdateNetworkRules).toHaveBeenCalledWith(rules);
    });

    it('updates lastRulesHash', () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);

      scheduleUpdate('init', { immediate: true });

      expect(getLastRulesHash()).toBeTruthy();
      expect(getLastRulesHash()).not.toBe('');
    });
  });

  describe('scheduleUpdate with debounce (default)', () => {
    it('does not call updateNetworkRules before debounce period', () => {
      scheduleUpdate('rulesUpdated');
      expect(mockUpdateNetworkRules).not.toHaveBeenCalled();
    });

    it('calls updateNetworkRules after debounce period', () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);

      scheduleUpdate('rulesUpdated');
      vi.advanceTimersByTime(150);

      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);
    });

    it('coalesces multiple rapid calls into one', () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);

      scheduleUpdate('rulesUpdated');
      scheduleUpdate('rulesUpdated');
      scheduleUpdate('rulesUpdated');
      scheduleUpdate('rulesUpdated');
      scheduleUpdate('rulesUpdated');

      vi.advanceTimersByTime(150);

      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);
    });

    it('resets debounce timer on each call', () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);

      scheduleUpdate('rulesUpdated');
      vi.advanceTimersByTime(100);

      scheduleUpdate('rulesUpdated');
      vi.advanceTimersByTime(100);
      expect(mockUpdateNetworkRules).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);
    });
  });

  describe('hash deduplication', () => {
    it('skips update when rules hash is unchanged for non-forced reasons', () => {
      const rules = [makeHeaderRule()];
      mockGetRules.mockReturnValue(rules);

      // First call sets the hash
      scheduleUpdate('rulesUpdated', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);

      // Second call with same rules — skipped (rulesUpdated is a forced reason,
      // so use a non-forced reason to test dedup)
      scheduleUpdate('other', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);
    });

    it('does NOT skip for forced reasons even when hash matches', () => {
      const rules = [makeHeaderRule()];
      mockGetRules.mockReturnValue(rules);

      scheduleUpdate('init', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);

      // Forced reasons always execute
      scheduleUpdate('pause', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(2);

      scheduleUpdate('rules', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(3);

      scheduleUpdate('init', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(4);

      scheduleUpdate('rulesUpdated', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(5);

      scheduleUpdate('pausedGroups', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(6);
    });

    it('updates when rules actually change', () => {
      mockGetRules.mockReturnValue([makeHeaderRule({ uid: 'r1a2' })]);
      scheduleUpdate('init', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(1);

      mockGetRules.mockReturnValue([makeHeaderRule({ uid: 'r3b4' })]);
      scheduleUpdate('init', { immediate: true });
      expect(mockUpdateNetworkRules).toHaveBeenCalledTimes(2);
    });
  });

  describe('hash tracking', () => {
    it('tracks rules hash after update', () => {
      mockGetRules.mockReturnValue([makeHeaderRule()]);

      scheduleUpdate('init', { immediate: true });

      expect(getLastRulesHash()).toBeTruthy();
      expect(getLastRulesHash()).not.toBe('');
    });

    it('setLastRulesHash / getLastRulesHash round-trip', () => {
      setLastRulesHash('abc123');
      expect(getLastRulesHash()).toBe('abc123');
    });
  });
});
