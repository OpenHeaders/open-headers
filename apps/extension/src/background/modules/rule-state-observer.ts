/**
 * Rule-state observer — diffs the effective-active rule set across
 * DNR rebuilds and enqueues cache eviction for every transition.
 *
 * "Effective active" means: `rule.enabled === true` AND not covered
 * by any pause marker on its path AND the global engine isn't paused.
 * Any flip on those axes — explicit toggle, folder pause cascade,
 * engine pause, delete, add, workspace switch — shows up here as a
 * transition on the rule's UID.
 *
 * The observer is the only module that knows *when* cache eviction is
 * warranted. It relies on:
 *
 *   - `extractRuleOrigins` (rule-origins) — pure mapping from a rule
 *     to the origins it covers.
 *   - `enqueueInvalidation` (cache-invalidator) — platform adapter
 *     that actually calls `chrome.browsingData.remove`.
 *
 * Neither of those modules holds state; this one does. It lives as a
 * module-singleton because there's exactly one rule engine per
 * extension instance.
 *
 * Four transition categories drive an eviction:
 *
 *   1. **Added** — UID present in new snapshot, absent in previous.
 *      Cached responses for the rule's origins predate the rule;
 *      evict so the next fetch applies the new rule.
 *
 *   2. **Removed / deleted** — UID present in previous, absent in
 *      new. Cached responses reflect the old rule's injections; evict
 *      so the next fetch is honest about the absence of that rule.
 *
 *   3. **Flags flipped** — effective state changed (enable/disable or
 *      pause/unpause in either direction). Same reasoning: evict so
 *      the next fetch matches the new state.
 *
 *   4. **Origins changed** — rule stayed active but a URL-pattern edit
 *      moved its scope. Evict both previous and new origins — the
 *      previous scope has rule-applied bytes that may now be stale
 *      relative to the new scope, and the new scope has rule-less
 *      bytes from before the edit.
 *
 * **First-run seeding**: the very first call to `observeRuleState`
 * after boot seeds the snapshot and emits no transitions. Otherwise
 * every browser start would nuke the HTTP cache globally.
 *
 * **SW restart persistence**: MV3 terminates service workers after
 * ~30s of inactivity. Module-level state dies with them, so a rule
 * change while the SW is asleep would silently bypass the observer
 * (first-run skip on wake). The snapshot is persisted to
 * `chrome.storage.session` — scoped to the browser session, cleared
 * on browser close — and rehydrated on SW wake before any
 * `rebuildAll` runs. On fresh browser start storage.session is empty
 * and the first-run skip still protects us from wiping the cache on
 * every launch.
 */

import type { Rule } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { isRuleEffective } from '@openheaders/core/utils';
import { logger } from '@utils/logger';
import { enqueueInvalidation } from './net/cache-invalidator';
import { extractRuleOrigins } from '@openheaders/oracle/rule-engine/rule-origins';

interface RuleFingerprint {
  /** `isRuleEffective(rule, pauseMarkers, enginePaused)` — the single
   *  bit that gates DNR inclusion. Combines enabled, complete, pause
   *  cascade, and engine pause. */
  effective: boolean;
  /** Pre-extracted at snapshot time so we still have it post-deletion. */
  origins: string[];
  /** Sticky flag from `extractRuleOrigins`: true → force broad wipe. */
  broad: boolean;
}

type Snapshot = Map<string /* ruleUid */, RuleFingerprint>;

const STORAGE_KEY = 'ruleStateObserver.snapshot';

let previousSnapshot: Snapshot | null = null;
/** Pending write — debounced so rapid rebuilds don't spam the session store. */
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Diff the current rule set against the last observed snapshot and
 * enqueue an appropriate cache invalidation for any transitions. Call
 * AFTER `rebuildAll` has pushed the new DNR rules to Chrome — the
 * eviction itself is async and decoupled.
 */
export function observeRuleState(
  rules: readonly Rule[],
  pauseMarkers: ReadonlyMap<string, PauseMarker>,
  enginePaused: boolean,
): void {
  const current = buildSnapshot(rules, pauseMarkers, enginePaused);

  if (previousSnapshot === null) {
    // First run after boot / extension reload / workspace import —
    // seed without emitting. Future diffs are against this baseline.
    previousSnapshot = current;
    schedulePersist();
    return;
  }

  const { origins, broad } = diff(previousSnapshot, current);
  previousSnapshot = current;
  schedulePersist();

  if (broad || origins.size > 0) {
    enqueueInvalidation([...origins], broad);
  }
}

/**
 * Rehydrate the snapshot from `chrome.storage.session`. Call ONCE at
 * SW startup, before the first `rebuildAll` runs. If the session store
 * has a prior snapshot (SW terminated then woke within the same
 * browser session), `observeRuleState` will diff against it on next
 * call. Otherwise (fresh browser start, storage.session unavailable),
 * the first call stays first-run.
 *
 * Safe to call multiple times — subsequent calls are a no-op unless
 * `__resetSnapshotForTests` has run.
 */
export async function rehydrateFromStorage(): Promise<void> {
  if (previousSnapshot !== null) return;
  const session = getSessionStorage();
  if (!session) return;
  try {
    const result = await session.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!isPersistedShape(raw)) return;
    const hydrated: Snapshot = new Map();
    for (const [uid, fp] of Object.entries(raw)) hydrated.set(uid, fp);
    previousSnapshot = hydrated;
    logger.info('RuleStateObserver', `Rehydrated snapshot: ${hydrated.size} rule(s)`);
  } catch (err) {
    logger.info('RuleStateObserver', `Rehydration failed: ${(err as Error).message}`);
  }
}

/**
 * Reseed the observer after a workspace switch. Unlike the incremental
 * `observeRuleState` diff, this:
 *   1. Captures the full set of origins the OUTGOING workspace touched
 *      (every effective rule's origins).
 *   2. Unions them with the INCOMING workspace's effective origins.
 *   3. Issues a single invalidation (broad if either side was broad).
 *   4. Replaces the snapshot baseline with the new workspace's state so
 *      subsequent diffs are relative to the new active set.
 *
 * One broad wipe is almost always cheaper and safer than emitting a
 * transition per rule uid — a workspace switch changes dozens or hundreds
 * of rules at once, and per-rule diffs fan out into many small evictions
 * the cache invalidator then has to coalesce anyway.
 */
export function seedFromWorkspaceSwitch(
  nextRules: readonly Rule[],
  pauseMarkers: ReadonlyMap<string, PauseMarker>,
  enginePaused: boolean,
): void {
  const next = buildSnapshot(nextRules, pauseMarkers, enginePaused);

  const origins = new Set<string>();
  let broad = false;

  if (previousSnapshot) {
    for (const fp of previousSnapshot.values()) {
      if (!fp.effective) continue;
      for (const o of fp.origins) origins.add(o);
      if (fp.broad) broad = true;
    }
  }
  for (const fp of next.values()) {
    if (!fp.effective) continue;
    for (const o of fp.origins) origins.add(o);
    if (fp.broad) broad = true;
  }

  previousSnapshot = next;
  schedulePersist();

  if (broad || origins.size > 0) {
    enqueueInvalidation([...origins], broad);
  }
}

/**
 * Test-only helper. Resets the observer's internal snapshot so the
 * next call to `observeRuleState` is treated as the first run.
 */
export function __resetSnapshotForTests(): void {
  previousSnapshot = null;
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
}

/** Inspect the current snapshot — test-only. */
export function __getSnapshotForTests(): ReadonlyMap<string, RuleFingerprint> | null {
  return previousSnapshot;
}

// ── Persistence ──────────────────────────────────────────────────

const PERSIST_DEBOUNCE_MS = 200;

function schedulePersist(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void persistSnapshot();
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Test-only: force-flush the pending persist so tests don't have to
 * juggle fake-timer + async-chain interactions.
 */
export async function __flushPersistForTests(): Promise<void> {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  await persistSnapshot();
}

async function persistSnapshot(): Promise<void> {
  const session = getSessionStorage();
  if (!session || previousSnapshot === null) return;
  const payload: Record<string, RuleFingerprint> = {};
  for (const [uid, fp] of previousSnapshot) payload[uid] = fp;
  try {
    await session.set({ [STORAGE_KEY]: payload });
  } catch (err) {
    logger.info('RuleStateObserver', `Persist failed: ${(err as Error).message}`);
  }
}

interface SessionStorageApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getSessionStorage(): SessionStorageApi | null {
  const c = globalThis as unknown as {
    chrome?: { storage?: { session?: SessionStorageApi } };
    browser?: { storage?: { session?: SessionStorageApi } };
  };
  return c.chrome?.storage?.session ?? c.browser?.storage?.session ?? null;
}

function isPersistedShape(raw: unknown): raw is Record<string, RuleFingerprint> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  // Light validation — one bad entry shouldn't poison the whole map.
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') return false;
    const fp = value as Record<string, unknown>;
    if (typeof fp.effective !== 'boolean') return false;
    if (!Array.isArray(fp.origins)) return false;
    if (typeof fp.broad !== 'boolean') return false;
  }
  return true;
}

// ── Snapshot construction ────────────────────────────────────────

function buildSnapshot(
  rules: readonly Rule[],
  pauseMarkers: ReadonlyMap<string, PauseMarker>,
  enginePaused: boolean,
): Snapshot {
  const out: Snapshot = new Map();
  for (const rule of rules) {
    const effective = isRuleEffective(rule, pauseMarkers, enginePaused);
    const { origins, broad } = extractRuleOrigins(rule);
    out.set(rule.uid, { effective, origins, broad });
  }
  return out;
}

// ── Diff ─────────────────────────────────────────────────────────

interface DiffResult {
  origins: Set<string>;
  broad: boolean;
}

function diff(prev: Snapshot, next: Snapshot): DiffResult {
  const origins = new Set<string>();
  let broad = false;

  const seenUids = new Set<string>();

  for (const [uid, curr] of next) {
    seenUids.add(uid);
    const previous = prev.get(uid);

    if (!previous) {
      // Rule added. Evict for the new origins so the first fetch
      // honors the new rule.
      if (curr.effective) {
        mergeOriginContribution(origins, curr);
        if (curr.broad) broad = true;
      }
      // A newly-added, disabled rule contributes nothing — it can't
      // have polluted any cache yet.
      continue;
    }

    // Effective-state flip (enable ↔ disable, pause ↔ unpause).
    if (previous.effective !== curr.effective) {
      mergeOriginContribution(origins, previous);
      mergeOriginContribution(origins, curr);
      if (previous.broad || curr.broad) broad = true;
      continue;
    }

    // Scope edit: URL pattern changed while the rule stayed effective.
    if (previous.effective && curr.effective && originsChanged(previous.origins, curr.origins)) {
      mergeOriginContribution(origins, previous);
      mergeOriginContribution(origins, curr);
      if (previous.broad || curr.broad) broad = true;
    }

    // Broad transitions — pattern went from extractable to non-extractable
    // (or vice versa). Same treatment as scope edit.
    if (previous.broad !== curr.broad && previous.effective && curr.effective) {
      mergeOriginContribution(origins, previous);
      mergeOriginContribution(origins, curr);
      broad = true;
    }
  }

  // Rules present in prev but not in next — deleted / collection removed.
  for (const [uid, previous] of prev) {
    if (seenUids.has(uid)) continue;
    if (previous.effective) {
      mergeOriginContribution(origins, previous);
      if (previous.broad) broad = true;
    }
  }

  return { origins, broad };
}

function mergeOriginContribution(sink: Set<string>, fp: RuleFingerprint): void {
  for (const o of fp.origins) sink.add(o);
}

function originsChanged(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  const seen = new Set(a);
  for (const o of b) if (!seen.has(o)) return true;
  return false;
}
