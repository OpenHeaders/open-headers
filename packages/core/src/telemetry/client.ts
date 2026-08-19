/**
 * Telemetry client — typed `track()` + in-memory queue + batched flush
 * behind a transport port (the telemetry plan §7).
 *
 * Core never opens a socket and never owns a timer: hosts inject the
 * transport and drive the flush cadence (interval + best-effort on quit).
 * The extension service worker is evictable, so cadence must live with the
 * host's alarm substrate anyway — same split as the scheduler's timer port.
 *
 * Fire-and-forget: a failed batch silently rides the next flush (no retry
 * loop), the queue is hard-capped, and nothing here throws at a caller.
 * Evictable hosts additionally inject a `TelemetryQueueStore` so pending
 * events survive a process death between track and flush; the queue
 * stays RAM-only everywhere else.
 * The enabled toggle gates sending, but the session log keeps recording
 * would-be events while the channel is off: the telemetry inspector (§6)
 * reads it byte-for-byte.
 */

import type {
  TelemetryAppVersion,
  TelemetryBrowserKind,
  TelemetryChannelId,
  TelemetryEnvelope,
  TelemetryEvent,
  TelemetryHostKind,
  TelemetryLocale,
  TelemetryPlatform,
} from './vocabulary';
import { bucketSessionAge, bucketSinceInstall, TELEMETRY_SCHEMA_VERSION } from './vocabulary';

/** The one published ingestion endpoint (`docs/WIRE_TRANSPARENCY.md` §4); hosts' transports POST envelopes here. */
export const PRODUCT_TELEMETRY_ENDPOINT = 'https://telemetry.openheaders.com/v1/events';

/**
 * The uninstall-ping route (§4): the extension's `setUninstallURL`
 * target. Carries the install id plus two coarse vocabulary facts —
 * `a` (the sinceInstall bucket) and `c` (the distribution channel) —
 * so churn segments by age and acquisition (plan §3, S16). The host
 * re-registers the URL as the age bucket rolls.
 */
export const PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT = 'https://telemetry.openheaders.com/v1/uninstall';

/**
 * Build the uninstall-ping URL for one install identity. Every value is
 * vocabulary-pinned (hex id, closed bucket/channel unions), so plain
 * concatenation is byte-exact against `WIRE_TRANSPARENCY.md` §4.
 */
export function buildTelemetryUninstallUrl(
  install: TelemetryInstallContext,
  channel: TelemetryChannelId,
  now: number,
): string {
  const age = bucketSinceInstall(install.installedAt, now);
  return `${PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT}?i=${install.installId}&a=${encodeURIComponent(age)}&c=${channel}`;
}

export interface TelemetryTransport {
  /**
   * Deliver one envelope. Resolve `false` or throw to signal failure —
   * both are silent; the batch rides the next flush.
   */
  send(envelope: TelemetryEnvelope): Promise<boolean>;
}

/** One persisted pending event awaiting delivery. */
export interface PersistedTelemetryQueueEntry {
  event: TelemetryEvent;
  /** ms since epoch at `track()` time, preserved across restores for the inspector log. */
  at: number;
}

/**
 * Durable home for the pending queue, for hosts whose process can die
 * with events still queued (the extension service worker is evicted
 * after seconds of idle). The client persists the full pending set on
 * every queue mutation and restores it at boot; a batch leaves the
 * store only after the transport accepts it, so delivery is
 * at-least-once. Session scoping is the store's job: `load()` must
 * return entries only when they were saved within the current session,
 * never carrying events across a session boundary.
 */
export interface TelemetryQueueStore {
  /** Pending entries persisted by an earlier process life of the same session, or null. */
  load(): Promise<PersistedTelemetryQueueEntry[] | null>;
  /** Persist the full pending queue. Called with `[]` when the queue drains or the channel turns off — off wipes the store. */
  save(entries: ReadonlyArray<PersistedTelemetryQueueEntry>): Promise<void>;
}

/**
 * Per-process facts stamped on every envelope (plan §3, S15 amendment):
 * Analytics Engine SQL has no joins, so a fact that should segment
 * every stored row — features by platform, errors by version — must
 * ride every row. Read fresh at flush time, so a locale switched
 * mid-session re-stamps the very next envelope.
 */
export interface TelemetryEnvelopeFacts {
  /** This build's distribution channel — a static install fact. */
  channel: TelemetryChannelId;
  /** The host's CalVer version, decomposed into wire integers. */
  appVersion: TelemetryAppVersion;
  /** The resolved interface language (`toTelemetryLocale` of the app locale). */
  locale: TelemetryLocale;
  /** Omitted when the running platform has no vocabulary member. */
  platform?: TelemetryPlatform;
  /** Browser-hosted surfaces only. */
  browser?: TelemetryBrowserKind;
}

/** The durable identity facts an envelope carries (plan §4, amended 2026-07-16). */
export interface TelemetryInstallContext {
  /** 32 lowercase hex chars — random, resettable, deleted on toggle-off. */
  installId: string;
  /** ms since epoch when this install id was minted; feeds the coarse `sinceInstall` bucket. */
  installedAt: number;
}

export interface TelemetryClientDeps {
  transport: TelemetryTransport;
  /** The surface this client runs in — stamped on every envelope. */
  host: TelemetryHostKind;
  /** Per-process envelope facts, read at flush time (see `TelemetryEnvelopeFacts`). */
  facts(): TelemetryEnvelopeFacts | Promise<TelemetryEnvelopeFacts>;
  /** Wall clock (ms since epoch), injected so hosts and tests own time. */
  now(): number;
  /**
   * Current install identity, read at flush time so a mid-session
   * re-mint (toggle off → on) re-stamps the very next envelope. `null` means no identity exists
   * (channel disabled or being wiped) — nothing flushes without one.
   */
  install(): TelemetryInstallContext | null;
  /**
   * Session id override for hosts whose process outlives — or is shorter
   * than — the user-facing session (the extension service worker is
   * evicted many times per browser session, so it holds the id in
   * `chrome.storage.session`: RAM-backed, never on disk, gone at browser
   * exit). Must match `TelemetrySessionIdSchema`; omitted = minted fresh.
   */
  sessionId?: string;
  /**
   * ms since epoch when this session began (plan §3, S17) — persisted
   * beside the session id on evictable hosts, so an evicted-and-rewoken
   * service worker keeps the true session start. Feeds the coarse
   * envelope `sessionAge` bucket at flush time; omitted (pre-S17 rigs
   * only) = the envelope carries no bucket.
   */
  sessionStartedAt?: number;
  /** Durable pending-queue home for evictable hosts; omitted = RAM-only queue. */
  queueStore?: TelemetryQueueStore;
}

/** Hard cap on undelivered events awaiting flush; the oldest are dropped first. */
export const TELEMETRY_MAX_QUEUE = 200;

/** Hard cap on the session log the inspector reads; the oldest entries are dropped first. */
export const TELEMETRY_MAX_LOG = 500;

export type TelemetryDisposition =
  /** Queued, awaiting the next flush. */
  | 'pending'
  /** Delivered in an accepted envelope. */
  | 'sent'
  /** Pushed out of the capped queue before it could be flushed. */
  | 'dropped'
  /** Never queued: channel disabled. */
  | 'suppressed';

export interface TelemetryLogEntry {
  event: TelemetryEvent;
  /** ms since epoch at `track()` time. */
  at: number;
  disposition: TelemetryDisposition;
}

/** 32 lowercase hex chars from 16 CSPRNG bytes — memory-only, never persisted. */
export function mintTelemetrySessionId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Same alphabet and entropy as a session id, but host-persisted: minted at
 * first run, resettable from settings, deleted on toggle-off. Random by
 * law — never derived from hardware, network, or identity (plan §4).
 */
export function mintTelemetryInstallId(): string {
  return mintTelemetrySessionId();
}

export class TelemetryClient {
  readonly sessionId: string;

  private readonly deps: TelemetryClientDeps;
  private enabled = true;
  private queue: TelemetryLogEntry[] = [];
  private log: TelemetryLogEntry[] = [];
  private flushing = false;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(deps: TelemetryClientDeps) {
    this.deps = deps;
    this.sessionId = deps.sessionId ?? mintTelemetrySessionId();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * The one-switch toggle. Turning the channel off kills it completely:
   * the pending queue is suppressed, and later events are logged but
   * never queued.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const entry of this.queue) entry.disposition = 'suppressed';
      this.queue = [];
      this.persistQueue();
    }
  }

  /**
   * Rehydrate the pending queue persisted by an earlier process life of
   * this session (SW eviction survival). Restored entries re-enter the
   * inspector log with their original timestamps and ride the next
   * flush; while the channel is off they surface as suppressed and the
   * store is wiped. No-op without a queue store, silent on store errors.
   */
  async restoreQueue(): Promise<void> {
    const store = this.deps.queueStore;
    if (!store) return;
    let persisted: PersistedTelemetryQueueEntry[] | null;
    try {
      persisted = await store.load();
    } catch {
      return;
    }
    if (!persisted || persisted.length === 0) return;
    const restored: TelemetryLogEntry[] = persisted.map((entry) => ({
      event: entry.event,
      at: entry.at,
      disposition: this.enabled ? 'pending' : 'suppressed',
    }));
    this.log = [...restored, ...this.log];
    if (this.log.length > TELEMETRY_MAX_LOG) this.log.splice(0, this.log.length - TELEMETRY_MAX_LOG);
    if (this.enabled) {
      this.queue = [...restored, ...this.queue];
      this.capQueue();
    }
    this.persistQueue();
  }

  /**
   * Record one event. Always logs for the inspector; queues for delivery
   * only when the channel is enabled. Never throws.
   */
  track(event: TelemetryEvent): void {
    const entry: TelemetryLogEntry = {
      event,
      at: this.deps.now(),
      disposition: this.enabled ? 'pending' : 'suppressed',
    };
    this.log.push(entry);
    if (this.log.length > TELEMETRY_MAX_LOG) this.log.splice(0, this.log.length - TELEMETRY_MAX_LOG);
    if (entry.disposition !== 'pending') return;
    this.queue.push(entry);
    this.capQueue();
    this.persistQueue();
  }

  /**
   * Deliver everything pending as one envelope. Silent on failure — the
   * batch is requeued to ride the next flush. Resolves `true` only when a
   * non-empty batch was accepted by the transport.
   */
  async flush(): Promise<boolean> {
    if (this.flushing || !this.enabled || this.queue.length === 0) return false;
    const install = this.deps.install();
    if (!install) return false;
    this.flushing = true;
    const batch = this.queue;
    this.queue = [];
    try {
      const sentAt = this.deps.now();
      const facts = await this.deps.facts();
      const envelope: TelemetryEnvelope = {
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        host: this.deps.host,
        channel: facts.channel,
        appVersion: facts.appVersion,
        ...(facts.platform !== undefined ? { platform: facts.platform } : {}),
        ...(facts.browser !== undefined ? { browser: facts.browser } : {}),
        locale: facts.locale,
        sessionId: this.sessionId,
        installId: install.installId,
        sinceInstall: bucketSinceInstall(install.installedAt, sentAt),
        ...(this.deps.sessionStartedAt !== undefined
          ? { sessionAge: bucketSessionAge(this.deps.sessionStartedAt, sentAt) }
          : {}),
        sentAt,
        events: batch.map((entry) => entry.event),
      };
      const accepted = await this.deps.transport.send(envelope);
      if (!accepted) {
        this.requeue(batch);
        return false;
      }
      for (const entry of batch) entry.disposition = 'sent';
      // The batch leaves the durable store only now — a process death
      // mid-flight restores and resends it (at-least-once, never lost).
      this.persistQueue();
      return true;
    } catch {
      this.requeue(batch);
      return false;
    } finally {
      this.flushing = false;
    }
  }

  /** Snapshot of the session log (all events, including suppressed) for the telemetry inspector. */
  readEventLog(): readonly TelemetryLogEntry[] {
    return [...this.log];
  }

  private requeue(batch: TelemetryLogEntry[]): void {
    const pending = batch.filter((entry) => entry.disposition === 'pending');
    this.queue = [...pending, ...this.queue];
    this.capQueue();
    this.persistQueue();
  }

  private capQueue(): void {
    while (this.queue.length > TELEMETRY_MAX_QUEUE) {
      const dropped = this.queue.shift();
      if (dropped) dropped.disposition = 'dropped';
    }
  }

  /**
   * Mirror the pending queue into the durable store, fire-and-forget.
   * Snapshots synchronously and serializes writes on one chain, so the
   * store always converges to the latest queue state in call order.
   */
  private persistQueue(): void {
    const store = this.deps.queueStore;
    if (!store) return;
    const entries: PersistedTelemetryQueueEntry[] = this.queue.map((entry) => ({ event: entry.event, at: entry.at }));
    this.persistChain = this.persistChain.then(() => store.save(entries)).catch(() => undefined);
  }
}
