import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn(() => 'first-match'),
}));

vi.mock('@/background/dnr-manager', () => ({
  getEffectiveFireUids: vi.fn(() => null),
}));

vi.mock('@/background/modules/request-tracker', () => ({
  matchRulesToRequest: vi.fn(() => []),
}));

vi.mock('@/background/modules/shadow-arbitration', () => ({
  arbitrateWithStrategy: vi.fn((matches: unknown[]) => matches),
}));

vi.mock('@/background/modules/tab-telemetry', () => ({
  isTracked: vi.fn(() => true),
  recordObservedFire: vi.fn(),
}));

import { getEffectiveFireUids } from '@/background/dnr-manager';
import type { MatchingRule } from '@/background/modules/request-tracker';
import { matchRulesToRequest } from '@/background/modules/request-tracker';
import { arbitrateWithStrategy } from '@/background/modules/shadow-arbitration';
import { isTracked, recordObservedFire } from '@/background/modules/tab-telemetry';
import { recordFiresForObservation } from '@/background/rule-engine-driver/fire-recorder';

const mockEffectiveUids = getEffectiveFireUids as ReturnType<typeof vi.fn>;
const mockMatch = matchRulesToRequest as ReturnType<typeof vi.fn>;
const mockArbitrate = arbitrateWithStrategy as ReturnType<typeof vi.fn>;
const mockIsTracked = isTracked as ReturnType<typeof vi.fn>;
const mockRecord = recordObservedFire as ReturnType<typeof vi.fn>;

function makeMatch(uid: string, overrides: Partial<MatchingRule> = {}): MatchingRule {
  return {
    uid,
    name: `Rule ${uid}`,
    type: 'header',
    pattern: '*://*.openheaders.io/*',
    deferred: false,
    ...overrides,
  };
}

const INPUT = {
  tabId: 1,
  url: 'https://api.openheaders.io/x',
  requestId: 'req-1',
  timestampMs: 100,
  resourceType: 'xmlhttprequest' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEffectiveUids.mockReturnValue(null);
  mockMatch.mockReturnValue([]);
  mockArbitrate.mockImplementation((matches: unknown[]) => matches);
  mockIsTracked.mockReturnValue(true);
});

describe('fire-recorder — effective-uid gate', () => {
  it('records every arbitrated match while the effective set is unknown (null)', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111'), makeMatch('bb222222')]);

    recordFiresForObservation(INPUT);

    expect(mockRecord).toHaveBeenCalledTimes(2);
    expect(mockRecord).toHaveBeenCalledWith(
      1,
      'aa111111',
      'https://api.openheaders.io/x',
      'req-1',
      100,
      expect.objectContaining({ pattern: '*://*.openheaders.io/*' }),
    );
  });

  it('drops matches whose uid has no live engine artifact', () => {
    mockEffectiveUids.mockReturnValue(new Set(['bb222222']));
    mockMatch.mockReturnValue([makeMatch('aa111111'), makeMatch('bb222222')]);

    recordFiresForObservation(INPUT);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('bb222222');
  });

  it('arbitration only sees live matches — a dead rule cannot shadow', () => {
    mockEffectiveUids.mockReturnValue(new Set(['bb222222']));
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block' }), makeMatch('bb222222')]);

    recordFiresForObservation(INPUT);

    expect(mockArbitrate).toHaveBeenCalledTimes(1);
    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['bb222222']);
  });

  it('records nothing when the effective set is empty (engine paused)', () => {
    mockEffectiveUids.mockReturnValue(new Set());
    mockMatch.mockReturnValue([makeMatch('aa111111')]);

    recordFiresForObservation(INPUT);

    expect(mockArbitrate).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('skips the matcher entirely for untracked tabs', () => {
    mockIsTracked.mockReturnValue(false);

    recordFiresForObservation(INPUT);

    expect(mockMatch).not.toHaveBeenCalled();
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
