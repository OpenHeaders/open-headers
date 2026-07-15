import { describe, expect, it } from 'vitest';
import {
  createInMemoryProductTelemetrySessionStore,
  oncePerSessionLatchKey,
  ProductTelemetryController,
  type ProductTelemetryControllerDeps,
  type ProductTelemetrySessionStore,
  SESSION_START_LATCH_KEY,
  type TelemetryEnvelope,
  type TelemetryEvent,
} from '../../src/telemetry';

const SESSION_START: TelemetryEvent = {
  name: 'session_start',
  host: 'extension',
  appVersion: { year: 2026, month: 7, patch: 0 },
  platform: 'mac',
  browser: 'chrome',
  locale: 'en',
};

function makeSessionStore(initial: Partial<{ sessionId: string; latched: string[] }> = {}) {
  const state = { sessionId: initial.sessionId ?? null, latched: new Set<string>(initial.latched ?? []) };
  const store: ProductTelemetrySessionStore = {
    getSessionId: async () => state.sessionId,
    setSessionId: async (id) => {
      state.sessionId = id;
    },
    wasLatched: async (key) => state.latched.has(key),
    latch: async (key) => {
      state.latched.add(key);
    },
  };
  return { store, state };
}

interface RigOptions {
  enabled?: boolean;
  disclosed?: boolean;
  sessionId?: string;
  latched?: string[];
  sessionStart?: TelemetryEvent | null;
}

function makeRig(options: RigOptions = {}) {
  const sent: TelemetryEnvelope[] = [];
  const gates = { enabled: options.enabled ?? true, disclosed: options.disclosed ?? false };
  const listeners = { enabled: [] as Array<() => void>, disclosed: [] as Array<() => void> };
  const { store, state } = makeSessionStore(options);

  const deps: ProductTelemetryControllerDeps = {
    transport: {
      async send(envelope) {
        sent.push(envelope);
        return true;
      },
    },
    now: () => 1_760_000_000_000,
    sessionStore: store,
    getEnabled: () => gates.enabled,
    subscribeEnabled: (fn) => listeners.enabled.push(fn),
    getDisclosed: async () => gates.disclosed,
    subscribeDisclosed: (fn) => listeners.disclosed.push(fn),
    buildSessionStart: async () => (options.sessionStart === undefined ? SESSION_START : options.sessionStart),
  };

  const controller = new ProductTelemetryController(deps);
  const setEnabled = (value: boolean): void => {
    gates.enabled = value;
    for (const fn of listeners.enabled) fn();
  };
  const setDisclosed = async (value: boolean): Promise<void> => {
    gates.disclosed = value;
    for (const fn of listeners.disclosed) fn();
    // The disclosure subscription re-reads asynchronously; settle it.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { controller, sent, state, setEnabled, setDisclosed };
}

describe('ProductTelemetryController — session identity', () => {
  it('reuses the browser-session id from the session store', async () => {
    const injected = 'deadbeefdeadbeefdeadbeefdeadbeef';
    const { controller, setDisclosed, sent } = makeRig({ sessionId: injected });
    await controller.init();
    await setDisclosed(true);
    await controller.flush();
    expect(sent[0].sessionId).toBe(injected);
  });

  it('mints and persists an id to the session store when none exists', async () => {
    const { controller, state } = makeRig();
    await controller.init();
    expect(state.sessionId).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('ProductTelemetryController — session_start', () => {
  it('fires once per browser session, only after disclosure', async () => {
    const { controller, sent, state, setDisclosed } = makeRig();
    await controller.init();
    await controller.flush();
    expect(sent).toEqual([]);

    await setDisclosed(true);
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([SESSION_START]);
    expect(state.latched.has(SESSION_START_LATCH_KEY)).toBe(true);
  });

  it('does not fire again on a later SW wake within the same browser session', async () => {
    const first = makeRig({ disclosed: true });
    await first.controller.init();
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    // A fresh controller with the same session store = SW eviction + wake.
    const second = makeRig({
      disclosed: true,
      sessionId: first.state.sessionId ?? '',
      latched: [SESSION_START_LATCH_KEY],
    });
    await second.controller.init();
    await second.controller.flush();
    expect(second.sent).toEqual([]);
  });

  it('skips the event on platforms outside the vocabulary but still latches the session', async () => {
    const { controller, sent, state } = makeRig({ disclosed: true, sessionStart: null });
    await controller.init();
    await controller.flush();
    expect(sent).toEqual([]);
    expect(state.latched.has(SESSION_START_LATCH_KEY)).toBe(true);
  });
});

describe('ProductTelemetryController — once-per-session dedupe', () => {
  it('sends feature_used once per feature per session and keeps repeats out of the log', async () => {
    const { controller, sent, setDisclosed } = makeRig({ sessionStart: null });
    await controller.init();
    await setDisclosed(true);
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
    const { controller, sent, setDisclosed } = makeRig({ sessionStart: null });
    await controller.init();
    await setDisclosed(true);
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
    const first = makeRig({ disclosed: true, sessionStart: null });
    await first.controller.init();
    await first.controller.track({ name: 'feature_used', feature: 'import-hub' });
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    const second = makeRig({
      disclosed: true,
      sessionStart: null,
      sessionId: first.state.sessionId ?? '',
      latched: [...first.state.latched],
    });
    await second.controller.init();
    await second.controller.track({ name: 'feature_used', feature: 'import-hub' });
    await second.controller.flush();
    expect(second.sent).toEqual([]);
  });

  it('latches a pre-disclosure first use permanently and counts every workflow_run', async () => {
    const { controller, sent, setDisclosed } = makeRig({ sessionStart: null });
    await controller.init();
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await setDisclosed(true);
    await controller.track({ name: 'feature_used', feature: 'vault' });
    await controller.track({ name: 'workflow_run', ok: true });
    await controller.track({ name: 'workflow_run', ok: false });
    await controller.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([
      { name: 'workflow_run', ok: true },
      { name: 'workflow_run', ok: false },
    ]);
  });
});

describe('oncePerSessionLatchKey', () => {
  it('keys feature_used and error_beacon per member, everything else null', () => {
    expect(oncePerSessionLatchKey({ name: 'feature_used', feature: 'vault' })).toBe('feature_used:vault');
    expect(oncePerSessionLatchKey({ name: 'error_beacon', code: 'sync-push-failed' })).toBe(
      'error_beacon:sync-push-failed',
    );
    expect(oncePerSessionLatchKey({ name: 'workflow_run', ok: true })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'rule_created', ruleType: 'header' })).toBeNull();
    expect(oncePerSessionLatchKey({ name: 'import_run', source: 'curl', ok: true })).toBeNull();
    expect(oncePerSessionLatchKey(SESSION_START)).toBeNull();
  });
});

describe('ProductTelemetryController — gates', () => {
  it('applies the enabled setting at boot and live on change', async () => {
    const { controller, sent, setEnabled, setDisclosed } = makeRig({ enabled: false, sessionStart: null });
    await controller.init();
    await setDisclosed(true);
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
    const { controller, setDisclosed, setEnabled } = makeRig({ sessionStart: null });
    await controller.init();
    await setDisclosed(true);
    setEnabled(false);
    await controller.track({ name: 'feature_used', feature: 'vault' });
    const snapshot = await controller.snapshot();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.disclosed).toBe(true);
    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0].disposition).toBe('suppressed');
  });

  it('reports the pre-disclosure state in the snapshot', async () => {
    const { controller } = makeRig();
    await controller.track({ name: 'feature_used', feature: 'variables' });
    const snapshot = await controller.snapshot();
    expect(snapshot.disclosed).toBe(false);
    expect(snapshot.entries[0].disposition).toBe('suppressed');
    expect(snapshot.sessionId).toMatch(/^[0-9a-f]{32}$/);
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
});
