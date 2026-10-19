import { describe, expect, it } from 'vitest';
import {
  ERROR_REPORT_MAX_PER_DAY,
  type ErrorReport,
  ErrorReportController,
  type ErrorReportControllerDeps,
  type ErrorReportEnvelope,
  errorReportLatchKey,
  type ProductTelemetrySessionStore,
  type TelemetryEnvelopeFacts,
} from '../../src/telemetry';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_760_000_000_000;
const SESSION_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';
const FACTS: TelemetryEnvelopeFacts = {
  channel: 'github-release',
  appVersion: { year: 2026, month: 10, patch: 2 },
  locale: 'en',
  platform: 'mac',
};

function makeSessionStore(
  initial: Partial<{ sessionId: string; startedAt: number | null; latched: string[]; latchDay: number | null }> = {},
) {
  const state = {
    sessionId: initial.sessionId ?? null,
    startedAt: initial.startedAt ?? null,
    latched: new Set<string>(initial.latched ?? []),
    latchDay: initial.latchDay ?? null,
  };
  const store: ProductTelemetrySessionStore = {
    getSessionId: async () => state.sessionId,
    setSessionId: async (id) => {
      state.sessionId = id;
    },
    getStartedAt: async () => state.startedAt,
    setStartedAt: async (at) => {
      state.startedAt = at;
    },
    wasLatched: async (key) => state.latched.has(key),
    latch: async (key) => {
      state.latched.add(key);
    },
    getLatchDay: async () => state.latchDay,
    setLatchDay: async (day) => {
      state.latchDay = day;
    },
    clearLatches: async () => {
      state.latched.clear();
    },
  };
  return { store, state };
}

function makeReport(overrides: Partial<ErrorReport> = {}): ErrorReport {
  return {
    kind: 'uncaught-exception',
    process: 'main',
    errorName: 'TypeError',
    template: 'not-a-function',
    frames: [{ file: 'main.js', line: 1, col: 1 }],
    fingerprint: '0123456789abcdef',
    count: 1,
    ...overrides,
  };
}

function fingerprint(n: number): string {
  return n.toString(16).padStart(16, '0');
}

function makeRig(
  overrides: Partial<{
    enabled: boolean;
    sessionStore: ReturnType<typeof makeSessionStore>;
    accept: boolean;
  }> = {},
) {
  const session = overrides.sessionStore ?? makeSessionStore({ sessionId: SESSION_ID, startedAt: NOW });
  const sent: ErrorReportEnvelope[] = [];
  let enabled = overrides.enabled ?? true;
  const listeners: Array<() => void> = [];
  const clock = { now: NOW };
  const deps: ErrorReportControllerDeps = {
    transport: {
      send: async (envelope) => {
        sent.push(envelope);
        return overrides.accept ?? true;
      },
    },
    now: () => clock.now,
    sessionStore: session.store,
    host: 'desktop',
    facts: () => FACTS,
    getEnabled: () => enabled,
    subscribeEnabled: (fn) => {
      listeners.push(fn);
    },
  };
  const controller = new ErrorReportController(deps);
  const setEnabled = (next: boolean) => {
    enabled = next;
    for (const fn of listeners) fn();
  };
  return { controller, session, sent, clock, setEnabled };
}

describe('ErrorReportController — boot', () => {
  it('reuses the shared session id and start time when the usage channel minted them', async () => {
    const { controller, session } = makeRig();
    const snapshot = await controller.snapshot();
    expect(snapshot).toEqual({ sessionId: SESSION_ID, enabled: true, entries: [] });
    expect(session.state.sessionId).toBe(SESSION_ID);
    expect(session.state.startedAt).toBe(NOW);
  });

  it('mints the session when it boots first, in the shared store, so the usage channel reuses it', async () => {
    const { controller, session } = makeRig({ sessionStore: makeSessionStore() });
    const snapshot = await controller.snapshot();
    expect(snapshot.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(session.state.sessionId).toBe(snapshot.sessionId);
    expect(session.state.startedAt).toBe(NOW);
  });

  it('never touches the latch day — that roll is the usage controller’s', async () => {
    const { controller, session } = makeRig();
    await controller.report(makeReport());
    await controller.flush();
    expect(session.state.latchDay).toBeNull();
  });
});

describe('ErrorReportController — dedupe (law 7)', () => {
  it('queues a first report, folds a repeat while pending, sends one with the count', async () => {
    const { controller, sent } = makeRig();
    expect(await controller.report(makeReport())).toBe('pending');
    expect(await controller.report(makeReport())).toBe('pending');
    expect(await controller.report(makeReport())).toBe('pending');
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].reports).toEqual([makeReport({ count: 3 })]);
    const { entries } = await controller.snapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ disposition: 'sent', report: { count: 3 } });
  });

  it('latches a sent fingerprint for the UTC day and suppresses later repeats', async () => {
    const { controller, session, sent, clock } = makeRig();
    await controller.report(makeReport());
    await controller.flush();
    const day = Math.floor(NOW / DAY_MS);
    expect(session.state.latched.has(errorReportLatchKey('0123456789abcdef', day))).toBe(true);
    expect(await controller.report(makeReport())).toBe('suppressed');
    await controller.flush();
    expect(sent).toHaveLength(1);
    const { entries } = await controller.snapshot();
    expect(entries.map((e) => e.disposition)).toEqual(['sent', 'suppressed']);

    clock.now = NOW + DAY_MS;
    expect(await controller.report(makeReport())).toBe('pending');
    await controller.flush();
    expect(sent).toHaveLength(2);
  });

  it('does not latch a refused batch — the report rides the next flush and latches then', async () => {
    const { controller, session } = makeRig({ accept: false });
    await controller.report(makeReport());
    await controller.flush();
    expect(session.state.latched.size).toBe(0);
    expect(await controller.report(makeReport())).toBe('pending');
  });

  it('a different fingerprint is its own report in the same envelope', async () => {
    const { controller, sent } = makeRig();
    await controller.report(makeReport());
    await controller.report(makeReport({ fingerprint: fingerprint(2) }));
    await controller.flush();
    expect(sent[0].reports.map((r) => r.fingerprint)).toEqual(['0123456789abcdef', fingerprint(2)]);
  });
});

describe('ErrorReportController — caps (law 7)', () => {
  it('admits twenty new fingerprints per UTC day, drops the twenty-first, and re-arms on the next day', async () => {
    const { controller, clock } = makeRig();
    for (let i = 0; i < ERROR_REPORT_MAX_PER_DAY; i++) {
      expect(await controller.report(makeReport({ fingerprint: fingerprint(i) }))).toBe('pending');
    }
    expect(await controller.report(makeReport({ fingerprint: fingerprint(99) }))).toBe('dropped');
    // A repeat of a pending fingerprint still folds under the cap.
    expect(await controller.report(makeReport({ fingerprint: fingerprint(0) }))).toBe('pending');
    clock.now = NOW + DAY_MS;
    expect(await controller.report(makeReport({ fingerprint: fingerprint(99) }))).toBe('pending');
    const { entries } = await controller.snapshot();
    expect(entries.filter((e) => e.disposition === 'dropped')).toHaveLength(1);
  });

  it('counts only admissions — suppressed reports while off leave the day’s budget alone', async () => {
    const { controller, setEnabled } = makeRig({ enabled: false });
    for (let i = 0; i < ERROR_REPORT_MAX_PER_DAY + 5; i++) {
      expect(await controller.report(makeReport({ fingerprint: fingerprint(i) }))).toBe('suppressed');
    }
    setEnabled(true);
    expect(await controller.report(makeReport({ fingerprint: fingerprint(100) }))).toBe('pending');
  });
});

describe('ErrorReportController — the enabled gate', () => {
  it('boots off when the setting is off: reports log suppressed and nothing flushes', async () => {
    const { controller, sent } = makeRig({ enabled: false });
    expect(await controller.report(makeReport())).toBe('suppressed');
    await controller.flush();
    expect(sent).toEqual([]);
    expect((await controller.snapshot()).enabled).toBe(false);
  });

  it('follows the setting both ways: off holds the pending queue unsent, on delivers it and admits again', async () => {
    const { controller, sent, setEnabled } = makeRig();
    await controller.report(makeReport());
    setEnabled(false);
    await controller.flush();
    expect(sent).toEqual([]);
    expect((await controller.snapshot()).entries[0].disposition).toBe('pending');
    // A repeat while off is not recorded — not even folded into the held report.
    expect(await controller.report(makeReport())).toBe('suppressed');
    setEnabled(true);
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].reports[0].count).toBe(1);
    expect((await controller.snapshot()).entries.map((e) => e.disposition)).toEqual(['sent', 'suppressed']);
    expect(await controller.report(makeReport({ fingerprint: fingerprint(1) }))).toBe('pending');
  });
});
