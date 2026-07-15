/**
 * Product-telemetry controller — owns a host's single `TelemetryClient`
 * (TELEMETRY_PLAN.md §7) behind injected seams so the whole gate matrix
 * (enabled toggle, once-per-session `session_start`) is unit-testable
 * without any platform API. Exactly one instance lives
 * per host process (extension SW / desktop main); UI surfaces never
 * construct one — they reach it over the `productTelemetry*` RPCs.
 *
 * "Product telemetry" everywhere: plain "telemetry" in this codebase
 * already means the per-tab traffic telemetry the inspector shows.
 *
 * Session semantics are the host's to define through the injected
 * session store. The extension service worker is evicted many times per
 * browser session, so it persists the id and the session_start-sent
 * latch in `chrome.storage.session` (RAM only, cleared at browser
 * exit) — a session means one browser launch, not one SW wake. A
 * persistent process (desktop main) is its own session and uses the
 * in-memory store.
 */

import type { ProductTelemetrySnapshot } from '../protocol/channels/product-telemetry';
import type { TelemetryTransport } from './client';
import { TelemetryClient } from './client';
import type { TelemetryEvent } from './vocabulary';

/**
 * Per-session state; RAM-backed on every host, never written to disk.
 * The keyed latch carries every once-per-session fact: the
 * `session_start` sent-bit plus the per-member dedupe for
 * `feature_used` and `error_beacon` (first occurrence per session
 * counts; repeats are non-events, not suppressed entries).
 */
export interface ProductTelemetrySessionStore {
  getSessionId(): Promise<string | null>;
  setSessionId(id: string): Promise<void>;
  wasLatched(key: string): Promise<boolean>;
  latch(key: string): Promise<void>;
}

/** Latch key for the once-per-session `session_start` sent-bit. */
export const SESSION_START_LATCH_KEY = 'session_start';

/**
 * Latch key for events that fire once per session per union member
 * (`feature_used` per feature, `error_beacon` per code); null for
 * events that count every occurrence.
 */
export function oncePerSessionLatchKey(event: TelemetryEvent): string | null {
  if (event.name === 'feature_used') return `feature_used:${event.feature}`;
  if (event.name === 'error_beacon') return `error_beacon:${event.code}`;
  return null;
}

/** Session store for hosts whose process lifetime IS the session (desktop main). */
export function createInMemoryProductTelemetrySessionStore(): ProductTelemetrySessionStore {
  let sessionId: string | null = null;
  const latched = new Set<string>();
  return {
    getSessionId: async () => sessionId,
    setSessionId: async (id) => {
      sessionId = id;
    },
    wasLatched: async (key) => latched.has(key),
    latch: async (key) => {
      latched.add(key);
    },
  };
}

export interface ProductTelemetryControllerDeps {
  transport: TelemetryTransport;
  now(): number;
  sessionStore: ProductTelemetrySessionStore;
  /** Current `telemetry.enabled` setting value. */
  getEnabled(): boolean;
  /** Subscribe to `telemetry.enabled` changes. */
  subscribeEnabled(fn: () => void): void;
  /**
   * Build this host's `session_start` event, or null when the running
   * platform has no vocabulary member (we skip the event rather than
   * misreport — the allowlist grows by design discussion, not mapping).
   */
  buildSessionStart(): Promise<TelemetryEvent | null>;
}

export class ProductTelemetryController {
  private readonly deps: ProductTelemetryControllerDeps;
  private client: TelemetryClient | null = null;
  private ready: Promise<void> | null = null;

  constructor(deps: ProductTelemetryControllerDeps) {
    this.deps = deps;
  }

  /** Idempotent boot: resolve the session id, build the client, wire the enabled gate. */
  init(): Promise<void> {
    this.ready ??= this.boot();
    return this.ready;
  }

  private async boot(): Promise<void> {
    let sessionId = await this.deps.sessionStore.getSessionId();
    const client = sessionId
      ? new TelemetryClient({ transport: this.deps.transport, now: this.deps.now, sessionId })
      : new TelemetryClient({ transport: this.deps.transport, now: this.deps.now });
    if (!sessionId) {
      sessionId = client.sessionId;
      await this.deps.sessionStore.setSessionId(sessionId);
    }
    this.client = client;

    client.setEnabled(this.deps.getEnabled());
    this.deps.subscribeEnabled(() => client.setEnabled(this.deps.getEnabled()));

    await this.ensureSessionStart();
  }

  /** Fire `session_start` once per session. */
  private async ensureSessionStart(): Promise<void> {
    if (!this.client) return;
    if (await this.deps.sessionStore.wasLatched(SESSION_START_LATCH_KEY)) return;
    const event = await this.deps.buildSessionStart();
    await this.deps.sessionStore.latch(SESSION_START_LATCH_KEY);
    if (event) this.client.track(event);
  }

  /**
   * Record one vocabulary event. Once-per-session events
   * (`feature_used`, `error_beacon`) dedupe through the session-store
   * latch — the first occurrence per member latches regardless of the
   * gates (a suppressed first use is still the first use), and repeats
   * never reach the client or its log.
   */
  async track(event: TelemetryEvent): Promise<void> {
    await this.init();
    const latchKey = oncePerSessionLatchKey(event);
    if (latchKey) {
      if (await this.deps.sessionStore.wasLatched(latchKey)) return;
      await this.deps.sessionStore.latch(latchKey);
    }
    this.client?.track(event);
  }

  async flush(): Promise<void> {
    await this.init();
    await this.client?.flush();
  }

  async snapshot(): Promise<ProductTelemetrySnapshot> {
    await this.init();
    const client = this.client;
    if (!client) return { sessionId: '', enabled: false, entries: [] };
    return {
      sessionId: client.sessionId,
      enabled: client.isEnabled,
      entries: client.readEventLog().map((entry) => ({ ...entry })),
    };
  }
}
