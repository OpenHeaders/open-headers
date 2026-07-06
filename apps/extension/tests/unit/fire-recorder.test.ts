import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/settings/store', () => ({
  get: vi.fn(() => 'first-match'),
}));

vi.mock('@/background/dnr-manager', () => ({
  getEffectiveFireUids: vi.fn(() => null),
  isDelayRedelivery: vi.fn(() => false),
}));

vi.mock('@/background/modules/request-tracker', () => ({
  matchRulesToRequest: vi.fn(() => []),
  doesResponseHeaderGateApprove: vi.fn(() => false),
}));

vi.mock('@/background/modules/rules/shadow-arbitration', () => ({
  arbitrateWithStrategy: vi.fn((matches: unknown[]) => matches),
}));

vi.mock('@/background/modules/tab-telemetry', () => ({
  isTracked: vi.fn(() => true),
  recordObservedFire: vi.fn(),
  recordReportedFire: vi.fn(),
}));

import { getEffectiveFireUids, isDelayRedelivery } from '@/background/dnr-manager';
import type { MatchingRule } from '@/background/modules/request-tracker';
import { doesResponseHeaderGateApprove, matchRulesToRequest } from '@/background/modules/request-tracker';
import { arbitrateWithStrategy } from '@/background/modules/rules/shadow-arbitration';
import { isTracked, recordObservedFire, recordReportedFire } from '@/background/modules/tab-telemetry';
import {
  __resetFireRecorderForTests,
  dropResponseGatedCandidates,
  dropResponseGatedTab,
  judgeResponseGatedCandidates,
  recordFiresForObservation,
  recordFiresForReport,
} from '@/background/rule-engine-driver/fire-recorder';

const mockEffectiveUids = getEffectiveFireUids as ReturnType<typeof vi.fn>;
const mockIsDelayRedelivery = isDelayRedelivery as ReturnType<typeof vi.fn>;
const mockMatch = matchRulesToRequest as ReturnType<typeof vi.fn>;
const mockGateApprove = doesResponseHeaderGateApprove as ReturnType<typeof vi.fn>;
const mockArbitrate = arbitrateWithStrategy as ReturnType<typeof vi.fn>;
const mockIsTracked = isTracked as ReturnType<typeof vi.fn>;
const mockRecord = recordObservedFire as ReturnType<typeof vi.fn>;
const mockRecordReported = recordReportedFire as ReturnType<typeof vi.fn>;

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
  __resetFireRecorderForTests();
  mockEffectiveUids.mockReturnValue(null);
  mockMatch.mockReturnValue([]);
  mockGateApprove.mockReturnValue(false);
  mockArbitrate.mockImplementation((matches: unknown[]) => matches);
  mockIsTracked.mockReturnValue(true);
  mockIsDelayRedelivery.mockReturnValue(false);
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

  it('never records observed fires for ws/sse rules — the wrapper relay is their only fire source', () => {
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'ws' }),
      makeMatch('bb222222', { type: 'sse' }),
      makeMatch('cc333333', { type: 'header' }),
    ]);

    recordFiresForObservation(INPUT);

    // ws/sse still reach arbitration (they can be shadowed parties) but
    // never claim an observed fire off the stream request itself.
    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual([
      'aa111111',
      'bb222222',
      'cc333333',
    ]);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('cc333333');
  });

  it('never records observed fires for content-gated rules — the wrapper decides per operation', () => {
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'response', contentGated: true }),
      makeMatch('bb222222', { type: 'response' }),
    ]);

    recordFiresForObservation(INPUT);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('bb222222');
  });

  it('content-gated rules never enter arbitration — a declined filter cannot shadow', () => {
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'response', contentGated: true }),
      makeMatch('bb222222', { type: 'request-body' }),
    ]);

    recordFiresForObservation(INPUT);

    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['bb222222']);
  });

  it('delay never claims observed fires off sub-resources — frames are its only DNR plane', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'delay' }), makeMatch('bb222222', { type: 'header' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'xmlhttprequest' });
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('bb222222');

    vi.clearAllMocks();
    mockIsDelayRedelivery.mockReturnValue(false);
    mockIsTracked.mockReturnValue(true);
    mockEffectiveUids.mockReturnValue(null);
    mockArbitrate.mockImplementation((matches: unknown[]) => matches);
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'delay' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'sub_frame' });
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('aa111111');
  });

  it('inject never claims observed fires off sub-resources — the frameId-0 commit is its only act', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'inject' }), makeMatch('bb222222', { type: 'header' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'script' });

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('bb222222');
  });

  it('inject main-frame observations record with commitGated meta', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'inject' }), makeMatch('bb222222', { type: 'header' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'main_frame' });

    expect(mockRecord).toHaveBeenCalledTimes(2);
    expect(mockRecord.mock.calls[0]?.[5]).toMatchObject({ commitGated: true });
    expect(mockRecord.mock.calls[1]?.[5]).toMatchObject({ commitGated: false });
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

  it('skips sub-frame delay.html redeliveries — same logical navigation, already attributed', () => {
    mockIsDelayRedelivery.mockReturnValue(true);
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'delay' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'sub_frame' });

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('main-frame redeliveries still attribute — the first observation never commits', () => {
    mockIsDelayRedelivery.mockReturnValue(true);
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'delay' })]);

    recordFiresForObservation({ ...INPUT, resourceType: 'main_frame' });

    expect(mockRecord).toHaveBeenCalledTimes(1);
  });
});

describe('fire-recorder — reported (wrapper) fires', () => {
  const URL = 'https://api.openheaders.io/x';

  it("annotates the reported fire with the reporting rule's arbitration verdict", () => {
    const shadowedBy = { uid: 'bb222222', name: 'Rule bb222222', kind: 'mock-intercept' as const };
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'request-body' }),
      makeMatch('bb222222', { type: 'response' }),
    ]);
    mockArbitrate.mockImplementation((matches: MatchingRule[]) =>
      matches.map((m) => (m.uid === 'aa111111' ? { ...m, shadowedBy } : m)),
    );

    recordFiresForReport(1, 'aa111111', URL, 100);

    expect(mockRecordReported).toHaveBeenCalledWith(1, 'aa111111', URL, 100, shadowedBy);
  });

  it('passes no annotation when the reporting rule is unshadowed', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'response' })]);

    recordFiresForReport(1, 'aa111111', URL, 100);

    expect(mockRecordReported).toHaveBeenCalledWith(1, 'aa111111', URL, 100, undefined);
  });

  it('never gates the fire — an untracked tab still forwards, without arbitration', () => {
    mockIsTracked.mockReturnValue(false);

    recordFiresForReport(1, 'aa111111', URL, 100);

    expect(mockMatch).not.toHaveBeenCalled();
    expect(mockRecordReported).toHaveBeenCalledWith(1, 'aa111111', URL, 100, undefined);
  });

  it('arbitration only sees live matches — a dead mock cannot moot a wrapper fire', () => {
    mockEffectiveUids.mockReturnValue(new Set(['aa111111']));
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'request-body' }),
      makeMatch('bb222222', { type: 'response' }),
    ]);

    recordFiresForReport(1, 'aa111111', URL, 100);

    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['aa111111']);
    expect(mockRecordReported).toHaveBeenCalledWith(1, 'aa111111', URL, 100, undefined);
  });
});

describe('fire-recorder — response-gated deferred judgment', () => {
  const HEADERS = [{ name: 'X-OH-Echo', value: 'true' }];

  it('response-gated rules never claim fires nor enter arbitration at observation time', () => {
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'block', responseGated: true }),
      makeMatch('bb222222', { type: 'header' }),
    ]);

    recordFiresForObservation(INPUT);

    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['bb222222']);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('bb222222');
  });

  it('an approved candidate records at judgment with the ORIGINAL observation timestamp', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);
    expect(mockRecord).not.toHaveBeenCalled();

    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockGateApprove).toHaveBeenCalledWith('aa111111', HEADERS);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(
      1,
      'aa111111',
      'https://api.openheaders.io/x',
      'req-1',
      100,
      expect.objectContaining({ pattern: '*://*.openheaders.io/*' }),
    );
  });

  it('an unapproved candidate is dropped — no fire, ever', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);

    mockGateApprove.mockReturnValue(false);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
    // The park was consumed — a second judgment finds nothing.
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('judgment re-runs the match live — a rule gone from the pool never records', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);

    mockMatch.mockReturnValue([]);
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('judgment respects the effective-uid gate at the header moment', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);

    mockEffectiveUids.mockReturnValue(new Set());
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('arbitration at approval pools the approved rule with the never-gated actors, recording only the approved', () => {
    const gated = makeMatch('aa111111', { type: 'block', responseGated: true });
    const plain = makeMatch('bb222222', { type: 'header' });
    mockMatch.mockReturnValue([gated, plain]);
    recordFiresForObservation(INPUT);
    vi.mocked(mockArbitrate).mockClear();
    vi.mocked(mockRecord).mockClear();

    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['aa111111', 'bb222222']);
    // The plain rule already recorded at observation time — only the
    // approved gated rule records here.
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[1]).toBe('aa111111');
  });

  it('a content-gated rule with a response-header condition still never records off observations', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'response', responseGated: true, contentGated: true })]);
    recordFiresForObservation(INPUT);

    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('an approved main-frame candidate keeps main_frame routing meta', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation({ ...INPUT, resourceType: 'main_frame' });

    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[5]).toMatchObject({ resourceType: 'main_frame' });
  });

  it('a redirect hop re-observation replaces the parked candidate — the last hop judges', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);
    recordFiresForObservation({ ...INPUT, url: 'https://api.openheaders.io/ro', timestampMs: 200 });

    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[2]).toBe('https://api.openheaders.io/ro');
    expect(mockRecord.mock.calls[0]?.[4]).toBe(200);
  });

  it('dropResponseGatedCandidates clears the park (failed request → gate never judged)', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);

    dropResponseGatedCandidates(1, 'req-1');
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('dropResponseGatedTab clears every park for the tab and only that tab', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);
    recordFiresForObservation({ ...INPUT, tabId: 2, requestId: 'req-2' });

    dropResponseGatedTab(1);
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);
    expect(mockRecord).not.toHaveBeenCalled();

    judgeResponseGatedCandidates(2, 'req-2', HEADERS);
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0]?.[0]).toBe(2);
  });

  it('judgment on an untracked tab consumes the park without recording', () => {
    mockMatch.mockReturnValue([makeMatch('aa111111', { type: 'block', responseGated: true })]);
    recordFiresForObservation(INPUT);

    mockIsTracked.mockReturnValue(false);
    mockGateApprove.mockReturnValue(true);
    judgeResponseGatedCandidates(1, 'req-1', HEADERS);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('a response-gated rule other than the reporter never shadows a wrapper report', () => {
    mockMatch.mockReturnValue([
      makeMatch('aa111111', { type: 'request-body' }),
      makeMatch('bb222222', { type: 'block', responseGated: true }),
    ]);

    recordFiresForReport(1, 'aa111111', 'https://api.openheaders.io/x', 100);

    expect((mockArbitrate.mock.calls[0]?.[0] as MatchingRule[]).map((m) => m.uid)).toEqual(['aa111111']);
  });
});
