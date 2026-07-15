/**
 * Telemetry client — typed `track()` + in-memory queue + batched flush
 * behind a transport port (`TELEMETRY_PLAN.md` §7).
 *
 * Core never opens a socket and never owns a timer: hosts inject the
 * transport and drive the flush cadence (interval + best-effort on quit).
 * The extension service worker is evictable, so cadence must live with the
 * host's alarm substrate anyway — same split as the scheduler's timer port.
 *
 * Fire-and-forget: a failed batch silently rides the next flush (no retry
 * loop), the queue is hard-capped, and nothing here throws at a caller.
 * The enabled toggle gates sending, but the session log keeps recording
 * would-be events while the channel is off: the telemetry inspector (§6)
 * reads it byte-for-byte.
 */

import type { TelemetryEnvelope, TelemetryEvent } from './vocabulary';
import { bucketSinceInstall, TELEMETRY_SCHEMA_VERSION } from './vocabulary';

/** The one published ingestion endpoint (`docs/WIRE_TRANSPARENCY.md` §4); hosts' transports POST envelopes here. */
export const PRODUCT_TELEMETRY_ENDPOINT = 'https://telemetry.openheaders.io/v1/events';

/** The uninstall-ping route (§4): the extension's `setUninstallURL` target, carrying only the install id. */
export const PRODUCT_TELEMETRY_UNINSTALL_ENDPOINT = 'https://telemetry.openheaders.io/v1/uninstall';

export interface TelemetryTransport {
  /**
   * Deliver one envelope. Resolve `false` or throw to signal failure —
   * both are silent; the batch rides the next flush.
   */
  send(envelope: TelemetryEnvelope): Promise<boolean>;
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
  /** Wall clock (ms since epoch), injected so hosts and tests own time. */
  now(): number;
  /**
   * Current install identity, read at flush time so a mid-session reset
   * re-stamps the very next envelope. `null` means no identity exists
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
    }
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
    while (this.queue.length > TELEMETRY_MAX_QUEUE) {
      const dropped = this.queue.shift();
      if (dropped) dropped.disposition = 'dropped';
    }
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
      const envelope: TelemetryEnvelope = {
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        sessionId: this.sessionId,
        installId: install.installId,
        sinceInstall: bucketSinceInstall(install.installedAt, sentAt),
        sentAt,
        events: batch.map((entry) => entry.event),
      };
      const accepted = await this.deps.transport.send(envelope);
      if (!accepted) {
        this.requeue(batch);
        return false;
      }
      for (const entry of batch) entry.disposition = 'sent';
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
    while (this.queue.length > TELEMETRY_MAX_QUEUE) {
      const dropped = this.queue.shift();
      if (dropped) dropped.disposition = 'dropped';
    }
  }
}
