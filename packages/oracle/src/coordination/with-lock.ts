/**
 * withLock — origin-scoped serialization for extension writes.
 *
 * Wraps `navigator.locks.request` with three pieces of discipline that
 * callers would otherwise re-implement at every call site:
 *
 *   1. **Observability** — every acquire / release / contention / timeout
 *      records one structured entry to the observability ring so the
 *      exported log makes concurrent-save races triage-visible
 *      (ARCHITECTURE.md §13 + §26).
 *   2. **Timeout safety** — a tab holding `ws:<id>:rule:<uid>` forever
 *      is a denial-of-service vector: every other tab's save would block.
 *      The wrapper enforces a finite timeout via the Web Locks API's
 *      `AbortSignal` option; the caller sees a rejected promise instead
 *      of an indefinite wait.
 *   3. **Testability** — jsdom does not implement `navigator.locks`, and
 *      we want deterministic race simulation in vitest anyway. The
 *      runtime is replaceable via {@link setLockRuntime} — tests inject
 *      a Map-backed FIFO mutex that honors the same semantics (one
 *      holder per name, later requests queue, `AbortSignal` aborts
 *      pending requests). Production uses the real browser API.
 *
 * Lock-name convention (Phase 10):
 *   • `ws:<workspaceId>:<entity>:<uid>` — per-entity data writes.
 *   • `ws:<workspaceId>:layout`          — per-workspace layout state.
 *   • `ws:<workspaceId>:global`          — multi-entity writes that
 *                                          must serialize against all
 *                                          per-entity locks in the
 *                                          same workspace (rare; used
 *                                          for bulk folder delete /
 *                                          workspace delete).
 *
 * These names are a stable public contract — the SW and every
 * renderer must agree on them or the mutex is meaningless.
 */

import type { LogEntry } from '@openheaders/core/types';

/**
 * Observer invoked on every structured event the lock subsystem
 * surfaces (contention, long hold, timeout, missing runtime). Host apps
 * wire this to their observability ring; tests pass a `vi.fn()` to
 * assert the shape. When unset, lock events are silently dropped — the
 * lock semantics themselves do not depend on observation.
 */
export type LockObserver = (entry: Omit<LogEntry, 'timestamp'>) => void;

let observer: LockObserver | null = null;

/**
 * Install (or clear) the lock-event observer. Pass `null` to detach.
 * Safe to call before any lock attempts — the observer is consulted
 * lazily per recorded event. The host is responsible for stamping a
 * timestamp and any version metadata.
 */
export function setLockObserver(next: LockObserver | null): void {
  observer = next;
}

function recordLog(entry: Omit<LogEntry, 'timestamp'>): void {
  observer?.(entry);
}

/** Default timeout for a lock wait before {@link LockTimeoutError} fires. */
const DEFAULT_TIMEOUT_MS = 2_000;

/**
 * Minimal `navigator.locks` surface the wrapper needs. Kept narrow so
 * the test runtime can stub exactly this shape without pulling in the
 * full LockManager typing.
 */
export interface LockRuntime {
  request<T>(name: string, options: { signal?: AbortSignal }, callback: () => Promise<T> | T): Promise<T>;
}

/** Error thrown when a lock acquisition times out. */
export class LockTimeoutError extends Error {
  readonly lockName: string;
  readonly timeoutMs: number;

  constructor(lockName: string, timeoutMs: number) {
    super(`Lock "${lockName}" not acquired within ${timeoutMs}ms`);
    this.name = 'LockTimeoutError';
    this.lockName = lockName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Real-browser runtime — calls `navigator.locks.request`. Returns null
 * when the API is absent (old Firefox, Safari webviews), letting the
 * caller fall through to the no-lock path; see {@link withLock}.
 */
function createBrowserRuntime(): LockRuntime | null {
  const nav = (globalThis as { navigator?: { locks?: LockManager } }).navigator;
  const locks = nav?.locks;
  if (!locks || typeof locks.request !== 'function') return null;
  return {
    request<T>(name: string, options: { signal?: AbortSignal }, callback: () => Promise<T> | T): Promise<T> {
      // The browser typing allows `(name, callback)` / `(name, options, callback)`
      // overloads; we always use the 3-arg form so the signal reliably
      // aborts a waiting request. The callback's return value bubbles
      // up as-is.
      return locks.request(name, options, () => callback()) as Promise<T>;
    },
  };
}

let runtime: LockRuntime | null = createBrowserRuntime();

/**
 * Override the runtime — used by tests to inject a Map-backed FIFO
 * mutex. Passing `null` reverts to the browser runtime (or no-lock
 * path if the browser doesn't expose `navigator.locks`).
 */
export function setLockRuntime(next: LockRuntime | null): void {
  runtime = next ?? createBrowserRuntime();
}

export interface WithLockOptions {
  /** Max time to wait for the lock before failing. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /**
   * Optional structured tag for observability entries — typically the
   * high-level operation being serialized (`rule-save`, `layout-persist`).
   * Lock name alone is triage-sufficient, but op helps group entries.
   */
  op?: string;
}

/**
 * Run `fn` while holding the named lock. Waits up to
 * `options.timeoutMs` (default 2s) for the lock — if the lock is held
 * past that, rejects with a {@link LockTimeoutError} instead of
 * blocking the caller indefinitely.
 *
 * When `navigator.locks` is unavailable (rare — some older Firefox
 * builds), `fn` runs directly without serialization. The
 * observability entry records the degraded mode so debugging can
 * account for it.
 */
export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T> | T,
  options: WithLockOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const op = options.op;

  if (runtime === null) {
    // Fallback mode: no Web Locks support. Caller proceeds without
    // serialization — we still record one entry so the degraded
    // behavior is visible in triage.
    recordLog({
      subsystem: 'workspace',
      op: 'lock/no-runtime',
      level: 'warn',
      message: op ? `${op} · ${lockName} (no navigator.locks)` : lockName,
      context: {},
    });
    return await fn();
  }

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), timeoutMs);

  const startTs = Date.now();
  try {
    return await runtime.request(lockName, { signal: ac.signal }, async () => {
      const heldAt = Date.now();
      // Contention = "waited more than a frame to acquire". Below that,
      // the lock was uncontended and recording a log entry per attempt
      // is just noise. Uncontended successes are inferred from the
      // absence of a contention entry plus the completion entry.
      if (heldAt - startTs > 16) {
        recordLog({
          subsystem: 'workspace',
          op: 'lock/contended',
          level: 'info',
          message: op ? `${op} · ${lockName} · ${heldAt - startTs}ms` : `${lockName} · ${heldAt - startTs}ms`,
          context: {},
        });
      }
      try {
        return await fn();
      } finally {
        const heldMs = Date.now() - heldAt;
        if (heldMs > 100) {
          // Long-held lock is a warning signal — not an error (some
          // multi-entity writes legitimately take >100ms) but worth
          // logging so the offender is identifiable if contention
          // spikes in triage.
          recordLog({
            subsystem: 'workspace',
            op: 'lock/long-hold',
            level: 'info',
            message: op ? `${op} · ${lockName} · ${heldMs}ms` : `${lockName} · ${heldMs}ms`,
            context: {},
          });
        }
      }
    });
  } catch (err) {
    if (ac.signal.aborted) {
      recordLog({
        subsystem: 'workspace',
        op: 'lock/timeout',
        level: 'error',
        message: op ? `${op} · ${lockName} · ${timeoutMs}ms` : `${lockName} · ${timeoutMs}ms`,
        context: { errorClass: 'LockTimeoutError' },
      });
      throw new LockTimeoutError(lockName, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ── Lock-name helpers (stable public contract) ──────────────────────

/**
 * Lock name for a per-entity data write. `entity` is a short tag
 * (`rule`, `collection`, `folder`, `request`, `template`, `environment`,
 * `workspace-vars`, `vault`); `uid` is the 8-char entity identifier.
 */
export function entityLockName(workspaceId: string, entity: string, uid: string): string {
  return `ws:${workspaceId}:${entity}:${uid}`;
}

/** Lock name for a per-workspace layout-state write. */
export function layoutLockName(workspaceId: string): string {
  return `ws:${workspaceId}:layout`;
}

/**
 * Lock name for a multi-entity workspace write (bulk delete, folder
 * rename that cascades into every child rule, etc). Serializes
 * against every per-entity lock in the same workspace — acquire this
 * lock ONLY when a write genuinely needs cross-entity atomicity.
 */
export function globalWorkspaceLockName(workspaceId: string): string {
  return `ws:${workspaceId}:global`;
}
