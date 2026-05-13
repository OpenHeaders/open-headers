/**
 * Observability Log — SW-side owner of the structured event ring.
 *
 * All subsystems (rule-engine, request-executor, workspace, environment,
 * vault, permissions) record structured entries here via {@link recordLog}.
 * Entries persist to `chrome.storage.local` (debounced flush) and survive
 * SW termination so a bug report filed days after the event still
 * contains the triage context.
 *
 * Persistence contract:
 *   - Writes are debounced by {@link PERSIST_DEBOUNCE_MS}. High-volume
 *     subsystems (rule-engine during a mass paste, say) don't thrash
 *     storage; low-volume ones still flush on every action.
 *   - The full ring is persisted on every flush. At N=500 structured
 *     entries (~50–100 bytes each serialized) that's under 100 KB —
 *     well inside chrome.storage.local quotas, and simpler than
 *     incremental delta tracking.
 *   - On SW wake, {@link hydrateObservabilityLog} reads the last
 *     snapshot back into memory before any subsystem records new
 *     entries. Callers that record before hydration get their entries
 *     appended to a best-effort-empty buffer; the first persist after
 *     hydration is authoritative.
 *
 * No telemetry leaves the device. Ever. See ARCHITECTURE.md §26 +
 * PERMISSIONS.md for the trust commitment.
 */

import { broadcast } from '@utils/bridge';
import { logger } from '@utils/logger';
import { LogRing } from '@/shared/observability/ring';
import type { LogEntry } from '@openheaders/core/types';
import { extensionStorage, OH } from '@openheaders/oracle/storage';

const PERSIST_DEBOUNCE_MS = 250;

const ring = new LogRing();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// Extension version is a build-time constant, but __APP_VERSION__ isn't
// available as a plain import — we pick it up from the runtime manifest
// on first record (chrome.runtime.getManifest is synchronous).
let cachedVersion: string | undefined;
function getExtensionVersion(): string | undefined {
  if (cachedVersion !== undefined) return cachedVersion;
  try {
    cachedVersion = chrome.runtime.getManifest()?.version;
  } catch {
    cachedVersion = undefined;
  }
  return cachedVersion;
}

/**
 * Read the persisted snapshot back into memory. Call once on SW init
 * before any other subsystem records its first entry.
 */
export async function hydrateObservabilityLog(): Promise<void> {
  if (hydrated) return;
  try {
    const stored = await extensionStorage.get(OH.observabilityLog);
    if (Array.isArray(stored)) ring.hydrate(stored);
  } catch (err) {
    // Storage read failed — keep an empty ring and move on. We don't
    // want a missing log to block workspace hydration; the missing
    // history isn't worth surfacing to the user.
    logger.warn('ObservabilityLog', 'Failed to hydrate', err);
  }
  hydrated = true;
}

/**
 * Append one structured entry. Caller provides the feature payload;
 * this module stamps the timestamp + extension version. Safe to call
 * before hydration — early entries land on the empty buffer and
 * survive the first post-hydration flush.
 */
export function recordLog(entry: Omit<LogEntry, 'timestamp'>): void {
  const stamped: LogEntry = {
    ...entry,
    timestamp: Date.now(),
    context: {
      ...entry.context,
      extensionVersion: entry.context.extensionVersion ?? getExtensionVersion(),
    },
  };
  ring.record(stamped);
  schedulePersist();
  broadcast('observabilityLogUpdated', { size: ring.size() });
}

/** Read-only view of the current ring — oldest first. */
export function getObservabilityLog(): readonly LogEntry[] {
  return ring.getAll();
}

/** Drop every entry. Persists the empty snapshot. */
export function clearObservabilityLog(): void {
  ring.clear();
  schedulePersist();
  broadcast('observabilityLogUpdated', { size: 0 });
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void extensionStorage.set(OH.observabilityLog, ring.snapshot()).catch((err: unknown) => {
      logger.warn('ObservabilityLog', 'Persist failed', err);
    });
  }, PERSIST_DEBOUNCE_MS);
}

// ── Test helpers ───────────────────────────────────────────────────

/** Reset internal state — tests only. */
export function __resetForTests(): void {
  ring.clear();
  hydrated = false;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  cachedVersion = undefined;
}
