/**
 * Error-report controller — owns a host's single `ErrorReportClient`
 * behind the `telemetry.errorReports` gate (the error reports plan §4.2
 * law 1: its own switch, default on, no install identity). Exactly one
 * instance lives per host process beside the usage controller; the two
 * SHARE the session store (one session id, one start time) and nothing
 * else — the install store is the usage channel's and never read here.
 *
 * Dedupe (law 7): a group already pending in its process and surface
 * folds in the client; once FLUSHED it latches in the shared session
 * store for the UTC day, and later repeats there are logged
 * `suppressed`. The latch key carries the day, so it expires on its
 * own and this controller never rolls the latch day — that roll is the
 * usage controller's (it re-fires `session_start` on it, and a second
 * roller would steal that). At most twenty new rows are admitted per
 * UTC day; the count is per process life, so an evicted worker re-arms
 * it while the latches — the part that stops a repeat — persist with
 * the session.
 */

import type { TelemetryEnvelopeFacts } from './client';
import { mintTelemetrySessionId } from './client';
import type { ProductTelemetrySessionStore } from './controller';
import {
  ErrorReportClient,
  type ErrorReportGroupFacts,
  type ErrorReportLogEntry,
  type ErrorReportQueueStore,
  type ErrorReportTransport,
  errorReportGroupKey,
} from './error-client';
import { ERROR_REPORT_MAX_PER_DAY, type ErrorReport } from './error-vocabulary';
import type { TelemetryHostKind } from './vocabulary';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Latch key for a group sent from a process and surface on a UTC day (days since epoch); day-keyed, so no clear is ever needed. */
export function errorReportLatchKey(report: ErrorReportGroupFacts, day: number): string {
  return `error_report:${day}:${errorReportGroupKey(report)}`;
}

export interface ErrorReportControllerDeps {
  transport: ErrorReportTransport;
  now(): number;
  /** The usage channel's session store — the shared session id, start time and latches. */
  sessionStore: ProductTelemetrySessionStore;
  queueStore?: ErrorReportQueueStore;
  host: TelemetryHostKind;
  facts(): TelemetryEnvelopeFacts | Promise<TelemetryEnvelopeFacts>;
  /** Current `telemetry.errorReports` setting value. */
  getEnabled(): boolean;
  /** Subscribe to `telemetry.errorReports` changes. */
  subscribeEnabled(fn: () => void): void;
}

/** What the inspector's "Error reports" section reads — every report, sent or not, byte for byte. */
export interface ErrorReportSnapshot {
  sessionId: string;
  enabled: boolean;
  entries: ErrorReportLogEntry[];
}

export class ErrorReportController {
  private readonly deps: ErrorReportControllerDeps;
  private client: ErrorReportClient | null = null;
  private ready: Promise<void> | null = null;
  private admitted = { day: -1, count: 0 };

  constructor(deps: ErrorReportControllerDeps) {
    this.deps = deps;
  }

  /** Idempotent boot: resolve the shared session, build the client, wire the enabled gate. */
  init(): Promise<void> {
    this.ready ??= this.boot();
    return this.ready;
  }

  private async boot(): Promise<void> {
    // Whichever controller boots first mints the session; hosts init
    // the two in sequence, never concurrently, so one id results.
    let sessionId = await this.deps.sessionStore.getSessionId();
    if (!sessionId) {
      sessionId = mintTelemetrySessionId();
      await this.deps.sessionStore.setSessionId(sessionId);
    }
    let startedAt = await this.deps.sessionStore.getStartedAt();
    if (startedAt === null) {
      startedAt = this.deps.now();
      await this.deps.sessionStore.setStartedAt(startedAt);
    }
    const client = new ErrorReportClient({
      transport: this.deps.transport,
      host: this.deps.host,
      facts: this.deps.facts,
      now: this.deps.now,
      sessionId,
      sessionStartedAt: startedAt,
      queueStore: this.deps.queueStore,
    });
    this.client = client;
    client.setEnabled(this.deps.getEnabled());
    await client.restoreQueue();
    this.deps.subscribeEnabled(() => {
      client.setEnabled(this.deps.getEnabled());
    });
  }

  private day(): number {
    return Math.floor(this.deps.now() / DAY_MS);
  }

  /**
   * Record one report: a group sent today from the same process and
   * surface is suppressed, one already pending there folds, the
   * twenty-first new row of the day is dropped, the rest reach the
   * client. Resolves the disposition the log shows for it.
   */
  async report(report: ErrorReport): Promise<ErrorReportLogEntry['disposition']> {
    await this.init();
    const client = this.client;
    if (!client) return 'suppressed';
    const day = this.day();
    if (await this.deps.sessionStore.wasLatched(errorReportLatchKey(report, day))) {
      return client.refuse(report, 'suppressed');
    }
    if (client.hasPending(report)) return client.report(report);
    if (this.admitted.day !== day) this.admitted = { day, count: 0 };
    if (client.isEnabled && this.admitted.count >= ERROR_REPORT_MAX_PER_DAY) return client.refuse(report, 'dropped');
    const disposition = client.report(report);
    if (disposition === 'pending') this.admitted.count += 1;
    return disposition;
  }

  /** Flush, then latch every row the transport accepted for the UTC day it went out. */
  async flush(): Promise<void> {
    await this.init();
    const client = this.client;
    if (!client) return;
    const sent = await client.flush();
    if (sent.length === 0) return;
    const day = this.day();
    for (const report of sent) await this.deps.sessionStore.latch(errorReportLatchKey(report, day));
  }

  async snapshot(): Promise<ErrorReportSnapshot> {
    await this.init();
    const client = this.client;
    if (!client) return { sessionId: '', enabled: false, entries: [] };
    return { sessionId: client.sessionId, enabled: client.isEnabled, entries: [...client.readLog()] };
  }
}
