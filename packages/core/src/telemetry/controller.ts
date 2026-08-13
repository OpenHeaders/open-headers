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
import type {
  TelemetryEnvelopeFacts,
  TelemetryInstallContext,
  TelemetryQueueStore,
  TelemetryTransport,
} from './client';
import { mintTelemetryInstallId, TelemetryClient } from './client';
import type { TelemetryEvent, TelemetryHostKind } from './vocabulary';

/**
 * Per-session state; RAM-backed on every host, never written to disk.
 * The keyed latch carries every once-per-session fact: the
 * `session_start` sent-bit plus the per-member dedupe for
 * `feature_used` and `error_beacon` (first occurrence per session
 * counts; repeats are non-events, not suppressed entries).
 *
 * Latches re-arm daily (plan §3, S15 amendment): the controller stamps
 * the UTC day it last armed them and clears every latch when a track
 * or flush lands on a later day — a browser or tray process that runs
 * for weeks stays a daily active, not a one-day ghost. The session id
 * itself never rolls; a session is still one browser launch / one
 * process.
 */
export interface ProductTelemetrySessionStore {
  getSessionId(): Promise<string | null>;
  setSessionId(id: string): Promise<void>;
  wasLatched(key: string): Promise<boolean>;
  latch(key: string): Promise<void>;
  /** UTC day (days since epoch) the latches were last armed for, or null before the first arm. */
  getLatchDay(): Promise<number | null>;
  setLatchDay(day: number): Promise<void>;
  /** Wipe every latch — the daily re-arm; the session id and latch day are untouched. */
  clearLatches(): Promise<void>;
}

/** UTC-day granularity of the latch re-arm (plan §3, S15 amendment). */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Latch key marking that `session_start` fired (queued or suppressed) this session. */
export const SESSION_START_LATCH_KEY = 'session_start';

/**
 * Latch key marking that this session's `session_start` was queued while
 * the channel was ENABLED — the session is counted. Kept separate from
 * the fired-latch so an off→on transition mid-session can re-fire the
 * event (consent counts the session from that moment), while a session
 * is still never counted twice.
 */
export const SESSION_START_SENT_LATCH_KEY = 'session_start:sent';

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
 * (`feature_used` per feature, `error_beacon` per code, `rule_matched`
 * per rule type); null for events that count every occurrence.
 */
export function oncePerSessionLatchKey(event: TelemetryEvent): string | null {
  if (event.name === 'feature_used') return `feature_used:${event.feature}`;
  if (event.name === 'error_beacon') return `error_beacon:${event.code}`;
  if (event.name === 'rule_matched') return `rule_matched:${event.ruleType}`;
  return null;
}

/** Session store for hosts whose process lifetime IS the session (desktop main). */
export function createInMemoryProductTelemetrySessionStore(): ProductTelemetrySessionStore {
  let sessionId: string | null = null;
  let latchDay: number | null = null;
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
    getLatchDay: async () => latchDay,
    setLatchDay: async (day) => {
      latchDay = day;
    },
    clearLatches: async () => {
      latched.clear();
    },
  };
}

export interface ProductTelemetryControllerDeps {
  transport: TelemetryTransport;
  now(): number;
  sessionStore: ProductTelemetrySessionStore;
  installStore: ProductTelemetryInstallStore;
  /** Durable pending-queue home for evictable hosts (see `TelemetryQueueStore`); omitted = RAM-only queue. */
  queueStore?: TelemetryQueueStore;
  /** The surface this controller runs in — stamped on every envelope the client flushes. */
  host: TelemetryHostKind;
  /** Per-process envelope facts (channel, version, locale, platform, browser), read at flush time. */
  facts(): TelemetryEnvelopeFacts | Promise<TelemetryEnvelopeFacts>;
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
  /**
   * Observe identity changes (boot, toggle transitions) with the
   * current install id — null while the channel is off. The extension
   * keeps its uninstall URL in step through this; other hosts omit it.
   */
  onIdentityChanged?(installId: string | null): void;
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
    const baseDeps = {
      transport: this.deps.transport,
      host: this.deps.host,
      facts: this.deps.facts,
      now: this.deps.now,
      install: () => this.installContext,
      queueStore: this.deps.queueStore,
    };
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
    // Rehydrate pending events a previous process life persisted but
    // never delivered (extension SW eviction) — after the enabled gate
    // so an off boot surfaces them suppressed and wipes the store.
    await client.restoreQueue();
    // Transitions serialize on one chain; every entry point awaits it
    // (`settled`), so identity work never races a track or flush.
    this.deps.subscribeEnabled(() => {
      this.gateWork = this.gateWork.then(() => this.onEnabledChange());
    });
    this.deps.onIdentityChanged?.(this.installContext?.installId ?? null);

    await this.rollLatchDay();
    await this.ensureSessionStart();
  }

  private async settled(): Promise<void> {
    await this.init();
    await this.gateWork;
  }

  /**
   * Re-arm the once-per-session latches when a later UTC day is
   * reached (plan §3, S15 amendment): without this, a browser or tray
   * process alive for weeks would report nothing after its first day —
   * actives and retention would systematically undercount long-lived
   * sessions. Clearing includes the `session_start` latches, so the
   * day's first activity re-fires it through the same gates as boot
   * (and re-reads the scale buckets — a daily growth snapshot). The
   * session id never rolls here.
   */
  private async rollLatchDay(): Promise<void> {
    const day = Math.floor(this.deps.now() / DAY_MS);
    const current = await this.deps.sessionStore.getLatchDay();
    if (current === day) return;
    await this.deps.sessionStore.setLatchDay(day);
    if (current === null) return;
    await this.deps.sessionStore.clearLatches();
    await this.ensureSessionStart();
  }

  /** Serialize a rollover check on the gate chain so it never races a toggle transition or another entry point. */
  private rolloverSettled(): Promise<void> {
    this.gateWork = this.gateWork.then(() => this.rollLatchDay());
    return this.gateWork;
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
      // A session enabled mid-way is counted from the moment of
      // consent: re-fire session_start if this session's only ever
      // fired suppressed (the sent-latch keeps it at most once).
      await this.ensureSessionStart();
    } else {
      this.installContext = null;
      await this.deps.installStore.clearRecord();
    }
    this.deps.onIdentityChanged?.(this.installContext?.installId ?? null);
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
      // The distribution channel rides the envelope facts, not the event.
      this.client?.track({ name: 'first_run' });
    }
  }

  /**
   * Fire `session_start` once per session — and count it at most once.
   * The fired-latch dedupes the suppressed record a disabled boot logs
   * (one per session, not one per SW wake); the sent-latch is only set
   * when the event queues while enabled (or the platform has no
   * vocabulary member and never will), so an off→on transition
   * mid-session gets exactly one retry that actually counts.
   */
  private async ensureSessionStart(): Promise<void> {
    const client = this.client;
    if (!client) return;
    if (await this.deps.sessionStore.wasLatched(SESSION_START_SENT_LATCH_KEY)) return;
    const firedBefore = await this.deps.sessionStore.wasLatched(SESSION_START_LATCH_KEY);
    if (firedBefore && !client.isEnabled) return;
    if (!firedBefore) await this.deps.sessionStore.latch(SESSION_START_LATCH_KEY);
    const event = await this.deps.buildSessionStart();
    if (!event || client.isEnabled) await this.deps.sessionStore.latch(SESSION_START_SENT_LATCH_KEY);
    if (event) client.track(event);
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
    await this.rolloverSettled();
    const latchKey = oncePerSessionLatchKey(event);
    if (latchKey) {
      if (await this.deps.sessionStore.wasLatched(latchKey)) return;
      await this.deps.sessionStore.latch(latchKey);
    }
    this.client?.track(event);
  }

  async flush(): Promise<void> {
    await this.settled();
    await this.rolloverSettled();
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
