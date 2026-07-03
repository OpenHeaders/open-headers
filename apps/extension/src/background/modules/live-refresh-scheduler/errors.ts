/**
 * Sentinel error ladder + failure observability mapping. Every class
 * marks a deliberate no-op skip (or the Phase-C stub) so the provider's
 * `recordFailure` / `onFailed` narrowing stays exhaustive;
 * `describeRefreshFailure` maps each to its log level + message.
 */

/**
 * Sentinel error the provider throws when the chain adapter hasn't
 * been registered yet (Phase C shipped before Phase D). Kept folder-
 * internal so `onFailed` can distinguish the stub path from real adapter
 * failures when routing log level.
 */
export class LiveSchedulerNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerNotReady';
  }
}

/**
 * Sentinel error the provider throws when `canCircuitAttempt` refuses
 * a dispatch because the circuit is OPEN and `nextAttemptAt` hasn't
 * been reached yet. Not a real failure — the state machine is doing
 * its job. `recordFailure` returns the existing cache row without
 * mutating; `onFailed` logs at debug level. The error exists as a
 * class (rather than a magic string match) so TypeScript narrowing
 * catches every branch that needs to special-case the no-op path.
 */
export class CircuitBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBlocked';
  }
}

/**
 * Sentinel thrown when the cadence-ownership defer gate (WS-C C8)
 * declines a fire: this peer is connected to a backend and holds a
 * remote-sourced value that is still comfortably fresh, so the backend
 * owns the cadence. Not a failure — `recordFailure` re-arms the
 * (near-expiry) alarm without touching the circuit, and `onFailed` logs
 * it at info. A class (not a string match) so the narrowing in those two
 * branches is exhaustive.
 */
export class DeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Deferred';
  }
}

/**
 * Sentinel thrown by the C9 near-expiry escape hatch when a connected peer
 * declines to self-refresh an *exclusive* credential whose producing backend
 * has gone silent near expiry. Not a failure — refreshing would burn the
 * single-use code / trip OAuth reuse-detection. `provider.refresh` has
 * already marked the row degraded (`markExclusiveDegradedForRun`) so the
 * Status pill surfaces "reconnect the desktop"; this only routes the no-op:
 * `recordFailure` re-arms at the cadence floor without touching the circuit,
 * and `onFailed` logs it at info. A class (not a string match) so the
 * narrowing in those branches stays exhaustive.
 */
export class ExclusiveDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExclusiveDeferred';
  }
}

/**
 * Sentinel thrown by the C10 connect-time fence when a connected peer
 * declines to be the *first* runner of an *exclusive* credential before
 * any §4 value has landed for the row (`lastSyncedValueAt == null`, or a
 * synced value with no derivable expiry). Closes the Mode-1 connect edge:
 * a mid-cycle exclusive alarm that would otherwise self-refresh, racing
 * the freshly-connected backend's first run (TOTP burn / OAuth
 * reuse-detection), is held back until the backend proves it is producing.
 * Not a failure — `recordFailure` re-arms without touching the circuit,
 * and `onFailed` logs it at info. Unlike C9 it does NOT degrade the row:
 * the gap is expected (catch-up in flight) and self-heals when the first
 * synced value lands; a persistent gap surfaces via the generic
 * stale-yellow path rather than a possibly-misleading "reconnect" banner.
 * A class (not a string match) so the narrowing in those branches stays
 * exhaustive.
 */
export class ConnectFenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectFenced';
  }
}

/**
 * Sentinel thrown by the C14 offline fallback gate when a configured
 * backend is OFFLINE and this peer is NOT the elected single runner for an
 * *exclusive* credential (ineligible / unranked / outranked / no list).
 * Self-refreshing would race the other partitioned browsers on the
 * single-use cred. Not a failure — `provider.refresh` has already marked
 * the row degraded (`markExclusiveDegradedForRun`) so the Status pill
 * surfaces "reconnect the desktop"; this only routes the no-op:
 * `recordFailure` re-arms at the cadence floor without touching the
 * circuit, and `onFailed` logs it at info. The flag clears the moment the
 * elected host's value syncs in on reconnect, or the backend returns. A
 * class (not a string match) so the narrowing in those branches stays
 * exhaustive.
 */
export class FallbackNotElectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FallbackNotElected';
  }
}

/**
 * Sentinel thrown by the offline gate (audit X-1) when this peer's socket is
 * down because the backend ACTIVELY REJECTED it (revoked/rotated token, or
 * protocol mismatch) rather than being unreachable. The backend is alive and
 * still owns the exclusive credential, so self-electing would race it — the
 * exact kill-switch escalation X-1 closes. Distinct from
 * `FallbackNotElectedError` (genuinely offline, just outranked/ineligible):
 * here the resolution is to RE-PAIR, not to wait for reconnect. Not a
 * failure — `provider.refresh` has already marked the row degraded
 * (`markExclusiveDegradedForRun`); this only routes the no-op: `recordFailure`
 * re-arms at the cadence floor without touching the circuit, and `onFailed`
 * logs at info. The flag clears once a fresh value syncs in after re-pairing.
 * A class (not a string match) so the narrowing stays exhaustive.
 */
export class BackendEvictedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendEvicted';
  }
}

/**
 * Thrown when an attempt is refused because the platform reports
 * `navigator.onLine === false`. Not a circuit failure — the provider
 * is (probably) fine; the client has no way to reach it. Treating
 * offline blips as circuit failures would race through all three
 * pre-breaker retries in 90 seconds (the 30s MV3 alarm floor clamps
 * the intended 5–10s pre-breaker delay) and open the circuit before
 * the user even notices they're offline. Mirrors v4's behavior where
 * `NetworkService.on('offline')` paused the refresh scheduler instead
 * of letting it hammer the circuit.
 *
 * The 'online' event handler in `background.ts` explicitly reconciles
 * + kicks overdue workflows when connectivity returns, so missed
 * windows get caught up without contributing to backoff state.
 */
export class OfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Offline';
  }
}

/**
 * Read the SW's current online/offline signal. Best-effort:
 * `navigator.onLine` can be stale (the browser only flips it on a
 * confirmed platform event), and SWs in some test harnesses don't
 * expose the global at all — fail open (assume online) when absent.
 */
export function isNetworkOnline(): boolean {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
  } catch {
    return true;
  }
}

/** Observability descriptor for a refresh failure. */
export interface RefreshFailureDescriptor {
  level: 'info' | 'warn' | 'error';
  message: string;
  /** Stable machine tag for the log `context`, narrower than `err.name`. */
  errorClass: string;
}

/**
 * Map a refresh failure to its observability descriptor — one entry per
 * sentinel, so the log level lives beside its message + class instead of
 * across parallel ternary cascades.
 *
 * Most "failures" are deliberate **no-op skips**: a gate (offline / not the
 * elected fallback / backend owns cadence / connect-fence / circuit-open)
 * declined the fire. They log at `info` with a specific message — Phase G's
 * Status pill owns the yellow/red aggregation, so we don't escalate log
 * level per attempt the way OAuth does. The Phase-C stub logs `warn`; only
 * a genuine adapter bubble logs `error`.
 */
export function describeRefreshFailure(err: Error, workflowUid: string): RefreshFailureDescriptor {
  if (err instanceof OfflineError) {
    return { level: 'info', errorClass: 'Offline', message: `Offline — refresh deferred for workflow ${workflowUid}` };
  }
  if (err instanceof FallbackNotElectedError) {
    return {
      level: 'info',
      errorClass: 'FallbackNotElected',
      message: `Backend offline for workflow ${workflowUid} — peer not the elected fallback runner, won't race (reconnect the desktop)`,
    };
  }
  if (err instanceof BackendEvictedError) {
    return {
      level: 'info',
      errorClass: 'BackendEvicted',
      message: `Backend rejected this peer for workflow ${workflowUid} — evicted, not offline; won't self-elect an exclusive cred (re-pair the desktop)`,
    };
  }
  if (err instanceof ExclusiveDeferredError) {
    return {
      level: 'info',
      errorClass: 'ExclusiveDeferred',
      message: `Exclusive cred degraded for workflow ${workflowUid} — backend silent, peer won't race (reconnect the desktop)`,
    };
  }
  if (err instanceof ConnectFenceError) {
    return {
      level: 'info',
      errorClass: 'ConnectFenced',
      message: `Backend connected but not yet producing for workflow ${workflowUid} — peer won't race the first exclusive run`,
    };
  }
  if (err instanceof DeferredError) {
    return {
      level: 'info',
      errorClass: 'Deferred',
      message: `Backend owns cadence for workflow ${workflowUid} — peer refresh deferred`,
    };
  }
  if (err instanceof CircuitBlockedError) {
    return {
      level: 'info',
      errorClass: 'CircuitBlocked',
      message: `Circuit open for workflow ${workflowUid} — refresh declined`,
    };
  }
  if (err instanceof LiveSchedulerNotReadyError) {
    return {
      level: 'warn',
      errorClass: 'SchedulerNotReady',
      message: `No refresh adapter for workflow ${workflowUid} (Phase D not yet wired)`,
    };
  }
  return { level: 'error', errorClass: err.name, message: `Refresh failed for ${workflowUid}: ${err.message}` };
}
