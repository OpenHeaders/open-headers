import { describe, expect, it } from 'vitest';
import {
  createInMemoryProductTelemetryInstallStore,
  createInMemoryProductTelemetrySessionStore,
  createInMemoryProductTelemetryStateStore,
  oncePerSessionLatchKey,
  type PersistedTelemetryQueueEntry,
  ProductTelemetryController,
  type ProductTelemetryControllerDeps,
  type ProductTelemetryHostReadings,
  type ProductTelemetryInstallStore,
  type ProductTelemetrySessionStore,
  type ProductTelemetryStateStore,
  SESSION_START_LATCH_KEY,
  type TelemetryEnvelope,
  type TelemetryEnvelopeFacts,
  type TelemetryEvent,
  type TelemetryInstallContext,
  type TelemetryQueueStore,
  type TelemetryState,
} from '../../src/telemetry';

// The current client shape: per-process facts ride the envelope and the
// measurements ride the state block, so the event is bare.
const SESSION_START: TelemetryEvent = { name: 'session_start' };

/** A configured, solo, local install — what most of the fleet reads. */
const READINGS: ProductTelemetryHostReadings = { rules: 3, requests: 0, workspaces: 1, sync: 'local', plan: 'free' };

const DAY = 24 * 60 * 60 * 1000;

/** The state block of the last envelope sent. */
const stateOf = (envelope: TelemetryEnvelope): TelemetryState | null =>
  envelope.schemaVersion === 3 ? envelope.state : null;

const FACTS: TelemetryEnvelopeFacts = {
  channel: 'chrome-store',
  appVersion: { year: 2026, month: 7, patch: 0 },
  locale: 'en',
  platform: 'mac',
  browser: 'chrome',
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

const INSTALL: TelemetryInstallContext = {
  installId: 'feedface00feedface00feedface0000',
  installedAt: 1_760_000_000_000,
};

interface RigOptions {
  enabled?: boolean;
  sessionId?: string;
  startedAt?: number | null;
  latched?: string[];
  latchDay?: number | null;
  sessionStart?: TelemetryEvent | null;
  /** Preseeded by default so session-focused tests carry no first_run noise; null = fresh install. */
  install?: TelemetryInstallContext | null;
  installStore?: ProductTelemetryInstallStore;
  queueStore?: TelemetryQueueStore;
  readings?: ProductTelemetryHostReadings;
  stateStore?: ProductTelemetryStateStore;
}

function makeRig(options: RigOptions = {}) {
  const sent: TelemetryEnvelope[] = [];
  const gates = { enabled: options.enabled ?? true };
  const listeners = { enabled: [] as Array<() => void> };
  const clock = { now: 1_760_000_000_000 };
  const { store, state } = makeSessionStore(options);
  const installStore =
    options.installStore ??
    createInMemoryProductTelemetryInstallStore(options.install === undefined ? INSTALL : options.install);
  const stateStore = options.stateStore ?? createInMemoryProductTelemetryStateStore();
  const readings = { current: options.readings ?? READINGS };

  const deps: ProductTelemetryControllerDeps = {
    transport: {
      async send(envelope) {
        sent.push(envelope);
        return true;
      },
    },
    now: () => clock.now,
    sessionStore: store,
    installStore,
    stateStore,
    queueStore: options.queueStore,
    host: 'extension',
    facts: () => FACTS,
    readHostState: () => readings.current,
    getEnabled: () => gates.enabled,
    subscribeEnabled: (fn) => listeners.enabled.push(fn),
    buildSessionStart: async () => (options.sessionStart === undefined ? SESSION_START : options.sessionStart),
  };

  const controller = new ProductTelemetryController(deps);
  const setEnabled = (value: boolean): void => {
    gates.enabled = value;
    for (const fn of listeners.enabled) fn();
  };
  return { controller, sent, state, setEnabled, installStore, stateStore, clock, readings };
}

describe('ProductTelemetryController — session identity', () => {
  it('reuses the browser-session id from the session store', async () => {
    const injected = 'deadbeefdeadbeefdeadbeefdeadbeef';
    const { controller, sent } = makeRig({ sessionId: injected });
    await controller.init();
    await controller.flush();
    expect(sent[0].sessionId).toBe(injected);
  });

  it('mints and persists an id to the session store when none exists', async () => {
    const { controller, state } = makeRig();
    await controller.init();
    expect(state.sessionId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('mints and persists the session start time at boot, and stamps the envelope sessionAge', async () => {
    const { controller, sent, state, clock } = makeRig();
    await controller.init();
    expect(state.startedAt).toBe(clock.now);
    await controller.flush();
    expect(sent[0].sessionAge).toBe('0-9m');
  });

  it('keeps the persisted session start across SW wakes — sessionAge reflects the true session, not the wake', async () => {
    const twoHours = 2 * 60 * 60 * 1000;
    const { controller, sent, state, clock } = makeRig({
      sessionId: 'deadbeefdeadbeefdeadbeefdeadbeef',
      startedAt: 1_760_000_000_000 - twoHours,
      latched: [],
    });
    await controller.init();
    expect(state.startedAt).toBe(1_760_000_000_000 - twoHours);
    clock.now += 1000;
    await controller.track({ name: 'workflow_run', ok: true });
    await controller.flush();
    const last = sent[sent.length - 1];
    expect(last.sessionAge).toBe('1-8h');
  });
});

describe('ProductTelemetryController — session_start', () => {
  it('fires once per browser session at boot', async () => {
    const { controller, sent, state } = makeRig();
    await controller.init();
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([SESSION_START]);
    expect(state.latched.has(SESSION_START_LATCH_KEY)).toBe(true);
  });

  it('does not fire again on a later SW wake within the same browser session', async () => {
    const first = makeRig();
    await first.controller.init();
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    // A fresh controller with the same session store = SW eviction + wake.
    const second = makeRig({
      sessionId: first.state.sessionId ?? '',
      latched: [...first.state.latched],
    });
    await second.controller.init();
    await second.controller.flush();
    expect(second.sent).toEqual([]);
  });

  it('skips the event on platforms outside the vocabulary but still latches the session', async () => {
    const { controller, sent, state } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.flush();
    expect(sent).toEqual([]);
    expect(state.latched.has(SESSION_START_LATCH_KEY)).toBe(true);
  });

  it('counts a session enabled mid-way from the moment of consent, exactly once', async () => {
    const { controller, sent, setEnabled } = makeRig({ enabled: false });
    await controller.init();
    await controller.flush();
    expect(sent).toEqual([]);

    setEnabled(true);
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([SESSION_START]);
    // The boot logged the suppressed record; the consent re-fire is a second entry.
    expect((await controller.snapshot()).entries.map((entry) => entry.disposition)).toEqual(['suppressed', 'sent']);

    setEnabled(false);
    setEnabled(true);
    await controller.flush();
    expect(sent).toHaveLength(1);
  });

  it('never re-fires session_start on toggle cycles after an enabled boot already counted it', async () => {
    const { controller, sent, setEnabled } = makeRig();
    await controller.init();
    await controller.flush();
    expect(sent).toHaveLength(1);

    setEnabled(false);
    setEnabled(true);
    await controller.flush();
    expect(sent).toHaveLength(1);
  });

  it('logs one suppressed session_start per disabled session, not one per SW wake, and lets a later enabled wake count it', async () => {
    const first = makeRig({ enabled: false });
    await first.controller.init();
    expect((await first.controller.snapshot()).entries.map((entry) => entry.disposition)).toEqual(['suppressed']);

    // Still-disabled wake: no second suppressed record.
    const second = makeRig({
      enabled: false,
      sessionId: first.state.sessionId ?? '',
      latched: [...first.state.latched],
    });
    await second.controller.init();
    expect((await second.controller.snapshot()).entries).toEqual([]);

    // The user enabled while the SW was dead: the next wake counts the session.
    const third = makeRig({
      sessionId: second.state.sessionId ?? '',
      latched: [...second.state.latched],
    });
    await third.controller.init();
    await third.controller.flush();
    expect(third.sent).toHaveLength(1);
    expect(third.sent[0].events).toEqual([SESSION_START]);
  });
});

describe('ProductTelemetryController — durable queue restore at boot', () => {
  it('delivers a queue persisted by a previous process life ahead of new events', async () => {
    const persisted: PersistedTelemetryQueueEntry[] = [
      { event: { name: 'feature_used', feature: 'vault' }, at: 1_760_000_000_000 },
    ];
    const state = { entries: persisted as PersistedTelemetryQueueEntry[] | null };
    const queueStore: TelemetryQueueStore = {
      load: async () => state.entries,
      save: async (entries) => {
        state.entries = [...entries];
      },
    };
    const { controller, sent } = makeRig({ queueStore });
    await controller.init();
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([{ name: 'feature_used', feature: 'vault' }, SESSION_START]);
    expect(state.entries).toEqual([]);
  });
});

describe('ProductTelemetryController — once-per-session dedupe', () => {
  it('sends feature_used once per feature per session and keeps repeats out of the log', async () => {
    const { controller, sent } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.track({ name: 'feature_used', feature: 'variables' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'feature_used', feature: 'vault' },
      { name: 'feature_used', feature: 'variables' },
    ]);
    const snapshot = await controller.snapshot();
    expect(snapshot.entries).toHaveLength(2);
  });

  it('sends error_beacon once per code per session', async () => {
    const { controller, sent } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'error_beacon', code: 'source-refresh-failed' });
    await controller.track({ name: 'error_beacon', code: 'source-refresh-failed' });
    await controller.track({ name: 'error_beacon', code: 'ws-connect-failed' });
    await controller.flush();
    expect(sent[0].events).toEqual([
      { name: 'error_beacon', code: 'source-refresh-failed' },
      { name: 'error_beacon', code: 'ws-connect-failed' },
    ]);
  });

  it('dedupes across SW wakes through the shared session store', async () => {
    const first = makeRig({ sessionStart: null });
    await first.controller.init();
    await first.controller.track({ name: 'feature_used', feature: 'import-hub' });
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    const second = makeRig({
      sessionStart: null,
      sessionId: first.state.sessionId ?? '',
      latched: [...first.state.latched],
    });
    await second.controller.init();
    await second.controller.track({ name: 'feature_used', feature: 'import-hub' });
    await second.controller.flush();
    expect(second.sent).toEqual([]);
  });

  it('latches a while-disabled first use permanently and counts every workflow_run', async () => {
    const { controller, sent, setEnabled } = makeRig({ enabled: false, sessionStart: null });
    await controller.init();
    await controller.track({ name: 'feature_used', feature: 'vault' });
    setEnabled(true);
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.track({ name: 'workflow_run', ok: true });
    await controller.track({ name: 'workflow_run', ok: false });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'workflow_run', ok: true },
      { name: 'milestone', kind: 'first_workflow_run' },
      { name: 'workflow_run', ok: false },
    ]);
  });
});

describe('oncePerSessionLatchKey', () => {
  it('keys feature_used, error_beacon, rule_matched, upgrade_cta_shown, mcp_client_connected and viewport_seen per member, everything else null', () => {
    expect(oncePerSessionLatchKey({ name: 'feature_used', feature: 'vault' })).toBe('feature_used:vault');
    expect(oncePerSessionLatchKey({ name: 'error_beacon', code: 'sync-push-failed' })).toBe(
      'error_beacon:sync-push-failed',
    );
    expect(oncePerSessionLatchKey({ name: 'rule_matched', ruleType: 'response' })).toBe('rule_matched:response');
    expect(oncePerSessionLatchKey({ name: 'upgrade_cta_shown', surface: 'license-pane' })).toBe(
      'upgrade_cta_shown:license-pane',
    );
    expect(oncePerSessionLatchKey({ name: 'mcp_client_connected', client: 'claude-code' })).toBe(
      'mcp_client_connected:claude-code',
    );
    expect(oncePerSessionLatchKey({ name: 'viewport_seen', surface: 'workbench', width: 1280, height: 800 })).toBe(
      'viewport_seen:workbench',
    );
    expect(oncePerSessionLatchKey({ name: 'workflow_run', ok: true })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'rule_created', ruleType: 'header' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'import_run', source: 'curl', ok: true })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'upgrade_cta_clicked', surface: 'license-pane' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'paywall_hit', surface: 'seat-gate' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'license_activated', plan: 'team' })).toBeNull();
    expect(oncePerSessionLatchKey(SESSION_START)).toBeNull();
  });

  it('dedupes rule_matched per rule type through the controller latch', async () => {
    const { controller, sent } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'rule_matched', ruleType: 'header' });
    await controller.track({ name: 'rule_matched', ruleType: 'header' });
    await controller.track({ name: 'rule_matched', ruleType: 'block' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'rule_matched', ruleType: 'header' },
      { name: 'milestone', kind: 'first_rule_matched' },
      { name: 'rule_matched', ruleType: 'block' },
    ]);
  });

  it('dedupes upgrade_cta_shown per surface while clicks and paywall hits count every occurrence', async () => {
    const { controller, sent } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'upgrade_cta_shown', surface: 'license-pane' });
    await controller.track({ name: 'upgrade_cta_shown', surface: 'license-pane' });
    await controller.track({ name: 'upgrade_cta_shown', surface: 'seat-gate' });
    await controller.track({ name: 'upgrade_cta_clicked', surface: 'license-pane' });
    await controller.track({ name: 'upgrade_cta_clicked', surface: 'license-pane' });
    await controller.track({ name: 'paywall_hit', surface: 'seat-gate' });
    await controller.track({ name: 'paywall_hit', surface: 'seat-gate' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'upgrade_cta_shown', surface: 'license-pane' },
      { name: 'upgrade_cta_shown', surface: 'seat-gate' },
      { name: 'upgrade_cta_clicked', surface: 'license-pane' },
      { name: 'upgrade_cta_clicked', surface: 'license-pane' },
      { name: 'paywall_hit', surface: 'seat-gate' },
      { name: 'paywall_hit', surface: 'seat-gate' },
    ]);
  });

  it('dedupes mcp_client_connected per client through the controller latch', async () => {
    const { controller, sent } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'mcp_client_connected', client: 'claude-code' });
    await controller.track({ name: 'mcp_client_connected', client: 'claude-code' });
    await controller.track({ name: 'mcp_client_connected', client: 'cursor' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'mcp_client_connected', client: 'claude-code' },
      { name: 'milestone', kind: 'first_mcp_client' },
      { name: 'mcp_client_connected', client: 'cursor' },
    ]);
  });
});

describe('ProductTelemetryController — gates', () => {
  it('applies the enabled setting at boot and live on change', async () => {
    const { controller, sent, setEnabled } = makeRig({ enabled: false, sessionStart: null });
    await controller.init();
    await controller.track({ name: 'workflow_run', ok: true });
    await controller.flush();
    expect(sent).toEqual([]);

    setEnabled(true);
    await controller.track({ name: 'error_beacon', code: 'sync-push-failed' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([{ name: 'error_beacon', code: 'sync-push-failed' }]);
  });

  it('records suppressed would-be events in the snapshot while disabled', async () => {
    const { controller, setEnabled } = makeRig({ sessionStart: null });
    await controller.init();
    setEnabled(false);
    await controller.track({ name: 'feature_used', feature: 'vault' });
    const snapshot = await controller.snapshot();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].disposition).toBe('suppressed');
    expect(snapshot.sessionId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('ProductTelemetryController — install identity lifecycle', () => {
  it('mints an install record at first enabled boot and announces first_run before session_start', async () => {
    const { controller, sent, installStore } = makeRig({ install: null });
    await controller.init();
    await controller.flush();
    const record = await installStore.getRecord();
    expect(record?.installId).toMatch(/^[0-9a-f]{32}$/);
    expect(sent).toHaveLength(1);
    expect(sent[0].installId).toBe(record?.installId);
    expect(sent[0].sinceInstall).toBe('0');
    expect(sent[0].host).toBe('extension');
    expect(sent[0].channel).toBe('chrome-store');
    expect(sent[0].events).toEqual([{ name: 'first_run' }, SESSION_START]);
  });

  it('does not re-announce first_run for an existing install', async () => {
    const { controller, sent } = makeRig();
    await controller.init();
    await controller.flush();
    expect(sent[0].installId).toBe(INSTALL.installId);
    expect(sent[0].events).toEqual([SESSION_START]);
  });

  it('wipes the identity on toggle-off and mints a fresh one on re-enable, without a second first_run', async () => {
    const { controller, sent, setEnabled, installStore } = makeRig({ sessionStart: null });
    await controller.init();
    setEnabled(false);
    await controller.flush();
    expect(await installStore.getRecord()).toBeNull();
    expect((await controller.snapshot()).installId).toBeNull();

    setEnabled(true);
    await controller.track({ name: 'workflow_run', ok: true });
    await controller.flush();
    const reminted = await installStore.getRecord();
    expect(reminted?.installId).toMatch(/^[0-9a-f]{32}$/);
    expect(reminted?.installId).not.toBe(INSTALL.installId);
    expect(sent).toHaveLength(1);
    expect(sent[0].installId).toBe(reminted?.installId);
    expect(sent[0].events).toEqual([
      { name: 'workflow_run', ok: true },
      { name: 'milestone', kind: 'first_workflow_run' },
    ]);
  });

  it('wipes a leftover record when booting with the toggle already off', async () => {
    const { controller, installStore } = makeRig({ enabled: false, sessionStart: null });
    await controller.init();
    expect(await installStore.getRecord()).toBeNull();
  });

  it('exposes the install id in the snapshot while enabled', async () => {
    const { controller } = makeRig({ sessionStart: null });
    await controller.init();
    expect((await controller.snapshot()).installId).toBe(INSTALL.installId);
  });

  it('notifies onIdentityChanged at boot and on toggle transitions', async () => {
    const seen: Array<string | null> = [];
    const gates = { enabled: true };
    const listeners: Array<() => void> = [];
    const controller = new ProductTelemetryController({
      transport: { send: async () => true },
      now: () => 1_760_000_000_000,
      sessionStore: makeSessionStore().store,
      installStore: createInMemoryProductTelemetryInstallStore(INSTALL),
      host: 'extension',
      facts: () => FACTS,
      readHostState: () => READINGS,
      getEnabled: () => gates.enabled,
      subscribeEnabled: (fn) => listeners.push(fn),
      buildSessionStart: async () => null,
      onIdentityChanged: (id) => seen.push(id),
    });
    await controller.init();
    expect(seen).toEqual([INSTALL.installId]);

    gates.enabled = false;
    for (const fn of listeners) fn();
    await controller.snapshot();
    expect(seen).toEqual([INSTALL.installId, null]);

    gates.enabled = true;
    for (const fn of listeners) fn();
    await controller.snapshot();
    expect(seen).toHaveLength(3);
    expect(seen[2]).toMatch(/^[0-9a-f]{32}$/);
    expect(seen[2]).not.toBe(INSTALL.installId);
  });
});

describe('ProductTelemetryController — daily latch re-arm', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('re-fires session_start and re-arms the feature latches when a later UTC day is reached', async () => {
    const { controller, sent, clock } = makeRig();
    await controller.init();
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([SESSION_START, { name: 'feature_used', feature: 'vault' }]);

    clock.now += DAY;
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].events).toEqual([SESSION_START, { name: 'feature_used', feature: 'vault' }]);
  });

  it('keeps the session id across the day boundary — the day rolls, the session does not', async () => {
    const { controller, sent, clock } = makeRig();
    await controller.init();
    await controller.flush();
    clock.now += DAY;
    await controller.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].sessionId).toBe(sent[0].sessionId);
  });

  it('does not re-arm within the same UTC day', async () => {
    const { controller, sent, clock } = makeRig();
    await controller.init();
    await controller.flush();
    // Advance to the last millisecond of the same UTC day — the boundary, not a duration, arms the roll.
    clock.now = (Math.floor(clock.now / DAY) + 1) * DAY - 1;
    await controller.flush();
    expect(sent).toHaveLength(1);
  });

  it('re-arms exactly once per day boundary, via flush alone', async () => {
    const { controller, sent, clock } = makeRig();
    await controller.init();
    await controller.flush();
    clock.now += 3 * DAY;
    await controller.flush();
    await controller.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].events).toEqual([SESSION_START]);
  });

  it('re-arms at a wake into a new day through the shared session store (SW eviction across midnight)', async () => {
    const first = makeRig();
    await first.controller.init();
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    const second = makeRig({
      sessionId: first.state.sessionId ?? '',
      latched: [...first.state.latched],
      latchDay: first.state.latchDay,
    });
    second.clock.now += DAY;
    await second.controller.init();
    await second.controller.flush();
    expect(second.sent).toHaveLength(1);
    expect(second.sent[0].events).toEqual([SESSION_START]);
  });

  it('logs a suppressed daily session_start while disabled and never sends', async () => {
    const { controller, sent, clock } = makeRig({ enabled: false });
    await controller.init();
    clock.now += DAY;
    await controller.flush();
    expect(sent).toEqual([]);
    const dispositions = (await controller.snapshot()).entries.map((entry) => entry.disposition);
    expect(dispositions).toEqual(['suppressed', 'suppressed']);
  });
});

describe('createInMemoryProductTelemetrySessionStore', () => {
  it('holds the id and the keyed latches for the process lifetime', async () => {
    const store = createInMemoryProductTelemetrySessionStore();
    expect(await store.getSessionId()).toBeNull();
    expect(await store.wasLatched(SESSION_START_LATCH_KEY)).toBe(false);
    await store.setSessionId('deadbeefdeadbeefdeadbeefdeadbeef');
    await store.latch(SESSION_START_LATCH_KEY);
    await store.latch('feature_used:vault');
    expect(await store.getSessionId()).toBe('deadbeefdeadbeefdeadbeefdeadbeef');
    expect(await store.wasLatched(SESSION_START_LATCH_KEY)).toBe(true);
    expect(await store.wasLatched('feature_used:vault')).toBe(true);
    expect(await store.wasLatched('feature_used:variables')).toBe(false);
  });

  it('holds the session start time for the process lifetime', async () => {
    const store = createInMemoryProductTelemetrySessionStore();
    expect(await store.getStartedAt()).toBeNull();
    await store.setStartedAt(1_760_000_000_000);
    expect(await store.getStartedAt()).toBe(1_760_000_000_000);
  });

  it('stamps the latch day and clears latches without touching id or day', async () => {
    const store = createInMemoryProductTelemetrySessionStore();
    expect(await store.getLatchDay()).toBeNull();
    await store.setSessionId('deadbeefdeadbeefdeadbeefdeadbeef');
    await store.setLatchDay(20_700);
    await store.latch('feature_used:vault');
    await store.clearLatches();
    expect(await store.wasLatched('feature_used:vault')).toBe(false);
    expect(await store.getLatchDay()).toBe(20_700);
    expect(await store.getSessionId()).toBe('deadbeefdeadbeefdeadbeefdeadbeef');
  });
});

describe('ProductTelemetryController — the state block (the v2 plan §3)', () => {
  it('stamps the state derived from the tracker and the host readings on every envelope', async () => {
    const { controller, sent } = makeRig({ install: null });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].schemaVersion).toBe(3);
    expect(stateOf(sent[0])).toEqual({
      stage: 'configured',
      rules: '2-5',
      requests: '0',
      workspaces: '1',
      sync: 'local',
      plan: 'free',
      profile: 'interceptor',
      activeDays: '1',
      migratedFrom: 'none',
    });
  });

  it('reads the host once per flush and re-reads on the next — one snapshot per batch', async () => {
    const { controller, sent, readings } = makeRig({ install: null });
    await controller.flush();
    readings.current = { ...READINGS, rules: 0, requests: 2, role: 'viewer', team: 7 };
    await controller.track({ name: 'feature_used', feature: 'request-editor' });
    await controller.flush();
    expect(stateOf(sent[1])).toMatchObject({
      stage: 'team',
      rules: '0',
      requests: '2-5',
      role: 'viewer',
      team: '6-10',
      profile: 'both',
    });
  });

  it('omits the members a host cannot read', async () => {
    const { controller, sent } = makeRig({ install: null, readings: {} });
    await controller.flush();
    expect(stateOf(sent[0])).toEqual({ stage: 'installed', profile: 'none', activeDays: '1', migratedFrom: 'none' });
  });
});

describe('ProductTelemetryController — milestones', () => {
  it('emits the milestone right behind the first event of its kind, once per install', async () => {
    const { controller, sent } = makeRig({ install: null, readings: {} });
    await controller.track({ name: 'rule_created', ruleType: 'header', origin: 'editor' });
    await controller.track({ name: 'rule_created', ruleType: 'block', origin: 'editor' });
    await controller.track({ name: 'rule_matched', ruleType: 'header' });
    await controller.flush();
    expect(sent[0].events.map((event) => JSON.stringify(event))).toEqual([
      '{"name":"first_run"}',
      '{"name":"session_start"}',
      '{"name":"rule_created","ruleType":"header","origin":"editor"}',
      '{"name":"milestone","kind":"first_rule_created"}',
      '{"name":"rule_created","ruleType":"block","origin":"editor"}',
      '{"name":"rule_matched","ruleType":"header"}',
      '{"name":"milestone","kind":"first_rule_matched"}',
    ]);
    expect(stateOf(sent[0])).toMatchObject({ stage: 'activated', profile: 'interceptor' });
  });

  it('reaches first_import on a successful import only and pins migratedFrom to the first origin', async () => {
    const { controller, sent } = makeRig({ install: null, readings: {} });
    await controller.track({ name: 'import_run', source: 'postman', ok: false });
    await controller.track({ name: 'import_run', source: 'insomnia', ok: true });
    await controller.track({ name: 'import_run', source: 'postman', ok: true });
    await controller.flush();
    const names = sent[0].events.map((event) => (event.name === 'milestone' ? `milestone:${event.kind}` : event.name));
    expect(names.filter((name) => name.startsWith('milestone'))).toEqual(['milestone:first_import']);
    expect(stateOf(sent[0])?.migratedFrom).toBe('insomnia');
  });

  it('reaches first_request_sent from the API client and climbs the ladder to retained on the third active day', async () => {
    const { controller, sent, clock } = makeRig({ install: null, readings: {} });
    await controller.track({ name: 'request_sent', protocol: 'http' });
    await controller.flush();
    expect(stateOf(sent[0])).toMatchObject({ stage: 'activated', profile: 'api-client', activeDays: '1' });
    clock.now += DAY;
    await controller.flush();
    clock.now += DAY;
    await controller.flush();
    expect(stateOf(sent[2])).toMatchObject({ stage: 'retained', activeDays: '2-3' });
  });

  it('reaches first_server_connected from the readings at flush, once', async () => {
    const { controller, sent, readings } = makeRig({ install: null, readings: {} });
    readings.current = { sync: 'server' };
    await controller.flush();
    await controller.track({ name: 'feature_used', feature: 'terminal' });
    await controller.flush();
    const milestones = sent.flatMap((envelope) => envelope.events.filter((event) => event.name === 'milestone'));
    expect(milestones).toEqual([{ name: 'milestone', kind: 'first_server_connected' }]);
  });
});

describe('ProductTelemetryController — seeding the existing fleet (the v2 plan §3)', () => {
  it('seeds the sent-bits from host state without emitting when the install already announced itself', async () => {
    const { controller, sent, stateStore, clock } = makeRig({
      install: { ...INSTALL, installedAt: INSTALL.installedAt - 40 * DAY },
      readings: { rules: 12, requests: 2, workspaces: 2, sync: 'server', plan: 'team', role: 'owner', team: 4 },
    });
    clock.now = INSTALL.installedAt;
    await controller.track({ name: 'rule_created', ruleType: 'header', origin: 'editor' });
    await controller.flush();
    const record = await stateStore.getRecord();
    expect(record?.seeded).toBe(true);
    expect(record?.milestones.sort()).toEqual([
      'first_request_sent',
      'first_rule_created',
      'first_rule_matched',
      'first_server_connected',
      'first_share_sent',
    ]);
    expect(sent[0].events.some((event) => event.name === 'milestone')).toBe(false);
    expect(stateOf(sent[0])).toMatchObject({ stage: 'team', profile: 'both', migratedFrom: 'unknown', team: '2-5' });
  });

  it('seeds configured only on an install younger than the 8-30 bucket, and activated on an older one', async () => {
    const young = makeRig({
      install: { ...INSTALL, installedAt: INSTALL.installedAt - 2 * DAY },
      readings: { rules: 2 },
    });
    await young.controller.flush();
    expect(stateOf(young.sent[0])?.stage).toBe('configured');
    const old = makeRig({
      install: { ...INSTALL, installedAt: INSTALL.installedAt - 31 * DAY },
      readings: { rules: 2 },
    });
    await old.controller.flush();
    expect(stateOf(old.sent[0])?.stage).toBe('activated');
  });

  it('seeds an editor or viewer as a share accepted, and reads a seeded record back on the next boot', async () => {
    const stateStore = createInMemoryProductTelemetryStateStore();
    const first = makeRig({ readings: { role: 'viewer' }, stateStore });
    await first.controller.flush();
    expect((await stateStore.getRecord())?.milestones).toEqual(['first_share_accepted']);
    const second = makeRig({ readings: { rules: 50, role: 'viewer' }, stateStore });
    await second.controller.flush();
    expect((await stateStore.getRecord())?.milestones).toEqual(['first_share_accepted']);
    expect(stateOf(second.sent[0])).toMatchObject({ stage: 'team', role: 'viewer', migratedFrom: 'unknown' });
  });

  it('starts a brand-new install empty: no seeding, migratedFrom none', async () => {
    const { controller, stateStore } = makeRig({ install: null, readings: { rules: 9 } });
    await controller.flush();
    expect(await stateStore.getRecord()).toMatchObject({ seeded: false, milestones: [], migratedFrom: 'none' });
  });

  it('wipes the tracker with the identity on toggle-off and re-seeds on re-enable', async () => {
    const { controller, sent, setEnabled, stateStore } = makeRig({ install: null, readings: { rules: 1 } });
    await controller.track({ name: 'rule_matched', ruleType: 'header' });
    expect((await stateStore.getRecord())?.milestones).toEqual(['first_rule_matched']);
    setEnabled(false);
    await controller.flush();
    expect(await stateStore.getRecord()).toBeNull();
    setEnabled(true);
    await controller.track({ name: 'rule_created', ruleType: 'header', origin: 'editor' });
    await controller.flush();
    expect(await stateStore.getRecord()).toMatchObject({ seeded: true, milestones: ['first_rule_created'] });
    expect(sent.at(-1)?.events.some((event) => event.name === 'milestone')).toBe(false);
  });
});

describe('ProductTelemetryController — once per workspace', () => {
  it('counts share_accepted once per scoped workspace and drops an unscoped call', async () => {
    const { controller, sent } = makeRig({ install: null, readings: {} });
    await controller.track({ name: 'share_accepted', route: 'server' }, { workspaceId: 'ws-a' });
    await controller.track({ name: 'share_accepted', route: 'server' }, { workspaceId: 'ws-a' });
    await controller.track({ name: 'share_accepted', route: 'git' }, { workspaceId: 'ws-b' });
    await controller.track({ name: 'share_accepted', route: 'idp', role: 'viewer' });
    await controller.flush();
    const names = sent[0].events.map((event) =>
      event.name === 'share_accepted'
        ? `accepted:${event.route}`
        : event.name === 'milestone'
          ? `milestone:${event.kind}`
          : event.name,
    );
    expect(names).toEqual([
      'first_run',
      'session_start',
      'accepted:server',
      'milestone:first_share_accepted',
      'accepted:git',
    ]);
    expect(stateOf(sent[0])?.stage).toBe('team');
  });
});
