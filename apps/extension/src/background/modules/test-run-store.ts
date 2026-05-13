/**
 * Test Run Store — owner-keyed persistence for completed test runs,
 * scoped to a single workspace.
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
 *   - A "Test All Rules" run lives in the per-workspace bucket
 *     (ownerType='workspace', ownerId = active workspace id).
 *   - When an owner is deleted, its bucket is dropped.
 *
 * Stale detection: at run-finish we snapshot a content hash for the
 * owner. On read we recompute the current hash and flag the run
 * `isStale: true` if it differs. The run itself is preserved.
 *
 * Storage: `oh.ws.<workspaceId>.testRuns` — single JSON value holding
 * `Record<ownerKey, StoredTestRun[]>`. Per-owner ring buffer cap so
 * one chatty owner cannot starve another.
 *
 * Workspace switch: the store's I/O path keys on the active workspace
 * id at call time — there is no in-memory cache, so switching is free.
 */

import type {
  CollectionTree,
  FolderNode,
  LoadedTestRun,
  Rule,
  StoredTestRun,
  TestRunOwner,
  TestRunOwnerType,
  TreeNode,
} from '@openheaders/core/types';
import { stableStringify } from '@/shared/forms/fingerprint';
import { extensionStorage, wsKeys } from '@/shared/storage';
import { getCollectionTrees, getRules } from './rule-store';
import { getActiveWorkspaceId } from './workspace-store';

export type {
  LoadedTestRun,
  StoredTestRun,
  TestFireEvent,
  TestRuleStatus,
  TestRunOwner,
  TestRunOwnerType,
} from '@openheaders/core/types';

// ── Constants ─────────────────────────────────────────────────────

const MAX_PER_OWNER = 20;

// ── Storage primitives ────────────────────────────────────────────

type Bucket = StoredTestRun[];
type StoreShape = Record<string, Bucket>;

function ownerKey(owner: TestRunOwner): string {
  return `${owner.type}:${owner.id}`;
}

async function readStore(workspaceId: string): Promise<StoreShape> {
  const raw = await extensionStorage.get(wsKeys(workspaceId).testRuns);
  return (raw as StoreShape | undefined) ?? {};
}

function writeStore(workspaceId: string, store: StoreShape): Promise<void> {
  return extensionStorage.set(wsKeys(workspaceId).testRuns, store as Record<string, unknown>);
}

/**
 * Serialize read-modify-write operations on the per-workspace
 * test-runs key. Without this, two concurrent finishes could read the
 * same prior state and each overwrite with its own union of one run.
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

// ── Owner content hashing ─────────────────────────────────────────

function hashableRuleContent(rule: Rule): unknown {
  return {
    uid: rule.uid,
    enabled: rule.enabled,
    type: rule.type,
    conditions: rule.conditions ?? [],
    action: (rule as { action?: unknown }).action ?? null,
  };
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

function collectDescendantRuleUids(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.type === 'rule') out.push(node.uid);
    else if (node.type === 'folder') out.push(...collectDescendantRuleUids(node.children));
  }
  return out;
}

function findFolderDescendantRuleUids(folderUid: string, trees: CollectionTree[]): string[] | null {
  for (const tree of trees) {
    const found = walkForFolder(folderUid, tree.tree);
    if (found) return collectDescendantRuleUids(found.children);
  }
  return null;
}

function walkForFolder(folderUid: string, nodes: TreeNode[]): FolderNode | null {
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
 * the owner no longer exists.
 */
export function computeOwnerHash(owner: TestRunOwner): string | null {
  const allRules = getRules();

  if (owner.type === 'workspace') {
    const sorted = [...allRules].sort((a, b) => a.uid.localeCompare(b.uid));
    return djb2(stableStringify({ workspace: sorted.map(hashableRuleContent) }));
  }

  if (owner.type === 'rule') {
    const rule = allRules.find((r) => r.uid === owner.id);
    if (!rule) return null;
    return djb2(stableStringify(hashableRuleContent(rule)));
  }

  const trees = getCollectionTrees();
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
  const payload = descendantUids.map((uid) => {
    const rule = ruleByUid.get(uid);
    return rule ? hashableRuleContent(rule) : { uid, missing: true };
  });
  return djb2(stableStringify({ uids: descendantUids, rules: payload }));
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Persist a finished test run into its owner bucket within the active
 * workspace. Ring-buffer trim keeps each bucket at MAX_PER_OWNER.
 * Idempotent on run id within the same bucket.
 */
export async function persistTestRun(run: StoredTestRun): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withLock(async () => {
    const store = await readStore(workspaceId);
    const key = ownerKey({ type: run.ownerType, id: run.ownerId });
    const bucket = store[key] ? [...store[key]] : [];
    const existingIdx = bucket.findIndex((s) => s.id === run.id);
    if (existingIdx >= 0) bucket[existingIdx] = run;
    else bucket.unshift(run);
    bucket.sort((a, b) => b.endedAt - a.endedAt);
    store[key] = bucket.slice(0, MAX_PER_OWNER);
    await writeStore(workspaceId, store);
  });
}

export async function listTestRunsForOwner(owner: TestRunOwner): Promise<LoadedTestRun[]> {
  const workspaceId = getActiveWorkspaceId();
  const store = await readStore(workspaceId);
  const bucket = store[ownerKey(owner)] ?? [];
  const currentHash = computeOwnerHash(owner);
  return bucket.map((s) => ({
    ...s,
    isStale: currentHash === null || currentHash !== s.ownerHashAtRun,
  }));
}

export async function listAllTestRuns(): Promise<LoadedTestRun[]> {
  const workspaceId = getActiveWorkspaceId();
  const store = await readStore(workspaceId);
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

export async function getTestRunById(id: string): Promise<LoadedTestRun | null> {
  const workspaceId = getActiveWorkspaceId();
  const store = await readStore(workspaceId);
  for (const bucket of Object.values(store)) {
    const found = bucket.find((s) => s.id === id);
    if (found) {
      const currentHash = computeOwnerHash({ type: found.ownerType, id: found.ownerId });
      return { ...found, isStale: currentHash === null || currentHash !== found.ownerHashAtRun };
    }
  }
  return null;
}

export async function deleteTestRunById(id: string): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withLock(async () => {
    const store = await readStore(workspaceId);
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
    if (changed) await writeStore(workspaceId, store);
  });
}

export async function deleteAllTestRunsForOwner(owner: TestRunOwner): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withLock(async () => {
    const store = await readStore(workspaceId);
    const key = ownerKey(owner);
    if (store[key]) {
      delete store[key];
      await writeStore(workspaceId, store);
    }
  });
}

/**
 * Bulk cascade: drop every bucket whose owner id is no longer present
 * in `liveOwnerIds` within the active workspace.
 */
export async function pruneOrphanOwners(liveRuleIds: Set<string>, liveEntityIds: Set<string>): Promise<void> {
  const workspaceId = getActiveWorkspaceId();
  await withLock(async () => {
    const store = await readStore(workspaceId);
    let changed = false;
    for (const key of Object.keys(store)) {
      const sep = key.indexOf(':');
      if (sep < 0) continue;
      const type = key.slice(0, sep) as TestRunOwnerType;
      const id = key.slice(sep + 1);
      // Workspace bucket is the "all rules" history for this workspace
      // and is keyed by the active workspace id at write time. Never
      // pruned from here — workspace deletion cascade drops the entire
      // `oh.ws.<id>.testRuns` key instead.
      if (type === 'workspace') continue;
      const alive = type === 'rule' ? liveRuleIds.has(id) : liveEntityIds.has(id);
      if (!alive) {
        delete store[key];
        changed = true;
      }
    }
    if (changed) await writeStore(workspaceId, store);
  });
}

/**
 * Drop the entire test-run key for a given workspace. Called when a
 * workspace is deleted. Safe to call for the currently active
 * workspace too.
 */
export async function purgeWorkspaceTestRuns(workspaceId: string): Promise<void> {
  await extensionStorage.remove(wsKeys(workspaceId).testRuns);
}
