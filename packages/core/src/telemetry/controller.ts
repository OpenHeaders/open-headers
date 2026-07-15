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
import type { TelemetryInstallContext, TelemetryTransport } from './client';
import { mintTelemetryInstallId, TelemetryClient } from './client';
import type { TelemetryChannelId, TelemetryEvent } from './vocabulary';

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
 * Durable install identity (plan §4, amended 2026-07-16), host-persisted.
 * Two independent pieces by design: the identity record is wiped whenever
 * the toggle goes off and re-minted fresh on re-enable — opting out
 * forgets you. The `first_run` sent-bit survives the wipe: it is a plain
 * boolean ("this install already announced itself"), carries no identity,
 * and keeps toggle cycles from inflating acquisition counts.
 */
export interface ProductTelemetryInstallStore {
  getRecord(): Promise<TelemetryInstallContext | null>;
  setRecord(record: TelemetryInstallContext): Promise<void>;
  clearRecord(): Promise<void>;
  wasFirstRunSent(): Promise<boolean>;
  markFirstRunSent(): Promise<void>;
}

/** Install store for tests and rigs; real hosts persist (extension `chrome.storage.local`, desktop settings, CLI config). */
export function createInMemoryProductTelemetryInstallStore(
  initial: TelemetryInstallContext | null = null,
): ProductTelemetryInstallStore {
  let record = initial;
  let firstRunSent = initial !== null;
  return {
    getRecord: async () => record,
    setRecord: async (next) => {
      record = next;
    },
    clearRecord: async () => {
      record = null;
    },
    wasFirstRunSent: async () => firstRunSent,
    markFirstRunSent: async () => {
      firstRunSent = true;
    },
  };
}

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
  installStore: ProductTelemetryInstallStore;
  /** This build's distribution channel — a static host fact stamped on `first_run`. */
  channel: TelemetryChannelId;
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
  private installContext: TelemetryInstallContext | null = null;
  private gateWork: Promise<void> = Promise.resolve();

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
    const baseDeps = { transport: this.deps.transport, now: this.deps.now, install: () => this.installContext };
    const client = sessionId ? new TelemetryClient({ ...baseDeps, sessionId }) : new TelemetryClient(baseDeps);
    if (!sessionId) {
      sessionId = client.sessionId;
      await this.deps.sessionStore.setSessionId(sessionId);
    }
    this.client = client;

    const enabled = this.deps.getEnabled();
    client.setEnabled(enabled);
    if (enabled) {
      await this.ensureInstallIdentity();
    } else {
      // Off means no identity: a toggle turned off while this host was
      // not running still wipes the record at the next boot.
      await this.deps.installStore.clearRecord();
    }
    // Transitions serialize on one chain; every entry point awaits it
    // (`settled`), so identity work never races a track or flush.
    this.deps.subscribeEnabled(() => {
      this.gateWork = this.gateWork.then(() => this.onEnabledChange());
    });

    await this.ensureSessionStart();
  }

  private async settled(): Promise<void> {
    await this.init();
    await this.gateWork;
  }

  /**
   * Enabled transitions own the identity lifecycle: off wipes the install
   * record entirely; on re-mints a fresh one. `first_run` never re-fires
   * across toggle cycles — its sent-bit survives the wipe by design.
   */
  private async onEnabledChange(): Promise<void> {
    const enabled = this.deps.getEnabled();
    this.client?.setEnabled(enabled);
    if (enabled) {
      await this.ensureInstallIdentity();
    } else {
      this.installContext = null;
      await this.deps.installStore.clearRecord();
    }
  }

  /** Load-or-mint the install record; announce a first run exactly once per install-store lifetime. */
  private async ensureInstallIdentity(): Promise<void> {
    let record = await this.deps.installStore.getRecord();
    if (!record) {
      record = { installId: mintTelemetryInstallId(), installedAt: this.deps.now() };
      await this.deps.installStore.setRecord(record);
    }
    this.installContext = record;
    if (!(await this.deps.installStore.wasFirstRunSent())) {
      await this.deps.installStore.markFirstRunSent();
      this.client?.track({ name: 'first_run', channel: this.deps.channel });
    }
  }

  /**
   * Manual "reset identifier" (settings affordance): mint a fresh id and
   * install date, keeping the `first_run` sent-bit — a reset is not an
   * acquisition. No-op while the channel is off (there is no identity to
   * reset). Resolves the new id, or null when disabled.
   */
  async resetInstallId(): Promise<string | null> {
    await this.settled();
    if (!this.deps.getEnabled()) return null;
    const record: TelemetryInstallContext = { installId: mintTelemetryInstallId(), installedAt: this.deps.now() };
    await this.deps.installStore.setRecord(record);
    this.installContext = record;
    return record.installId;
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
    await this.settled();
    const latchKey = oncePerSessionLatchKey(event);
    if (latchKey) {
      if (await this.deps.sessionStore.wasLatched(latchKey)) return;
      await this.deps.sessionStore.latch(latchKey);
    }
    this.client?.track(event);
  }

  async flush(): Promise<void> {
    await this.settled();
    await this.client?.flush();
  }

  async snapshot(): Promise<ProductTelemetrySnapshot> {
    await this.settled();
    const client = this.client;
    if (!client) return { sessionId: '', installId: null, enabled: false, entries: [] };
    return {
      sessionId: client.sessionId,
      installId: this.installContext?.installId ?? null,
      enabled: client.isEnabled,
      entries: client.readEventLog().map((entry) => ({ ...entry })),
    };
  }
}
