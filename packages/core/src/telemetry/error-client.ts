/**
 * Error-report client — the usage client's posture (plan §4.2 law 8) on
 * the report envelope: a RAM queue, an optional durable queue store for
 * the evictable host, the inspector log with dispositions, and a
 * fire-and-forget flush behind a transport port. Core never opens a
 * socket and never owns a timer; the host drives the cadence.
 *
 * What differs from usage (law 7): a report of a fingerprint already
 * pending FOLDS into it — `count` grows, no second entry — and an
 * envelope carries at most ten reports; the rest ride the next flush.
 * A report over the serialized budget is dropped and logged, never
 * truncated. The shipped usage `TelemetryClient` stays as it is.
 */

import type { TelemetryDisposition, TelemetryEnvelopeFacts } from './client';
import { serializedErrorReportBytes } from './error-report';
import {
  ERROR_REPORT_MAX_BYTES,
  ERROR_REPORT_MAX_PER_ENVELOPE,
  ERROR_REPORT_SCHEMA_VERSION,
  type ErrorReport,
  type ErrorReportEnvelope,
} from './error-vocabulary';
import { bucketSessionAge, type TelemetryHostKind } from './vocabulary';

/** The error-report ingestion route (plan §4.1) beside the usage and uninstall routes; hosts' transports POST envelopes here. */
export const PRODUCT_ERROR_REPORTS_ENDPOINT = 'https://telemetry.openheaders.com/v1/errors';

export interface ErrorReportTransport {
  /** Deliver one envelope. Resolve `false` or throw to signal failure — both are silent; the batch rides the next flush. */
  send(envelope: ErrorReportEnvelope): Promise<boolean>;
}

/** One persisted pending report awaiting delivery. */
export interface PersistedErrorReportQueueEntry {
  report: ErrorReport;
  /** ms since epoch at report time, preserved across restores for the inspector log. */
  at: number;
}

/**
 * Durable home for the pending queue on the evictable host — the usage
 * queue store's contract on reports: the full pending set is saved on
 * every mutation and restored at boot, a batch leaves the store only
 * after the transport accepts it, and `load()` returns entries only
 * from the current session.
 */
export interface ErrorReportQueueStore {
  load(): Promise<PersistedErrorReportQueueEntry[] | null>;
  save(entries: ReadonlyArray<PersistedErrorReportQueueEntry>): Promise<void>;
}

export interface ErrorReportClientDeps {
  transport: ErrorReportTransport;
  host: TelemetryHostKind;
  /** Per-process envelope facts, the usage envelope's, read at flush time. */
  facts(): TelemetryEnvelopeFacts | Promise<TelemetryEnvelopeFacts>;
  now(): number;
  /** The SHARED session id (the usage channel's, from the session store) — the one identity a report envelope carries. */
  sessionId: string;
  /** ms since epoch when the shared session began; feeds the envelope `sessionAge` bucket. */
  sessionStartedAt?: number;
  queueStore?: ErrorReportQueueStore;
}

/** Hard cap on undelivered reports awaiting flush; the oldest are dropped first. */
export const ERROR_REPORT_MAX_QUEUE = 50;

/** Hard cap on the session log the inspector reads; the oldest entries are dropped first. */
export const ERROR_REPORT_MAX_LOG = 200;

export interface ErrorReportLogEntry {
  report: ErrorReport;
  /** ms since epoch at report time. */
  at: number;
  disposition: TelemetryDisposition;
}

export class ErrorReportClient {
  readonly sessionId: string;

  private readonly deps: ErrorReportClientDeps;
  private enabled = true;
  private queue: ErrorReportLogEntry[] = [];
  private log: ErrorReportLogEntry[] = [];
  private flushing = false;
  private persistChain: Promise<void> = Promise.resolve();

  constructor(deps: ErrorReportClientDeps) {
    this.deps = deps;
    this.sessionId = deps.sessionId;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  /** The one-switch toggle: off suppresses the pending queue and wipes the store; later reports are logged, never queued. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const entry of this.queue) entry.disposition = 'suppressed';
      this.queue = [];
      this.persistQueue();
    }
  }

  /** Rehydrate the pending queue an earlier process life of this session persisted; no-op without a store, silent on errors. */
  async restoreQueue(): Promise<void> {
    const store = this.deps.queueStore;
    if (!store) return;
    let persisted: PersistedErrorReportQueueEntry[] | null;
    try {
      persisted = await store.load();
    } catch {
      return;
    }
    if (!persisted || persisted.length === 0) return;
    const restored: ErrorReportLogEntry[] = persisted.map((entry) => ({
      report: entry.report,
      at: entry.at,
      disposition: this.enabled ? 'pending' : 'suppressed',
    }));
    this.log = [...restored, ...this.log];
    this.capLog();
    if (this.enabled) {
      this.queue = [...restored, ...this.queue];
      this.capQueue();
    }
    this.persistQueue();
  }

  /** Whether a report of this fingerprint is pending — a repeat folds rather than counting against the daily cap. */
  hasPending(fingerprint: string): boolean {
    return this.queue.some((entry) => entry.report.fingerprint === fingerprint);
  }

  /**
   * Record one report. A pending report of the same fingerprint absorbs
   * it (`count` grows); otherwise it is logged and queued when the
   * channel is enabled, logged `suppressed` when it is off, logged
   * `dropped` when it is over the serialized budget. Never throws.
   */
  report(report: ErrorReport): TelemetryDisposition {
    if (!this.enabled) return this.refuse(report, 'suppressed');
    if (serializedErrorReportBytes(report) > ERROR_REPORT_MAX_BYTES) return this.refuse(report, 'dropped');
    const pending = this.queue.find((entry) => entry.report.fingerprint === report.fingerprint);
    if (pending) {
      pending.report.count += report.count;
      this.persistQueue();
      return 'pending';
    }
    this.queue.push(this.record(report, 'pending'));
    this.capQueue();
    this.persistQueue();
    return 'pending';
  }

  /** Log a report that never queues — latched for the day (`suppressed`) or over the daily cap (`dropped`). */
  refuse(report: ErrorReport, disposition: 'suppressed' | 'dropped'): TelemetryDisposition {
    this.record(report, disposition);
    return disposition;
  }

  private record(report: ErrorReport, disposition: TelemetryDisposition): ErrorReportLogEntry {
    const entry: ErrorReportLogEntry = { report, at: this.deps.now(), disposition };
    this.log.push(entry);
    this.capLog();
    return entry;
  }

  /**
   * Deliver the oldest pending reports — at most ten — as one envelope.
   * Silent on failure (the batch is requeued at the front). Resolves
   * the reports the transport accepted, so the controller can latch
   * their fingerprints; empty when nothing was sent.
   */
  async flush(): Promise<ErrorReport[]> {
    if (this.flushing || !this.enabled || this.queue.length === 0) return [];
    this.flushing = true;
    const batch = this.queue.slice(0, ERROR_REPORT_MAX_PER_ENVELOPE);
    this.queue = this.queue.slice(batch.length);
    try {
      const sentAt = this.deps.now();
      const facts = await this.deps.facts();
      const envelope: ErrorReportEnvelope = {
        schemaVersion: ERROR_REPORT_SCHEMA_VERSION,
        host: this.deps.host,
        channel: facts.channel,
        appVersion: facts.appVersion,
        ...(facts.platform !== undefined ? { platform: facts.platform } : {}),
        ...(facts.arch !== undefined ? { arch: facts.arch } : {}),
        ...(facts.browser !== undefined ? { browser: facts.browser } : {}),
        locale: facts.locale,
        ...(facts.osVersion !== undefined ? { osVersion: facts.osVersion } : {}),
        ...(facts.browserVersion !== undefined ? { browserVersion: facts.browserVersion } : {}),
        sessionId: this.sessionId,
        ...(this.deps.sessionStartedAt !== undefined
          ? { sessionAge: bucketSessionAge(this.deps.sessionStartedAt, sentAt) }
          : {}),
        sentAt,
        reports: batch.map((entry) => entry.report),
      };
      const accepted = await this.deps.transport.send(envelope);
      if (!accepted) {
        this.requeue(batch);
        return [];
      }
      for (const entry of batch) entry.disposition = 'sent';
      // The batch leaves the durable store only now — a process death
      // mid-flight restores and resends it (at-least-once, never lost).
      this.persistQueue();
      return batch.map((entry) => entry.report);
    } catch {
      this.requeue(batch);
      return [];
    } finally {
      this.flushing = false;
    }
  }

  /** Snapshot of the session log (every report, sent or not) for the inspector's "Error reports" section. */
  readLog(): readonly ErrorReportLogEntry[] {
    return this.log.map((entry) => ({ ...entry, report: { ...entry.report } }));
  }

  private requeue(batch: ErrorReportLogEntry[]): void {
    const pending = batch.filter((entry) => entry.disposition === 'pending');
    this.queue = [...pending, ...this.queue];
    this.capQueue();
    this.persistQueue();
  }

  private capQueue(): void {
    while (this.queue.length > ERROR_REPORT_MAX_QUEUE) {
      const dropped = this.queue.shift();
      if (dropped) dropped.disposition = 'dropped';
    }
  }

  private capLog(): void {
    if (this.log.length > ERROR_REPORT_MAX_LOG) this.log.splice(0, this.log.length - ERROR_REPORT_MAX_LOG);
  }

  /** Mirror the pending queue into the durable store, fire-and-forget, serialized on one chain. */
  private persistQueue(): void {
    const store = this.deps.queueStore;
    if (!store) return;
    const entries: PersistedErrorReportQueueEntry[] = this.queue.map((entry) => ({
      report: { ...entry.report },
      at: entry.at,
    }));
    this.persistChain = this.persistChain.then(() => store.save(entries)).catch(() => undefined);
  }
}
