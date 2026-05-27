/**
 * Match Tracker — direct unit tests over the membership decisions.
 * `request-tracker` and `url-utils` are mocked so the tests exercise
 * only the logic this module owns (trackable gate, normalization,
 * rule-match check, tracked-store transitions on failure).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllTracking,
  hasTrackedTab,
  setTrackedResource,
} from '@openheaders/oracle/tracking/tab-tracking-store';

const mocks = vi.hoisted(() => ({
  checkIfUrlMatchesAnyRule: vi.fn<(url: string) => boolean>(),
  addTrackedUrl: vi.fn(),
  isTrackableUrl: vi.fn<(url: string) => boolean>(),
  normalizeUrlForTracking: vi.fn<(url: string) => string>(),
}));

vi.mock('@/background/modules/request-tracker', () => ({
  checkIfUrlMatchesAnyRule: (url: string) => mocks.checkIfUrlMatchesAnyRule(url),
  addTrackedUrl: (...args: unknown[]) => mocks.addTrackedUrl(...args),
}));

vi.mock('@/background/modules/url-utils', () => ({
  isTrackableUrl: (url: string) => mocks.isTrackableUrl(url),
  normalizeUrlForTracking: (url: string) => mocks.normalizeUrlForTracking(url),
}));

const { checkIfUrlMatchesAnyRule, addTrackedUrl, isTrackableUrl, normalizeUrlForTracking } = mocks;

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
  clearAllTracking();
  // Default behaviors.
  isTrackableUrl.mockReturnValue(true);
  normalizeUrlForTracking.mockImplementation((u) => u);
});

afterEach(() => {
  vi.clearAllMocks();
  clearAllTracking();
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
    setTrackedResource(1, 'https://openheaders.io/other', 'xmlhttprequest', 'webRequest', false);
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/x' })).toBe(false);
  });

  it('removes the URL and returns true when tracked; leaves the tab map intact when others remain', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    setTrackedResource(1, 'https://openheaders.io/b', 'xmlhttprequest', 'webRequest', false);
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/a' })).toBe(true);
    expect(hasTrackedTab(1)).toBe(true);
  });

  it('drops the entire tab entry when the last tracked URL is removed', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    expect(dropOnNetworkFailure({ tabId: 1, url: 'https://openheaders.io/a' })).toBe(true);
    expect(hasTrackedTab(1)).toBe(false);
  });
});

describe('match-tracker — dropTabTracking', () => {
  it('removes every tracked URL for the tab', () => {
    setTrackedResource(1, 'https://openheaders.io/a', 'xmlhttprequest', 'webRequest', false);
    setTrackedResource(1, 'https://openheaders.io/b', 'xmlhttprequest', 'webRequest', false);
    dropTabTracking(1);
    expect(hasTrackedTab(1)).toBe(false);
  });

  it('is a no-op for unknown tabs', () => {
    expect(() => dropTabTracking(42)).not.toThrow();
  });
});
