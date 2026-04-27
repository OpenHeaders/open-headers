/**
 * Workspace-export handoff registry — SW-side staging for inline payloads
 * that exceed the deep-link inline cap or come from contexts without a
 * URL bar (the playground "Install required rules" button, popup /
 * sidepanel drag-and-drop in PR 5).
 *
 * Flow:
 *   1. Caller (playground content script, popup, etc.) ships YAML to the
 *      SW via the `register-import-handoff` RPC.
 *   2. SW stores `{yaml, expiresAt}` keyed by a fresh 8-char handoff id
 *      and returns the id.
 *   3. Caller dispatches a workspace intent
 *      (`{kind: 'open-import', handoffId, source: {via: 'playground'}}`)
 *      via the existing `openWorkspaceIntent` RPC.
 *   4. The cold-path workspace tab opens at `#/import/handoff/<id>`; the
 *      renderer's intent router calls `consume-import-handoff` to drain
 *      the entry and feed the YAML into ImportPreviewModal.
 *
 * **Persistence**: `chrome.storage.session` so a handoff survives SW
 * eviction within the same browser session. Cleared on browser close —
 * 5min TTL is the contract, browser-restart drop is fine. Module-level
 * cache mirrors the storage entry so the warm path doesn't await
 * storage on every consume.
 *
 * **Cleanup**: a single recurring `chrome.alarms` tick sweeps expired
 * entries every minute. Reads ALSO check expiry — the alarm is a
 * hygiene measure, not a correctness requirement, so an evicted SW
 * that misses ticks can't surface stale handoffs.
 *
 * **Trust posture**: the handoff itself proves nothing about origin —
 * it just decouples the YAML bytes from the URL hash. The renderer
 * still treats the resulting import as `via: 'link'` / `'playground'`
 * (low-trust) per the import-source posture in design §5.1.
 */

import { generateUid } from '@openheaders/core/utils';
import { logger } from '@utils/logger';

const STORAGE_KEY = 'workspaceExport.handoffs';
const ALARM_NAME = 'oh-handoff-sweep';
const HANDOFF_TTL_MS = 5 * 60 * 1000;
const SWEEP_PERIOD_MIN = 1;
/** Per-payload cap (matches the 50 MB raw import cap from §4.1). */
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;

interface HandoffEntry {
  yaml: string;
  expiresAt: number;
}

interface PersistedShape {
  [handoffId: string]: HandoffEntry;
}

let cache: Map<string, HandoffEntry> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function getSessionStorage(): chrome.storage.StorageArea | null {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
  return chrome.storage.session;
}

function isPersistedShape(raw: unknown): raw is PersistedShape {
  if (!raw || typeof raw !== 'object') return false;
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') return false;
    const e = v as { yaml?: unknown; expiresAt?: unknown };
    if (typeof e.yaml !== 'string') return false;
    if (typeof e.expiresAt !== 'number') return false;
  }
  return true;
}

async function ensureLoaded(): Promise<Map<string, HandoffEntry>> {
  if (cache) return cache;
  cache = new Map();
  const session = getSessionStorage();
  if (!session) return cache;
  try {
    const result = await session.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (isPersistedShape(raw)) {
      const now = Date.now();
      for (const [id, entry] of Object.entries(raw)) {
        if (entry.expiresAt > now) cache.set(id, entry);
      }
    }
  } catch (err) {
    logger.info('HandoffStore', `Rehydration failed: ${(err as Error).message}`);
  }
  return cache;
}

function schedulePersist(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void persistNow();
  }, 50);
}

async function persistNow(): Promise<void> {
  const session = getSessionStorage();
  if (!session || !cache) return;
  const obj: PersistedShape = {};
  for (const [id, entry] of cache.entries()) obj[id] = entry;
  try {
    await session.set({ [STORAGE_KEY]: obj });
  } catch (err) {
    logger.info('HandoffStore', `Persist failed: ${(err as Error).message}`);
  }
}

function ensureSweepAlarm(): void {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  void chrome.alarms.get(ALARM_NAME).then((existing) => {
    if (existing) return;
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: SWEEP_PERIOD_MIN });
  });
}

/**
 * Recognize the handoff sweep alarm so background.ts can route it here
 * without leaking the alarm name.
 */
export function isHandoffSweepAlarm(alarm: chrome.alarms.Alarm): boolean {
  return alarm?.name === ALARM_NAME;
}

/**
 * Drop expired entries. Idempotent — safe to call from the alarm tick or
 * from arbitrary read paths.
 */
export async function sweepExpiredHandoffs(now: number = Date.now()): Promise<number> {
  const map = await ensureLoaded();
  let dropped = 0;
  for (const [id, entry] of map.entries()) {
    if (entry.expiresAt <= now) {
      map.delete(id);
      dropped++;
    }
  }
  if (dropped > 0) schedulePersist();
  return dropped;
}

/**
 * Stage a YAML payload for handoff. Returns the fresh handoff id the
 * caller embeds in the workspace intent. Caller is responsible for
 * dispatching the intent — this is purely the staging step.
 */
export async function registerImportHandoff(yaml: string): Promise<string> {
  if (typeof yaml !== 'string' || yaml.length === 0) {
    throw new Error('Cannot register an empty handoff payload.');
  }
  if (yaml.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Handoff payload exceeds ${MAX_PAYLOAD_BYTES} bytes (got ${yaml.length}).`);
  }
  const map = await ensureLoaded();
  const handoffId = generateUid();
  map.set(handoffId, { yaml, expiresAt: Date.now() + HANDOFF_TTL_MS });
  schedulePersist();
  ensureSweepAlarm();
  return handoffId;
}

/**
 * Drain an entry — single-use. Returns the staged YAML on success, or
 * `null` if the id is unknown or expired. Consuming a handoff removes
 * it so the same id cannot be replayed later in the session.
 */
export async function consumeImportHandoff(handoffId: string): Promise<string | null> {
  const map = await ensureLoaded();
  const entry = map.get(handoffId);
  if (!entry) return null;
  map.delete(handoffId);
  schedulePersist();
  if (entry.expiresAt <= Date.now()) return null;
  return entry.yaml;
}

/** Test-only — drop the in-memory cache so the next call rehydrates fresh. */
export function __resetHandoffStoreForTests(): void {
  cache = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

/** Test-only — synchronous read of current entry count for assertions. */
export function __debugHandoffCount(): number {
  return cache?.size ?? 0;
}
