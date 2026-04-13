/**
 * Test Run Store — owner-keyed persistence for completed test runs.
 *
 * Each test run is stamped with an **owner** (a single rule, folder,
 * collection, or the whole workspace) at the moment it is launched.
 * Runs live in per-owner buckets so the bottom panel can render exactly
 * the history that belongs to the entity the user is looking at — no
 * rollup, no cross-visibility.
 *
 * Ownership semantics:
 *   - A run launched against a single rule lives only on that rule.
 *   - A run launched against a folder lives only on that folder.
 *   - A run launched against a collection lives only on that collection.
 *   - A "Test All Rules" run lives in the singleton workspace bucket.
 *   - When an owner is deleted, its bucket is dropped.
 *
 * Stale detection: at run-finish we snapshot a content hash for the
 * owner (descendant rules + their match-relevant fields). On read we
 * recompute the current hash and flag the run `isStale: true` if it
 * differs. The run itself is preserved — the user can still open the
 * historical report, they just see a "stale" badge so they know the
 * underlying rules drifted since the run.
 *
 * Storage layout: a single `chrome.storage.local` key holding
 * `Record<ownerKey, StoredTestRun[]>`. Per-owner ring buffer cap so one
 * chatty owner cannot starve another.
 */

import type { V5 } from '@openheaders/core/types';
import { storage } from '@utils/browser-api';
import { getLocalCollectionTrees, getRules } from './rule-store';
import type { ShadowAttribution } from './shadow-arbitration';
import type { Evidence } from './tab-telemetry';

// ── Public types ──────────────────────────────────────────────────

export type TestRuleStatus = 'executed' | 'no-fire' | 'skipped';

export type TestRunOwnerType = 'rule' | 'folder' | 'collection' | 'workspace';

/**
 * Singleton id for the workspace owner — there is exactly one workspace,
 * so the bucket key is fixed. Stored on every "Test All Rules" run so
 * they share a single history bucket.
 */
export const WORKSPACE_OWNER_ID = 'all';

export interface TestRunOwner {
  type: TestRunOwnerType;
  /** uid of the rule / folder / collection, or WORKSPACE_OWNER_ID for workspace. */
  id: string;
}

export interface TestFireEvent {
  ruleUid: string;
  url: string;
  evidence: Evidence;
  t: number;
  shadowedBy?: ShadowAttribution;
}

/**
 * The persisted shape of a finished test run. The owner is stamped
 * at run start; stale detection compares `ownerHashAtRun` against
 * a freshly computed hash of the owner's current content.
 */
export interface StoredTestRun {
  id: string;
  ownerType: TestRunOwnerType;
  ownerId: string;
  /**
   * Display name of the owner at the time the run executed. Kept on
   * the record so the bottom-panel list can show "Header rule for /api"
   * even after the user has renamed the rule. Not used for matching.
   */
  ownerNameAtRun: string;
  ruleUids: string[];
  url: string;
  startedAt: number;
  endedAt: number;
  waitSeconds: number;
  fires: TestFireEvent[];
  ruleStatuses: Record<string, TestRuleStatus>;
  noFireReasons?: Record<string, ShadowAttribution>;
  /**
   * Hash of the owner's match-relevant content at the moment the run
   * finished. Compared against a freshly computed hash on read; mismatch
   * surfaces as `isStale: true` on the returned run.
   */
  ownerHashAtRun: string;
}

/** A stored run decorated with the freshly computed stale flag. */
export type LoadedTestRun = StoredTestRun & { isStale: boolean };

// ── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = 'v5TestRuns';
const MAX_PER_OWNER = 20;

// ── Storage primitives ─────────────────────────────────────────────

type Bucket = StoredTestRun[];
type StoreShape = Record<string, Bucket>;

function ownerKey(owner: TestRunOwner): string {
  return `${owner.type}:${owner.id}`;
}

function readStore(): Promise<StoreShape> {
  return new Promise((resolve) => {
    storage.local.get([STORAGE_KEY], (result: Record<string, unknown>) => {
      resolve((result[STORAGE_KEY] as StoreShape | undefined) ?? {});
    });
  });
}

function writeStore(store: StoreShape): Promise<void> {
  return new Promise((resolve) => {
    storage.local.set({ [STORAGE_KEY]: store }, () => resolve());
  });
}

/**
 * Serialize read-modify-write operations on the test-runs key. Without
 * this, two concurrent finishes could read the same prior state and each
 * overwrite with its own union of one run. The chain serialises every
 * mutation behind a single tail promise.
 */
let lockChain: Promise<void> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lockChain.then(fn);
  lockChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ── Owner content hashing ──────────────────────────────────────────

/**
 * Match-relevant slice of a rule for hashing. Excludes name and path so
 * pure cosmetic changes (rename, move within a folder) don't invalidate
 * historical runs.
 */
function hashableRuleContent(rule: V5.Rule): unknown {
  return {
    uid: rule.uid,
    enabled: rule.enabled,
    type: rule.type,
    conditions: rule.conditions ?? [],
    action: (rule as { action?: unknown }).action ?? null,
  };
}

/** Deterministic JSON.stringify with sorted object keys. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/** djb2 hash → unsigned 32-bit hex. Cheap, stable, plenty for change detection. */
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

/**
 * Walk a collection tree and collect the descendant rule uids in the
 * order they appear in the tree. Used both for hashing (deterministic
 * traversal) and for the runner's scope snapshot.
 */
function collectDescendantRuleUids(nodes: V5.TreeNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.type === 'rule') out.push(node.uid);
    else if (node.type === 'folder') out.push(...collectDescendantRuleUids(node.children));
  }
  return out;
}

/**
 * Find the descendant rule uids of a folder uid by walking every
 * collection tree. Returns null if the folder isn't found in any tree.
 */
function findFolderDescendantRuleUids(folderUid: string, trees: V5.CollectionTree[]): string[] | null {
  for (const tree of trees) {
    const found = walkForFolder(folderUid, tree.tree);
    if (found) return collectDescendantRuleUids(found.children);
  }
  return null;
}

function walkForFolder(folderUid: string, nodes: V5.TreeNode[]): V5.FolderNode | null {
  for (const n of nodes) {
    if (n.type === 'folder') {
      if (n.uid === folderUid) return n;
      const found = walkForFolder(folderUid, n.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Compute a content hash for an owner's current state. Returns null if
 * the owner no longer exists — callers treat that as "irreversibly
 * stale" but the bucket is normally cascade-deleted when the owner is
 * removed, so this is a defensive fallback only.
 */
export function computeOwnerHash(owner: TestRunOwner): string | null {
  const allRules = getRules();

  if (owner.type === 'workspace') {
    // Workspace owner hashes over every live rule, sorted by uid so the
    // hash is deterministic across reloads. Adding/removing/editing any
    // rule drifts the hash and flags previous workspace runs stale.
    const sorted = [...allRules].sort((a, b) => a.uid.localeCompare(b.uid));
    return djb2(stableStringify({ workspace: sorted.map(hashableRuleContent) }));
  }

  if (owner.type === 'rule') {
    const rule = allRules.find((r) => r.uid === owner.id);
    if (!rule) return null;
    return djb2(stableStringify(hashableRuleContent(rule)));
  }

  const trees = getLocalCollectionTrees();
  let descendantUids: string[] | null = null;
  if (owner.type === 'collection') {
    const tree = trees.find((t) => t.uid === owner.id);
    if (!tree) return null;
    descendantUids = collectDescendantRuleUids(tree.tree);
  } else {
    descendantUids = findFolderDescendantRuleUids(owner.id, trees);
    if (descendantUids === null) return null;
  }

  const ruleByUid = new Map(allRules.map((r) => [r.uid, r] as const));
  // Hash the ordered uid list (so adding/removing/reordering rules
  // changes the hash) plus each rule's match-relevant content.
  const payload = descendantUids.map((uid) => {
    const rule = ruleByUid.get(uid);
    return rule ? hashableRuleContent(rule) : { uid, missing: true };
  });
  return djb2(stableStringify({ uids: descendantUids, rules: payload }));
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Persist a finished test run into its owner bucket. Ring-buffer trim
 * keeps each bucket at MAX_PER_OWNER. Idempotent on run id within the
 * same bucket — re-persisting overwrites the prior copy in place rather
 * than duplicating.
 */
export async function persistTestRun(run: StoredTestRun): Promise<void> {
  await withLock(async () => {
    const store = await readStore();
    const key = ownerKey({ type: run.ownerType, id: run.ownerId });
    const bucket = store[key] ? [...store[key]] : [];
    const existingIdx = bucket.findIndex((s) => s.id === run.id);
    if (existingIdx >= 0) bucket[existingIdx] = run;
    else bucket.unshift(run);
    // Sort newest-first so the ring-buffer trim drops the oldest.
    bucket.sort((a, b) => b.endedAt - a.endedAt);
    store[key] = bucket.slice(0, MAX_PER_OWNER);
    await writeStore(store);
  });
}

/**
 * List runs for a given owner, newest-first, decorated with a freshly
 * computed `isStale` flag. Empty array if none.
 */
export async function listTestRunsForOwner(owner: TestRunOwner): Promise<LoadedTestRun[]> {
  const store = await readStore();
  const bucket = store[ownerKey(owner)] ?? [];
  const currentHash = computeOwnerHash(owner);
  return bucket.map((s) => ({
    ...s,
    isStale: currentHash === null || currentHash !== s.ownerHashAtRun,
  }));
}

/**
 * List every persisted run across every owner bucket, newest-first.
 * Powers the workspace-wide Test Runs panel (left ActivityBar launcher).
 *
 * Stale detection is done per-owner: we memoize `computeOwnerHash` per
 * ownerKey so a bucket with many runs only hashes its owner once. Runs
 * whose owner no longer exists are still returned — they just come back
 * with `isStale: true`, which the UI surfaces as a warning badge.
 */
export async function listAllTestRuns(): Promise<LoadedTestRun[]> {
  const store = await readStore();
  const hashCache = new Map<string, string | null>();
  const out: LoadedTestRun[] = [];
  for (const [key, bucket] of Object.entries(store)) {
    if (!bucket || bucket.length === 0) continue;
    const sep = key.indexOf(':');
    if (sep < 0) continue;
    const type = key.slice(0, sep) as TestRunOwnerType;
    const id = key.slice(sep + 1);
    let currentHash = hashCache.get(key);
    if (currentHash === undefined) {
      currentHash = computeOwnerHash({ type, id });
      hashCache.set(key, currentHash);
    }
    for (const s of bucket) {
      out.push({
        ...s,
        isStale: currentHash === null || currentHash !== s.ownerHashAtRun,
      });
    }
  }
  out.sort((a, b) => b.endedAt - a.endedAt);
  return out;
}

/**
 * Find a single run by id without knowing the owner. Used by the run
 * report view which only has the run id from the route. Walks all
 * buckets — fine because the total run count is bounded by the
 * per-owner cap times the number of owners.
 */
export async function getTestRunById(id: string): Promise<LoadedTestRun | null> {
  const store = await readStore();
  for (const bucket of Object.values(store)) {
    const found = bucket.find((s) => s.id === id);
    if (found) {
      const currentHash = computeOwnerHash({ type: found.ownerType, id: found.ownerId });
      return { ...found, isStale: currentHash === null || currentHash !== found.ownerHashAtRun };
    }
  }
  return null;
}

/** Delete a single run by id. No-op if not found. */
export async function deleteTestRunById(id: string): Promise<void> {
  await withLock(async () => {
    const store = await readStore();
    let changed = false;
    for (const key of Object.keys(store)) {
      const bucket = store[key];
      const next = bucket.filter((s) => s.id !== id);
      if (next.length !== bucket.length) {
        store[key] = next;
        changed = true;
      }
      if (store[key].length === 0) delete store[key];
    }
    if (changed) await writeStore(store);
  });
}

/**
 * Drop the entire bucket for an owner. Called when the owning rule /
 * folder / collection is deleted, so orphan runs don't accumulate.
 */
export async function deleteAllTestRunsForOwner(owner: TestRunOwner): Promise<void> {
  await withLock(async () => {
    const store = await readStore();
    const key = ownerKey(owner);
    if (store[key]) {
      delete store[key];
      await writeStore(store);
    }
  });
}

/**
 * Bulk cascade: drop every bucket whose owner id is no longer present
 * in `liveOwnerIds`. Called after a tree mutation finishes. This keeps
 * the storage clean even for mutations whose handler doesn't know about
 * test runs — adding a single sweep at the end is simpler than threading
 * deletion calls into every CRUD path.
 */
export async function pruneOrphanOwners(liveRuleIds: Set<string>, liveEntityIds: Set<string>): Promise<void> {
  await withLock(async () => {
    const store = await readStore();
    let changed = false;
    for (const key of Object.keys(store)) {
      const sep = key.indexOf(':');
      if (sep < 0) continue;
      const type = key.slice(0, sep) as TestRunOwnerType;
      const id = key.slice(sep + 1);
      // Workspace bucket is the singleton "all rules" history — never
      // pruned. The remaining types map to entities that can be deleted.
      if (type === 'workspace') continue;
      const alive = type === 'rule' ? liveRuleIds.has(id) : liveEntityIds.has(id);
      if (!alive) {
        delete store[key];
        changed = true;
      }
    }
    if (changed) await writeStore(store);
  });
}
