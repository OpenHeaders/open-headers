/**
 * Capture-session vocabulary — the disk tier of the storage model
 * (AGENT_TRAFFIC_PLAN.md §3). A capture session is the ONLY path by
 * which observed traffic ever reaches disk, and every property of that
 * path is deliberate:
 *
 *   - **Human-initiated, never agent-initiated.** Sessions start from
 *     the operator plane (`oh.daemon.traffic.capture.start`) or a UI
 *     gesture — no MCP tool can start or stop one, so an agent cannot
 *     turn an in-memory grant into a durable one.
 *   - **Refuses to write until a redaction policy is attached.** The
 *     start call carries an explicit {@link TrafficCaptureRedactionPolicy};
 *     absent means refusal, not a default. v1 knows exactly one policy,
 *     `standard` — the projection boundary as-is. The point is the
 *     explicit attachment, not a policy language.
 *   - **Redacted projections only.** The session file carries
 *     `TrafficRecordProjection` lines — never raw records, and never
 *     the reveal escalation (a reveal window open during a capture
 *     still writes redacted lines).
 *   - **Bounded.** Size and duration bounds ride the session from
 *     start; a session that trips a bound STOPS and says so
 *     ({@link TrafficCaptureEndReason}), never silently truncates.
 */

/** The redaction policies a capture session can attach. v1 has exactly
 *  one — the projection boundary as-is — but the attachment is
 *  explicit and mandatory by contract. */
export type TrafficCaptureRedactionPolicy = 'standard';

/** Hard bounds one capture session carries from start. */
export interface TrafficCaptureBounds {
  readonly maxBytes: number;
  readonly maxDurationMs: number;
}

/** Production defaults — sized for "reproduce this overnight": the
 *  duration bound outlives a work day, the byte bound keeps one session
 *  from eating a disk. E2E drives tiny overrides through the start call. */
export const DEFAULT_TRAFFIC_CAPTURE_BOUNDS: TrafficCaptureBounds = {
  maxBytes: 64 * 1024 * 1024,
  maxDurationMs: 24 * 60 * 60 * 1000,
};

/**
 * How a session ended. `stopped` is the explicit human gesture;
 * `size-bound` / `duration-bound` are bound trips (the session STOPPED,
 * honestly — nothing was silently dropped); `source-disarmed` is the
 * absence cascade (disarming a source stops its capture); `write-error`
 * is a failed disk write (disk full, permissions) — the session stops
 * rather than pretending to record.
 */
export type TrafficCaptureEndReason = 'stopped' | 'size-bound' | 'duration-bound' | 'source-disarmed' | 'write-error';

/** One capture session, projected for operator surfaces. */
export interface TrafficCaptureSessionProjection {
  readonly sessionId: string;
  /** The armed source this session records. */
  readonly sourceUid: string;
  /** Operator-chosen session name (also part of the file name). */
  readonly name: string;
  readonly redaction: TrafficCaptureRedactionPolicy;
  /** Absolute path of the session's JSONL file. */
  readonly filePath: string;
  readonly startedAtMs: number;
  readonly bounds: TrafficCaptureBounds;
  /** Record lines appended so far. The file folds last-wins by
   *  (tabId, requestId) — a record refined after its first append
   *  appears again with the refinement applied. */
  readonly recordLines: number;
  readonly bytesWritten: number;
  readonly state: 'active' | 'stopped';
  readonly stoppedAtMs?: number;
  readonly endReason?: TrafficCaptureEndReason;
}
