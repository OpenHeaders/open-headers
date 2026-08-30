/**
 * Shared tree index + path resolution for the three sidebar trees
 * (rules, requests, templates).
 *
 * Each tree has the same shape: a root entity type ("collection") and
 * a folder entity type that may nest under either kind; every
 * container owns two ordered sets — `folders` then `items` — whose
 * slots are the ONE containment authority. A folder's `path` and a
 * leaf's `path` are both projections of the parent walk (§23.5, the
 * tree containment plan): parent path + the child's frozen
 * `pathSegment`. Linkage that can't be resolved (mid-batch boot
 * replay; tombstoned parent) is reported as `null`; folder caches
 * republish once the chain becomes resolvable, leaf projectors keep
 * the stored path as the net.
 *
 * The index is one pass over `materializeAll()` — every live slot of
 * every container inverted into `childUid → (parent, position)` plus a
 * memo of resolved absolute paths — and it is memoized per oracle
 * revision: the index runs on every tree-affecting broadcast and on
 * every per-uid snapshot projection, so rebuilding it per call would
 * turn bulk seeding and cold-mount snapshots quadratic.
 *
 * Merged state is not always well-formed, and the index is where the
 * conflict rules of the tree containment plan become deterministic on
 * every peer: a child in two live slots keeps the one with the higher
 * add-HLC (the other is SHADOWED — invisible to the projection); a
 * cycle among folders is broken at the slot with the lowest add-HLC
 * (that child becomes a CYCLE VICTIM — slot-less until rehomed). Both
 * are reported through `treeConflicts` so the slot reconciler can heal
 * the store to match the projection.
 *
 * Caches don't read each other; this projector reads everything off
 * the shared oracle, which already holds collection + folder + leaf
 * state in one document store.
 */

import {
  compareHlc,
  type HLC,
  type MaterializedEntity,
  type MutationBody,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras } from './flat-entity-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

/**
 * Per-tree configuration. The two entity-type constants + the two set
 * paths are the only branch identity the walker needs; the projector
 * pair lifts each materialized entity into its `Collection` /
 * `Folder` shape.
 */
export interface FolderTreeKinds<C extends string = string, F extends string = string> {
  collectionType: C;
  folderType: F;
  childrenPath: string;
  /** The parent's ordered leaf set (`items`) — order keys ride the post-state next to `folders`. */
  itemsPath: string;
  /** Further set paths on the folder entity whose order keys ride the post-state (the auth pool). */
  folderSetPaths?: readonly string[];
  projectCollection: (materialized: MaterializedEntity) => Collection | null;
  projectFolder: (materialized: MaterializedEntity, parentPath: string) => Folder | null;
}

/**
 * Per-envelope post-state: only fires for envelopes whose body targets
 * the folder entity directly. Envelopes that touch a parent's
 * `folders` set republish through the cache's full-refresh path
 * (paths can shift when a parent renames or reparents).
 */
export interface FolderPostStateProjection {
  folder: Folder;
  /** Live `(itemId, orderKey)` pairs at the folder's own `folders` and
   *  `items` sets — the slot lists for nested child folders and leaves.
   *  Keyed by setPath for shape consistency with other entities. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export function projectFolderPostStateGeneric<C extends string, F extends string>(
  oracle: Reads,
  envelope: MutationEnvelope,
  kinds: FolderTreeKinds<C, F>,
): FolderPostStateProjection | null {
  if (envelope.body.type !== kinds.folderType) return null;
  return projectFolderByUidGeneric(oracle, envelope.body.id, kinds);
}

/**
 * Project a known folder uid. Used by the snapshot RPC + the cache's
 * broadcast-driven refresh path.
 */
export function projectFolderByUidGeneric<C extends string, F extends string>(
  oracle: Reads,
  folderUid: string,
  kinds: FolderTreeKinds<C, F>,
): FolderPostStateProjection | null {
  const materialized = oracle.materializeOne(kinds.folderType, folderUid);
  if (!materialized) return null;

  const index = treeIndex(oracle, kinds);
  const parentPath = resolveParentPath(oracle, index, folderUid, kinds);
  if (parentPath === null) return null;

  const folder = kinds.projectFolder(materialized, parentPath);
  if (!folder) return null;

  return {
    folder,
    setOrderKeys: buildSetMembersExtras(oracle, kinds.folderType, folderUid, [
      kinds.childrenPath,
      kinds.itemsPath,
      ...(kinds.folderSetPaths ?? []),
    ]).setOrderKeys,
  };
}

/**
 * Project every folder the oracle holds under this tree, in tree
 * order (parent path, then slot position). Skips folders whose parent
 * linkage isn't currently resolvable; those republish once their
 * parent slot lands. The persisted array's order is what boot-time
 * seeding replays, so this order IS the folder order across restarts.
 */
export function projectAllFoldersGeneric<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): Folder[] {
  const index = treeIndex(oracle, kinds);
  const out: Array<{ folder: Folder; key: TreeOrderKey }> = [];
  for (const m of index.materialized) {
    if (m.type !== kinds.folderType) continue;
    const parentPath = resolveParentPath(oracle, index, m.id, kinds);
    if (parentPath === null) continue;
    const folder = kinds.projectFolder(m, parentPath);
    if (folder) out.push({ folder, key: { parentPath, position: index.parentOf.get(m.id)?.position ?? UNSLOTTED } });
  }
  out.sort((a, b) => compareTreeOrder(a.key, a.folder.uid, b.key, b.folder.uid));
  return out.map((entry) => entry.folder);
}

/**
 * Absolute path of a leaf's live parent — `null` when the leaf has no
 * live slot on this tree or its parent chain doesn't terminate at a
 * collection. Leaf projectors compose `path` from it (`leaf-path.ts`).
 */
export function resolveLeafParentPath<C extends string, F extends string>(
  oracle: Reads,
  leafUid: string,
  kinds: FolderTreeKinds<C, F>,
): string | null {
  return resolveParentPath(oracle, treeIndex(oracle, kinds), leafUid, kinds);
}

/**
 * A leaf's ancestor chain, outer → inner: the owning collection, then
 * every folder down to the leaf's parent — read off the slot index
 * (the containment authority), never off the leaf's stored path. A
 * slot-less leaf (an old-client create the reconciler has not reached,
 * the boot window before slots land) nets by its stored path's parent
 * — the same net the tree walks apply — and from that container up the
 * chain is slots again. Empty when the leaf sits in no tree (a scratch
 * draft) or the chain does not terminate at a collection (a cycle
 * victim mid-heal). The composed concerns — auth inheritance, the
 * script chain, the collection scope — all read this one primitive.
 */
export function ancestorChain<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
  leaf: { uid: string; path: string },
): ParentRef[] {
  const index = treeIndex(oracle, kinds);
  let node: ParentRef | undefined = index.parentOf.get(leaf.uid)?.parent;
  if (node === undefined) {
    const storedParent = parentPathOf(leaf.path);
    if (storedParent === null) return [];
    const containers = treeContainers(oracle, kinds);
    const collection = containers.collections.find((c) => c.path === storedParent);
    const folder = collection === undefined ? containers.folders.find((f) => f.path === storedParent) : undefined;
    if (collection) node = { type: kinds.collectionType, uid: collection.uid };
    else if (folder) node = { type: kinds.folderType, uid: folder.uid };
    else return [];
  }
  const chain: ParentRef[] = [];
  const visited = new Set<string>();
  while (node !== undefined) {
    const key = nodeKey(node);
    if (visited.has(key)) return [];
    visited.add(key);
    chain.push(node);
    if (node.type === kinds.collectionType) {
      chain.reverse();
      return chain;
    }
    node = index.parentOf.get(node.uid)?.parent;
  }
  return [];
}

/**
 * Arrange projected leaves in tree order: by parent path (the live
 * parent's when slotted, the stored path's parent otherwise), then by
 * slot position with slot-less leaves after the slotted run, then by
 * uid. The persisted array carries this order to the next boot, where
 * path-derived seeding mints ascending keys from it.
 */
export function arrangeInTreeOrder<C extends string, F extends string, E extends { uid: string; path: string }>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
  entities: E[],
): E[] {
  const index = treeIndex(oracle, kinds);
  const keyed = entities.map((entity) => {
    const slot = index.parentOf.get(entity.uid);
    const livePath = slot ? resolveNodePath(oracle, index, slot.parent, kinds, new Set()) : null;
    return {
      entity,
      key: {
        parentPath: livePath ?? parentPathOf(entity.path) ?? '',
        position: slot && livePath !== null ? slot.position : UNSLOTTED,
      },
    };
  });
  keyed.sort((a, b) => compareTreeOrder(a.key, a.entity.uid, b.key, b.entity.uid));
  return keyed.map((entry) => entry.entity);
}

/** The container lists a path → parent-ref resolver needs, off the live tree. */
export interface TreeContainers {
  collections: Array<{ uid: string; path: string }>;
  folders: Array<{ uid: string; path: string }>;
}

export function treeContainers<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): TreeContainers {
  const index = treeIndex(oracle, kinds);
  if (index.containers) return index.containers;
  const collections: TreeContainers['collections'] = [];
  const folders: TreeContainers['folders'] = [];
  for (const m of index.materialized) {
    if (m.type !== kinds.collectionType && m.type !== kinds.folderType) continue;
    const path = resolveNodePath(oracle, index, { type: m.type, uid: m.id }, kinds, new Set());
    if (path === null) continue;
    (m.type === kinds.collectionType ? collections : folders).push({ uid: m.id, path });
  }
  index.containers = { collections, folders };
  return index.containers;
}

/** Whether a leaf uid holds a live slot on this tree. */
export function hasTreeSlot<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
  uid: string,
): boolean {
  return treeIndex(oracle, kinds).parentOf.has(uid);
}

/** The materialized snapshot the current index was built from. */
export function treeMaterialized<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): MaterializedEntity[] {
  return treeIndex(oracle, kinds).materialized;
}

/**
 * Whether a committed envelope moved, added or removed a slot on this
 * tree — the parent's `folders` or `items` set. Every projection that
 * depends on containment (folder paths, leaf paths, tree order)
 * re-projects on these; a container's own scalar edits (rename) never
 * shift a path because segments are frozen.
 */
export function affectsTreeContainment<C extends string, F extends string>(
  body: MutationBody,
  kinds: FolderTreeKinds<C, F>,
): boolean {
  if (body.type !== kinds.collectionType && body.type !== kinds.folderType) return false;
  return 'path' in body && (body.path === kinds.childrenPath || body.path === kinds.itemsPath);
}

/**
 * The slots the index dropped from the projection this revision —
 * what the reconciler heals. `shadowed`: the losing slot of a child
 * that sits in two live parents. `cycleVictims`: the lowest-add-HLC
 * slot of each folder cycle, whose child now has NO live slot in the
 * projection and must be rehomed. `deadSlots`: slots whose child is
 * not live — a move merged with a concurrent delete of the child
 * (delete-wins on the child, the slot is garbage). All carry the
 * slot's marker + key so the healing batch can tombstone it and the
 * rehome entry can record where the child came from.
 */
export interface TreeConflicts {
  shadowed: TreeSlotRecord[];
  cycleVictims: TreeSlotRecord[];
  deadSlots: TreeSlotRecord[];
}

export interface TreeSlotRecord {
  childUid: string;
  parent: { type: string; uid: string };
  setPath: string;
  item: unknown;
  orderKey: string;
}

export function treeConflicts<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): TreeConflicts {
  const index = treeIndex(oracle, kinds);
  return { shadowed: index.shadowed, cycleVictims: index.cycleVictims, deadSlots: index.deadSlots };
}

// ── Index ────────────────────────────────────────────────────────────

export interface ParentRef {
  type: string;
  uid: string;
}

interface SlotRef {
  parent: ParentRef;
  position: number;
  setPath: string;
  item: unknown;
  orderKey: string;
  addHlc: HLC;
}

/**
 * One-pass view of the tree: every live parent slot — folders and
 * leaves — inverted into a `childUid → (parent, position)` map, plus a
 * memo of resolved absolute paths. Parent linkage is unique per child
 * in well-formed state (each uid occupies one slot); a child that
 * shows up in two live slots keeps the higher add-HLC one (parent
 * `type:uid` breaks a tie) and the loser lands in `shadowed`; a folder
 * cycle loses its lowest-add-HLC slot to `cycleVictims`.
 */
interface FolderTreeIndex {
  revision: number;
  materialized: MaterializedEntity[];
  parentOf: Map<string, SlotRef>;
  /** Memoized absolute path per `type:uid` node; null = unresolvable. */
  pathOf: Map<string, string | null>;
  containers: TreeContainers | null;
  shadowed: TreeSlotRecord[];
  cycleVictims: TreeSlotRecord[];
  deadSlots: TreeSlotRecord[];
}

const indexMemo = new WeakMap<object, Map<string, FolderTreeIndex>>();

function treeIndex<C extends string, F extends string>(oracle: Reads, kinds: FolderTreeKinds<C, F>): FolderTreeIndex {
  let perTree = indexMemo.get(oracle);
  if (!perTree) {
    perTree = new Map();
    indexMemo.set(oracle, perTree);
  }
  const hit = perTree.get(kinds.folderType);
  if (hit && hit.revision === oracle.revision) return hit;

  const revision = oracle.revision;
  const materialized = oracle.materializeAll();
  const parentOf = new Map<string, SlotRef>();
  const shadowed: TreeSlotRecord[] = [];
  const deadSlots: TreeSlotRecord[] = [];
  const liveIds = new Set(materialized.map((m) => m.id));
  for (const m of materialized) {
    if (m.type !== kinds.collectionType && m.type !== kinds.folderType) continue;
    const parent: ParentRef = { type: m.type, uid: m.id };
    for (const setPath of [kinds.childrenPath, kinds.itemsPath]) {
      const slots = oracle.liveOrderedSetItems(m.type, m.id, setPath);
      for (let position = 0; position < slots.length; position++) {
        const entry = slots[position];
        const slot: SlotRef = {
          parent,
          position,
          setPath,
          item: entry.item,
          orderKey: entry.key,
          addHlc: entry.addHlc,
        };
        if (!liveIds.has(entry.itemId)) {
          deadSlots.push(slotRecord(entry.itemId, slot));
          continue;
        }
        const held = parentOf.get(entry.itemId);
        if (!held) {
          parentOf.set(entry.itemId, slot);
          continue;
        }
        if (outranks(slot, held)) {
          shadowed.push(slotRecord(entry.itemId, held));
          parentOf.set(entry.itemId, slot);
        } else {
          shadowed.push(slotRecord(entry.itemId, slot));
        }
      }
    }
  }
  const cycleVictims = breakCycles(materialized, parentOf, kinds);
  const index: FolderTreeIndex = {
    revision,
    materialized,
    parentOf,
    pathOf: new Map(),
    containers: null,
    shadowed,
    cycleVictims,
    deadSlots,
  };
  perTree.set(kinds.folderType, index);
  return index;
}

/** Higher add-HLC wins; equal HLCs (same node, same tick) fall back to the parent key. */
function outranks(candidate: SlotRef, held: SlotRef): boolean {
  const byHlc = compareHlc(candidate.addHlc, held.addHlc);
  if (byHlc !== 0) return byHlc > 0;
  return nodeKey(candidate.parent) > nodeKey(held.parent);
}

function slotRecord(childUid: string, slot: SlotRef): TreeSlotRecord {
  return { childUid, parent: slot.parent, setPath: slot.setPath, item: slot.item, orderKey: slot.orderKey };
}

/**
 * Folder cycles (a folder moved into its own descendant on another
 * peer) are broken at the cycle's lowest-add-HLC slot — the earliest
 * of the competing moves loses, on every peer alike. The victim's
 * slot leaves `parentOf` so the rest of the cycle resolves through it
 * to "no parent" until the reconciler rehomes the victim. One walk per
 * folder with tri-state marks keeps the pass linear.
 */
function breakCycles<C extends string, F extends string>(
  materialized: MaterializedEntity[],
  parentOf: Map<string, SlotRef>,
  kinds: FolderTreeKinds<C, F>,
): TreeSlotRecord[] {
  const victims: TreeSlotRecord[] = [];
  const mark = new Map<string, 'open' | 'done'>();
  for (const m of materialized) {
    if (m.type !== kinds.folderType || mark.has(m.id)) continue;
    const trail: string[] = [];
    let cursor: string | undefined = m.id;
    while (cursor !== undefined) {
      const state = mark.get(cursor);
      if (state === 'done') break;
      if (state === 'open') {
        const victim = breakCycle(trail.slice(trail.indexOf(cursor)), parentOf);
        if (victim) victims.push(victim);
        break;
      }
      mark.set(cursor, 'open');
      trail.push(cursor);
      const slot = parentOf.get(cursor);
      cursor = slot && slot.parent.type === kinds.folderType ? slot.parent.uid : undefined;
    }
    for (const uid of trail) mark.set(uid, 'done');
  }
  return victims;
}

function breakCycle(cycle: string[], parentOf: Map<string, SlotRef>): TreeSlotRecord | null {
  let victim: { uid: string; slot: SlotRef } | null = null;
  for (const uid of cycle) {
    const slot = parentOf.get(uid);
    if (!slot) continue;
    if (!victim || compareHlc(slot.addHlc, victim.slot.addHlc) < 0) victim = { uid, slot };
  }
  if (!victim) return null;
  parentOf.delete(victim.uid);
  return slotRecord(victim.uid, victim.slot);
}

function nodeKey(node: ParentRef): string {
  return `${node.type}:${node.uid}`;
}

/**
 * Resolve the absolute path of `childUid`'s parent via the index.
 * Returns null when the child has no live parent slot or the chain
 * doesn't terminate at a collection.
 */
function resolveParentPath<C extends string, F extends string>(
  oracle: Reads,
  index: FolderTreeIndex,
  childUid: string,
  kinds: FolderTreeKinds<C, F>,
): string | null {
  const slot = index.parentOf.get(childUid);
  if (!slot) return null;
  return resolveNodePath(oracle, index, slot.parent, kinds, new Set());
}

/**
 * Absolute path of a collection or folder node, memoized on the index.
 * The index has already broken every folder cycle, so the visiting
 * guard is a pure safety net against recursing forever.
 */
function resolveNodePath<C extends string, F extends string>(
  oracle: Reads,
  index: FolderTreeIndex,
  node: ParentRef,
  kinds: FolderTreeKinds<C, F>,
  visiting: Set<string>,
): string | null {
  const key = nodeKey(node);
  const memo = index.pathOf.get(key);
  if (memo !== undefined) return memo;
  if (visiting.has(key)) return null;
  visiting.add(key);

  let path: string | null = null;
  if (node.type === kinds.collectionType) {
    const collMat = oracle.materializeOne(kinds.collectionType, node.uid);
    const coll = collMat ? kinds.projectCollection(collMat) : null;
    path = coll ? coll.path : null;
  } else {
    const slot = index.parentOf.get(node.uid);
    const parentPath = slot ? resolveNodePath(oracle, index, slot.parent, kinds, visiting) : null;
    if (parentPath !== null) {
      const folderMat = oracle.materializeOne(kinds.folderType, node.uid);
      const folder = folderMat ? kinds.projectFolder(folderMat, parentPath) : null;
      path = folder ? folder.path : null;
    }
  }

  visiting.delete(key);
  index.pathOf.set(key, path);
  return path;
}

// ── Tree order ───────────────────────────────────────────────────────

interface TreeOrderKey {
  parentPath: string;
  position: number;
}

/** Slot-less children sort after every slotted sibling. */
const UNSLOTTED = Number.POSITIVE_INFINITY;

function compareTreeOrder(a: TreeOrderKey, aUid: string, b: TreeOrderKey, bUid: string): number {
  if (a.parentPath !== b.parentPath) return a.parentPath < b.parentPath ? -1 : 1;
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return aUid < bUid ? -1 : aUid > bUid ? 1 : 0;
}
