/**
 * Match Tracker — direct unit tests over the membership decisions.
 * `request-tracker` and `url-utils` are mocked so the tests exercise
 * only the logic this module owns (trackable gate, normalization,
 * rule-match check, tabsWithActiveRules transitions on failure).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkIfUrlMatchesAnyRule: vi.fn<(url: string) => boolean>(),
  addTrackedUrl: vi.fn(),
  tabsWithActiveRules: new Map<number, Map<string, unknown>>(),
  isTrackableUrl: vi.fn<(url: string) => boolean>(),
  normalizeUrlForTracking: vi.fn<(url: string) => string>(),
}));

vi.mock('@/background/modules/request-tracker', () => ({
  checkIfUrlMatchesAnyRule: (url: string) => mocks.checkIfUrlMatchesAnyRule(url),
  addTrackedUrl: (...args: unknown[]) => mocks.addTrackedUrl(...args),
  tabsWithActiveRules: mocks.tabsWithActiveRules,
}));

vi.mock('@/background/modules/url-utils', () => ({
  isTrackableUrl: (url: string) => mocks.isTrackableUrl(url),
  normalizeUrlForTracking: (url: string) => mocks.normalizeUrlForTracking(url),
}));

const { checkIfUrlMatchesAnyRule, addTrackedUrl, tabsWithActiveRules, isTrackableUrl, normalizeUrlForTracking } = mocks;

import {
  dropOnNetworkFailure,
  dropTabTracking,
  ingestMatchObservation,
} from '@/background/rule-engine-driver/match-tracker';

beforeEach(() => {
  checkIfUrlMatchesAnyRule.mockReset();
  addTrackedUrl.mockReset();
  isTrackableUrl.mockReset();
  normalizeUrlForTracking.mockReset();
  tabsWithActiveRules.clear();
  // Default behaviors.
  isTrackableUrl.mockReturnValue(true);
  normalizeUrlForTracking.mockImplementation((u) => u);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('match-tracker — ingestMatchObservation', () => {
  it('returns false and skips downstream work when tabId is -1', () => {
    const result = ingestMatchObservation({ tabId: -1, url: 'https://x', resourceType: 'xmlhttprequest' });
    expect(result).toBe(false);
    expect(checkIfUrlMatchesAnyRule).not.toHaveBeenCalled();
    expect(addTrackedUrl).not.toHaveBeenCalled();
  });

  it('returns false when URL is untrackable (chrome://, etc.)', () => {
    isTrackableUrl.mockReturnValue(false);
    const result = ingestMatchObservation({ tabId: 1, url: 'chrome://settings', resourceType: 'main_frame' });
    expect(result).toBe(false);
    expect(addTrackedUrl).not.toHaveBeenCalled();
  });

  it('returns false when no rule matches the URL', () => {
    checkIfUrlMatchesAnyRule.mockReturnValue(false);
    const result = ingestMatchObservation({
      tabId: 1,
      url: 'https://openheaders.io/x',
      resourceType: 'xmlhttprequest',
    });
    expect(result).toBe(false);
    expect(addTrackedUrl).not.toHaveBeenCalled();
  });

  it('returns true and adds the normalized URL when a rule matches', () => {
    checkIfUrlMatchesAnyRule.mockReturnValue(true);
    normalizeUrlForTracking.mockReturnValue('https://openheaders.io/x');
    const result = ingestMatchObservation({
      tabId: 7,
      url: 'https://openheaders.io/x?utm=1',
      resourceType: 'xmlhttprequest',
    });
    expect(result).toBe(true);
    expect(checkIfUrlMatchesAnyRule).toHaveBeenCalledWith('https://openheaders.io/x');
    expect(addTrackedUrl).toHaveBeenCalledWith(7, 'https://openheaders.io/x', 'xmlhttprequest');
  });
});

describe('match-tracker — dropOnNetworkFailure', () => {
  it('returns false when the tab has no tracked URLs', () => {
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/x' })).toBe(false);
  });

  it('returns false when the URL is not tracked', () => {
    tabsWithActiveRules.set(1, new Map([['https://openheaders.io/other', {}]]));
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/x' })).toBe(false);
  });

  it('removes the URL and returns true when tracked; leaves the tab map intact when others remain', () => {
    tabsWithActiveRules.set(
      1,
      new Map([
        ['https://openheaders.io/a', {}],
        ['https://openheaders.io/b', {}],
      ]),
    );
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/a' })).toBe(true);
    expect(tabsWithActiveRules.get(1)?.size).toBe(1);
    expect(tabsWithActiveRules.get(1)?.has('https://openheaders.io/b')).toBe(true);
  });

  it('drops the entire tab entry when the last tracked URL is removed', () => {
    tabsWithActiveRules.set(1, new Map([['https://openheaders.io/a', {}]]));
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/a' })).toBe(true);
    expect(tabsWithActiveRules.has(1)).toBe(false);
  });
});

describe('match-tracker — dropTabTracking', () => {
  it('removes every tracked URL for the tab', () => {
    tabsWithActiveRules.set(
      1,
      new Map([
        ['https://openheaders.io/a', {}],
        ['https://openheaders.io/b', {}],
      ]),
    );
    dropTabTracking(1);
    expect(tabsWithActiveRules.has(1)).toBe(false);
  });

  it('is a no-op for unknown tabs', () => {
    expect(() => dropTabTracking(42)).not.toThrow();
  });
});
