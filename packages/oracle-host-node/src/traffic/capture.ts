/**
 * The capture-session disk sink (AGENT_TRAFFIC_PLAN.md §3, slice S7) —
 * one named session = one append-only JSONL file of REDACTED
 * projections under the host's capture directory.
 *
 * What this module deliberately is NOT:
 *
 *   - **Not a ring subscriber.** The §10 read-model law: nothing
 *     subscribes to the retention ring. The tap calls {@link
 *     TrafficCaptureSession.append} with a snapshot projection it read
 *     synchronously off the consumer's admission/refinement seam — the
 *     sink never sees the ring, the reducer, or a wire frame.
 *   - **Not a raw-record path.** `append` takes
 *     `TrafficRecordProjection` — the redacted boundary shape — so a
 *     session that wrote a secret would be unwritable by construction.
 *     The reveal escalation never reaches it (the tap projects capture
 *     lines without `revealSecrets`, whatever windows are open).
 *
 * File shape (`formatVersion: 1`): one `header` line with the session
 * metadata, then `record` lines folding LAST-WINS by (tabId, requestId)
 * — a record refined after its first append appears again with the
 * refinement applied, so the stream stays append-only and crash-safe —
 * then one `end` trailer naming how and why the session stopped. Writes
 * are synchronous: the append path is already the post-fold seam, the
 * volume is bound-capped, and ordering beats throughput here.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { hostLogger as logger } from '@openheaders/core/logger';
import type {
  TrafficCaptureBounds,
  TrafficCaptureEndReason,
  TrafficCaptureRedactionPolicy,
  TrafficCaptureSessionProjection,
  TrafficRecordProjection,
} from '@openheaders/core/traffic';

const SCOPE = 'TrafficCapture';

export interface TrafficCaptureSessionOptions {
  /** Directory the session file is created in (made on demand). */
  readonly dir: string;
  readonly sessionId: string;
  readonly sourceUid: string;
  readonly sourceLabel: string;
  readonly name: string;
  readonly redaction: TrafficCaptureRedactionPolicy;
  readonly bounds: TrafficCaptureBounds;
  /** Fired after the session stopped ITSELF (bound trip, write error) —
   *  never for an explicit `stop()`. The session is already stopped and
   *  its trailer written when this fires. */
  readonly onAutoStop?: (reason: TrafficCaptureEndReason) => void;
}

export interface TrafficCaptureSession {
  /** Whether the session still accepts appends. */
  readonly active: boolean;
  /**
   * Append one redacted projection line. A line that would cross the
   * byte bound is NOT written — the session stops with `size-bound`
   * instead (a bound trip is a stop, never a silent truncation).
   */
  append(record: TrafficRecordProjection): void;
  /** Stop and write the trailer. Idempotent; later calls are no-ops. */
  stop(reason?: TrafficCaptureEndReason): void;
  projection(): TrafficCaptureSessionProjection;
}

/** `Overnight repro #3` → `overnight-repro-3` (bounded; never empty). */
function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'capture';
}

/** `2026-08-03T10-15-30-123Z-overnight-repro-3-cap1.jsonl` — sortable
 *  stamp first, operator name in the middle, session id as the
 *  collision-proof suffix. */
function sessionFileName(startedAtMs: number, name: string, sessionId: string): string {
  const stamp = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  return `${stamp}-${slugifyName(name)}-${sessionId}.jsonl`;
}

/**
 * Open one capture session: create the directory and file, write the
 * header line. Throws when the file cannot be created — the caller
 * refuses the start rather than running a session that records nothing.
 */
export function startTrafficCaptureSession(options: TrafficCaptureSessionOptions): TrafficCaptureSession {
  const startedAtMs = Date.now();
  const filePath = path.join(options.dir, sessionFileName(startedAtMs, options.name, options.sessionId));
  fs.mkdirSync(options.dir, { recursive: true });
  const fd = fs.openSync(filePath, 'ax');

  let bytesWritten = 0;
  let recordLines = 0;
  let state: 'active' | 'stopped' = 'active';
  let stoppedAtMs: number | undefined;
  let endReason: TrafficCaptureEndReason | undefined;

  function writeLine(line: string): void {
    const buffer = Buffer.from(`${line}\n`, 'utf8');
    fs.writeSync(fd, buffer);
    bytesWritten += buffer.byteLength;
  }

  writeLine(
    JSON.stringify({
      kind: 'header',
      formatVersion: 1,
      sessionId: options.sessionId,
      sourceUid: options.sourceUid,
      sourceLabel: options.sourceLabel,
      name: options.name,
      redaction: options.redaction,
      startedAtMs,
      bounds: options.bounds,
      // Recorded in-band so a reader far from this code folds correctly.
      recordFold: 'last-wins by (tabId, requestId)',
    }),
  );

  function finish(reason: TrafficCaptureEndReason): void {
    if (state === 'stopped') return;
    state = 'stopped';
    stoppedAtMs = Date.now();
    endReason = reason;
    clearTimeout(durationTimer);
    try {
      writeLine(JSON.stringify({ kind: 'end', reason, stoppedAtMs, recordLines, bytesWritten }));
    } catch {
      // The trailer is best-effort on a failing disk — the projection
      // still carries the honest end reason.
    }
    try {
      fs.closeSync(fd);
    } catch {
      // Already closed by the OS on a hard failure; nothing to release.
    }
    logger.info(
      SCOPE,
      `session ${options.sessionId} ended (${reason}) — ${recordLines} records, ${bytesWritten} bytes`,
    );
  }

  const durationTimer = setTimeout(() => {
    finish('duration-bound');
    options.onAutoStop?.('duration-bound');
  }, options.bounds.maxDurationMs);
  durationTimer.unref?.();

  logger.info(SCOPE, `session ${options.sessionId} started for ${options.sourceUid} → ${filePath}`);

  return {
    get active() {
      return state === 'active';
    },
    append(record) {
      if (state === 'stopped') return;
      const line = JSON.stringify({ kind: 'record', atMs: Date.now(), record });
      // +1 for the newline the write appends.
      if (bytesWritten + Buffer.byteLength(line, 'utf8') + 1 > options.bounds.maxBytes) {
        finish('size-bound');
        options.onAutoStop?.('size-bound');
        return;
      }
      try {
        writeLine(line);
        recordLines++;
      } catch (err) {
        logger.warn(SCOPE, `session ${options.sessionId} write failed: ${(err as Error).message}`);
        finish('write-error');
        options.onAutoStop?.('write-error');
      }
    },
    stop(reason = 'stopped') {
      finish(reason);
    },
    projection() {
      return {
        sessionId: options.sessionId,
        sourceUid: options.sourceUid,
        name: options.name,
        redaction: options.redaction,
        filePath,
        startedAtMs,
        bounds: options.bounds,
        recordLines,
        bytesWritten,
        state,
        ...(stoppedAtMs !== undefined ? { stoppedAtMs } : {}),
        ...(endReason !== undefined ? { endReason } : {}),
      };
    },
  };
}
