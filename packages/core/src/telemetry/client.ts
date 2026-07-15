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
 * Two latches gate sending — the first-run disclosure and the enabled
 * toggle — but the session log keeps recording would-be events while the
 * channel is off: the telemetry inspector (§6) reads it byte-for-byte.
 */

import type { TelemetryEnvelope, TelemetryEvent } from './vocabulary';
import { TELEMETRY_SCHEMA_VERSION } from './vocabulary';

export interface TelemetryTransport {
  /**
   * Deliver one envelope. Resolve `false` or throw to signal failure —
   * both are silent; the batch rides the next flush.
   */
  send(envelope: TelemetryEnvelope): Promise<boolean>;
}

export interface TelemetryClientDeps {
  transport: TelemetryTransport;
  /** Wall clock (ms since epoch), injected so hosts and tests own time. */
  now(): number;
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
  /** Never queued: channel disabled or first-run disclosure not yet shown. */
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

export class TelemetryClient {
  readonly sessionId: string;

  private readonly deps: TelemetryClientDeps;
  private enabled = true;
  private disclosed = false;
  private queue: TelemetryLogEntry[] = [];
  private log: TelemetryLogEntry[] = [];
  private flushing = false;

  constructor(deps: TelemetryClientDeps) {
    this.deps = deps;
    this.sessionId = mintTelemetrySessionId();
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isDisclosed(): boolean {
    return this.disclosed;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  /**
   * The host reports that the first-run disclosure has been shown (this
   * launch or a previous one). Until then nothing is ever queued or sent.
   */
  noteDisclosureShown(): void {
    this.disclosed = true;
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
   * only when the channel is disclosed and enabled. Never throws.
   */
  track(event: TelemetryEvent): void {
    const entry: TelemetryLogEntry = {
      event,
      at: this.deps.now(),
      disposition: this.enabled && this.disclosed ? 'pending' : 'suppressed',
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
    if (this.flushing || !this.enabled || !this.disclosed || this.queue.length === 0) return false;
    this.flushing = true;
    const batch = this.queue;
    this.queue = [];
    try {
      const envelope: TelemetryEnvelope = {
        schemaVersion: TELEMETRY_SCHEMA_VERSION,
        sessionId: this.sessionId,
        sentAt: this.deps.now(),
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
