import { describe, expect, it } from 'vitest';
import {
  createInMemoryProductTelemetrySessionStore,
  ProductTelemetryController,
  type ProductTelemetryControllerDeps,
  type ProductTelemetrySessionStore,
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

function makeSessionStore(initial: Partial<{ sessionId: string; sessionStartSent: boolean }> = {}) {
  const state = { sessionId: initial.sessionId ?? null, sessionStartSent: initial.sessionStartSent ?? false };
  const store: ProductTelemetrySessionStore = {
    getSessionId: async () => state.sessionId,
    setSessionId: async (id) => {
      state.sessionId = id;
    },
    wasSessionStartSent: async () => state.sessionStartSent,
    markSessionStartSent: async () => {
      state.sessionStartSent = true;
    },
  };
  return { store, state };
}

interface RigOptions {
  enabled?: boolean;
  disclosed?: boolean;
  sessionId?: string;
  sessionStartSent?: boolean;
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
    expect(state.sessionStartSent).toBe(true);
  });

  it('does not fire again on a later SW wake within the same browser session', async () => {
    const first = makeRig({ disclosed: true });
    await first.controller.init();
    await first.controller.flush();
    expect(first.sent).toHaveLength(1);

    // A fresh controller with the same session store = SW eviction + wake.
    const second = makeRig({ disclosed: true, sessionId: first.state.sessionId ?? '', sessionStartSent: true });
    await second.controller.init();
    await second.controller.flush();
    expect(second.sent).toEqual([]);
  });

  it('skips the event on platforms outside the vocabulary but still latches the session', async () => {
    const { controller, sent, state } = makeRig({ disclosed: true, sessionStart: null });
    await controller.init();
    await controller.flush();
    expect(sent).toEqual([]);
    expect(state.sessionStartSent).toBe(true);
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
  it('holds the id and the session_start latch for the process lifetime', async () => {
    const store = createInMemoryProductTelemetrySessionStore();
    expect(await store.getSessionId()).toBeNull();
    expect(await store.wasSessionStartSent()).toBe(false);
    await store.setSessionId('deadbeefdeadbeefdeadbeefdeadbeef');
    await store.markSessionStartSent();
    expect(await store.getSessionId()).toBe('deadbeefdeadbeefdeadbeefdeadbeef');
    expect(await store.wasSessionStartSent()).toBe(true);
  });
});
