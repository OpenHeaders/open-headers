/**
 * Tree containment — two-peer convergence (slice 3 of the tree
 * containment plan). Two peers edit one small rules tree offline
 * (create / move / delete of folders and rules), exchange every
 * envelope, and let their slot reconcilers heal the merge. After the
 * trees settle the invariants of the plan must hold on BOTH peers and
 * the peers must agree:
 *
 *   - every live child has exactly one live slot;
 *   - no folder cycle — every live folder resolves a path;
 *   - nothing is lost — every live child reaches a collection root;
 *   - order agrees — the containers and their slot lists are equal.
 *
 * Only cross-peer merges can shadow a slot, close a cycle or orphan a
 * child under a deleted container: each peer's own sequence is
 * well-formed (a move never enters its own subtree, a delete cascades
 * on its own view), exactly like the sidebar's gestures.
 */

import { hostStorage } from '@openheaders/core/storage';
import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  deleteFolder,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type FolderParentRef,
  type MutationEnvelope,
  type MutatorContext,
  moveFolder,
  ruleChild,
  WORKSPACE_ROOTS_REF,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Rule } from '@openheaders/core/types';
import { wsKeys } from '@openheaders/oracle/storage';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  projectAllFolders,
  projectFolderByUid,
  RULE_TREE,
} from '@openheaders/oracle/sync/post-state/folder-post-state';
import { treeConflicts, treeContainers } from '@openheaders/oracle/sync/post-state/folder-tree-post-state';
import { projectRuleByUid } from '@openheaders/oracle/sync/post-state/rule-post-state';
import { createTreeSlotReconciler, type TreeSlotReconciler } from '@openheaders/oracle/sync/tree-slot-reconciler';
import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import { installBackingStorage } from '../../helpers/chrome-storage-backing';
import { stressNumRuns } from './property-stress';

const WS = 'ws-tree-prop';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const COLLECTION: Collection = {
  schemaVersion: 5,
  uid: 'col00001',
  name: 'api',
  path: 'rules/api-col00001',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
} as unknown as Collection;

const makeRule = (uid: string, path: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path,
    type: 'header',
    name: uid,
    enabled: true,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  }) as unknown as Rule;

type Op =
  | { kind: 'createFolder'; pick: number; parentPick: number }
  | { kind: 'createRule'; pick: number; parentPick: number }
  | { kind: 'moveFolder'; pick: number; parentPick: number; key: string }
  | { kind: 'moveRule'; pick: number; parentPick: number; key: string }
  | { kind: 'deleteFolder'; pick: number }
  | { kind: 'deleteRule'; pick: number };

const KEYS = ['b', 'f', 'k', 'p', 'u'] as const;
const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('createFolder' as const), pick: fc.nat(99), parentPick: fc.nat(99) }),
  fc.record({ kind: fc.constant('createRule' as const), pick: fc.nat(99), parentPick: fc.nat(99) }),
  fc.record({
    kind: fc.constant('moveFolder' as const),
    pick: fc.nat(99),
    parentPick: fc.nat(99),
    key: fc.constantFrom(...KEYS),
  }),
  fc.record({
    kind: fc.constant('moveRule' as const),
    pick: fc.nat(99),
    parentPick: fc.nat(99),
    key: fc.constantFrom(...KEYS),
  }),
  fc.record({ kind: fc.constant('deleteFolder' as const), pick: fc.nat(99) }),
  fc.record({ kind: fc.constant('deleteRule' as const), pick: fc.nat(99) }),
);
const scriptArb = fc.array(opArb, { minLength: 1, maxLength: 6 });

class Peer {
  readonly oracle: EntityOracle;
  readonly reconciler: TreeSlotReconciler;
  readonly outbox: MutationEnvelope[] = [];
  private readonly seen = new Set<string>();
  private clock: number;
  private minted = 0;

  constructor(
    readonly nodeId: string,
    clockStart: number,
  ) {
    this.clock = clockStart;
    const broadcast = new InMemoryBroadcast();
    this.oracle = new EntityOracle({
      workspaceId: WS,
      lock,
      log: new InMemoryMutationLog(),
      intents: new InMemoryPendingIntents(),
      broadcast,
      schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    });
    broadcast.subscribe(({ envelope, outcome }) => {
      if (outcome.status !== 'applied' && outcome.status !== 'duplicate') return;
      if (this.seen.has(envelope.mutationId)) return;
      this.seen.add(envelope.mutationId);
      this.outbox.push(envelope);
    });
    this.reconciler = createTreeSlotReconciler(WS, this.oracle, broadcast, () => this.ctx());
  }

  ctx(): MutatorContext {
    this.clock += 7;
    return {
      workspaceId: WS,
      hlc: { physicalMs: this.clock, logical: 0, nodeId: this.nodeId },
      surfaceId: 's',
      deviceId: this.nodeId,
    };
  }

  uid(prefix: string): string {
    this.minted += 1;
    return `${prefix}${this.nodeId}${String(this.minted).padStart(4, '0')}`;
  }

  async local(batch: Parameters<EntityOracle['apply']>[0]): Promise<void> {
    const result = await this.oracle.apply(batch, [], 'local');
    expect(result.ok).toBe(true);
  }

  /** Apply another peer's envelopes as single frames, the way the wire
   *  relays them; the clock observes every received HLC so the next
   *  local mint orders after it (the sequencer's `observe`). */
  async receive(envelopes: readonly MutationEnvelope[]): Promise<void> {
    for (const envelope of envelopes) {
      this.clock = Math.max(this.clock, envelope.hlc.physicalMs);
      if (this.seen.has(envelope.mutationId)) continue;
      await this.oracle.apply({ batchId: `wire-${envelope.mutationId}`, mutations: [envelope] }, [], 'inbound');
    }
  }

  containers(): Array<FolderParentRef & { path: string }> {
    const { collections, folders } = treeContainers(this.oracle, RULE_TREE);
    const lift = (type: FolderParentRef['type']) => (c: { uid: string; path: string }) => ({
      type,
      uid: c.uid,
      path: c.path,
    });
    return [...collections.map(lift(COLLECTION_ENTITY_TYPE)), ...folders.map(lift(FOLDER_ENTITY_TYPE))];
  }

  liveFolders(): string[] {
    return projectAllFolders(this.oracle).map((f) => f.uid);
  }

  liveRules(): string[] {
    return this.oracle
      .materializeAll()
      .filter((m) => m.type === 'rule')
      .map((m) => m.id);
  }

  parentOf(uid: string, setPath: string): FolderParentRef | null {
    for (const container of this.containers()) {
      const slots = this.oracle.liveOrderedSetItems(container.type, container.uid, setPath);
      if (slots.some((s) => s.itemId === uid)) return { type: container.type, uid: container.uid };
    }
    return null;
  }

  async run(op: Op): Promise<void> {
    const containers = this.containers();
    const at = <T>(list: readonly T[], pick: number): T | undefined =>
      list.length ? list[pick % list.length] : undefined;
    switch (op.kind) {
      case 'createFolder': {
        const parent = at(containers, op.parentPick);
        if (!parent) return;
        const uid = this.uid('fol');
        await this.local(
          createFolder(this.ctx(), { folderUid: uid, parent: { type: parent.type, uid: parent.uid }, name: uid }).batch,
        );
        return;
      }
      case 'createRule': {
        const parent = at(containers, op.parentPick);
        if (!parent) return;
        const uid = this.uid('rul');
        await this.local(
          seedRule(makeRule(uid, `${parent.path}/${uid}-${uid}`), this.ctx(), {
            parent: { type: parent.type, uid: parent.uid },
          }),
        );
        return;
      }
      case 'moveFolder': {
        const folderUid = at(this.liveFolders(), op.pick);
        if (!folderUid) return;
        const own = projectFolderByUid(this.oracle, folderUid)?.folder.path;
        const oldParent = this.parentOf(folderUid, FOLDER_CHILDREN_PATH);
        const target = at(
          containers.filter((c) => own !== undefined && c.path !== own && !c.path.startsWith(`${own}/`)),
          op.parentPick,
        );
        if (!oldParent || !target) return;
        await this.local(
          moveFolder(this.ctx(), {
            folderUid,
            oldParent,
            newParent: { type: target.type, uid: target.uid },
            orderKey: op.key,
          }).batch,
        );
        return;
      }
      case 'moveRule': {
        const ruleUid = at(this.liveRules(), op.pick);
        const target = at(containers, op.parentPick);
        if (!ruleUid || !target) return;
        const oldParent = this.parentOf(ruleUid, FOLDER_ITEMS_PATH);
        if (!oldParent) return;
        await this.local(
          ruleChild.move(this.ctx(), {
            childUid: ruleUid,
            oldParent,
            newParent: { type: target.type, uid: target.uid },
            orderKey: op.key,
          }).batch,
        );
        return;
      }
      case 'deleteFolder': {
        const folderUid = at(this.liveFolders(), op.pick);
        if (!folderUid) return;
        const own = projectFolderByUid(this.oracle, folderUid)?.folder.path;
        const parent = this.parentOf(folderUid, FOLDER_CHILDREN_PATH);
        if (!parent || own === undefined) return;
        // Cascade on this peer's view: the descendants it knows about.
        const descendants = projectAllFolders(this.oracle).filter((f) => f.path.startsWith(`${own}/`));
        for (const uid of this.liveRules()) {
          const path = projectRuleByUid(this.oracle, uid)?.rule.path;
          if (path?.startsWith(`${own}/`)) await this.local(this.bare('rule', uid));
        }
        for (const folder of descendants) await this.local(this.bare(FOLDER_ENTITY_TYPE, folder.uid));
        await this.local(deleteFolder(this.ctx(), { folderUid, parent }).batch);
        return;
      }
      case 'deleteRule': {
        const ruleUid = at(this.liveRules(), op.pick);
        if (!ruleUid) return;
        const parent = this.parentOf(ruleUid, FOLDER_ITEMS_PATH);
        if (!parent) return;
        await this.local(ruleChild.delete(this.ctx(), { childUid: ruleUid, parent }).batch);
        return;
      }
    }
  }

  private bare(type: string, id: string): Parameters<EntityOracle['apply']>[0] {
    const ctx = this.ctx();
    return {
      batchId: `bare-${id}`,
      mutations: [
        {
          mutationId: `${this.nodeId}-${id}-${ctx.hlc.physicalMs}`,
          hlc: ctx.hlc,
          origin: { surfaceId: 's', deviceId: this.nodeId },
          workspaceId: WS,
          orgId: 'org-test',
          mutatorVersion: 1,
          body: { kind: 'delete', type, id },
        },
      ],
    };
  }
}

async function exchange(a: Peer, b: Peer): Promise<number> {
  const fromA = a.outbox.splice(0);
  const fromB = b.outbox.splice(0);
  await b.receive(fromA);
  await a.receive(fromB);
  return fromA.length + fromB.length;
}

/** Reconcile both peers and exchange until neither mints anything more. */
async function settle(a: Peer, b: Peer): Promise<void> {
  for (let round = 0; round < 12; round++) {
    await a.reconciler.reconcile(true);
    await b.reconciler.reconcile(true);
    if ((await exchange(a, b)) === 0) return;
  }
  throw new Error('trees did not settle');
}

function assertInvariants(peer: Peer): void {
  const containers = peer.containers();
  const live = new Set([...peer.liveFolders(), ...peer.liveRules()]);
  const slotCount = new Map<string, number>();
  for (const container of containers) {
    for (const setPath of [FOLDER_CHILDREN_PATH, FOLDER_ITEMS_PATH]) {
      for (const slot of peer.oracle.liveOrderedSetItems(container.type, container.uid, setPath)) {
        slotCount.set(slot.itemId, (slotCount.get(slot.itemId) ?? 0) + 1);
      }
    }
  }
  // One live slot per live child; no slot points at a dead child.
  for (const uid of live) expect(slotCount.get(uid), `slots of ${uid}`).toBe(1);
  for (const uid of slotCount.keys()) expect(live.has(uid), `dead child ${uid} still slotted`).toBe(true);
  // No cycle, nothing lost: every live folder projects a path (the
  // projection walks to a collection), every live rule sits under a
  // resolvable container.
  const allFolders = peer.oracle
    .materializeAll()
    .filter((m) => m.type === FOLDER_ENTITY_TYPE)
    .map((m) => m.id);
  expect(new Set(peer.liveFolders())).toEqual(new Set(allFolders));
  for (const uid of peer.liveRules()) {
    expect(projectRuleByUid(peer.oracle, uid)?.rule.path.startsWith(`${COLLECTION.path}/`), `rule ${uid} path`).toBe(
      true,
    );
    expect(peer.parentOf(uid, FOLDER_ITEMS_PATH), `rule ${uid} parent`).not.toBeNull();
  }
  const conflicts = treeConflicts(peer.oracle, RULE_TREE);
  expect(conflicts).toEqual({ shadowed: [], cycleVictims: [], deadSlots: [] });
}

function treeShape(peer: Peer): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const container of peer.containers()) {
    out[container.path] = [
      ...peer.oracle.liveOrderedSetItems(container.type, container.uid, FOLDER_CHILDREN_PATH).map((s) => s.itemId),
      ...peer.oracle.liveOrderedSetItems(container.type, container.uid, FOLDER_ITEMS_PATH).map((s) => s.itemId),
    ];
  }
  return out;
}

async function seedBase(peer: Peer): Promise<void> {
  await peer.local(seedCollection(COLLECTION, peer.ctx(), { parent: WORKSPACE_ROOTS_REF }));
  for (const uid of ['fol0base1', 'fol0base2']) {
    await peer.local(
      createFolder(peer.ctx(), {
        folderUid: uid,
        parent: { type: COLLECTION_ENTITY_TYPE, uid: COLLECTION.uid },
        name: uid,
      }).batch,
    );
  }
  await peer.local(
    createFolder(peer.ctx(), {
      folderUid: 'fol0base3',
      parent: { type: FOLDER_ENTITY_TYPE, uid: 'fol0base1' },
      name: 'fol0base3',
    }).batch,
  );
  await peer.local(
    seedRule(makeRule('rul0base1', `${COLLECTION.path}/rul0base1-rul0base1`), peer.ctx(), {
      parent: { type: COLLECTION_ENTITY_TYPE, uid: COLLECTION.uid },
    }),
  );
}

beforeEach(async () => {
  installBackingStorage();
  await hostStorage.set(wsKeys(WS).rules, []);
  await hostStorage.set(wsKeys(WS).collections, []);
});

describe('tree containment — two peers converge', () => {
  it('random offline edits on both peers merge into one well-formed, agreed tree', async () => {
    await fc.assert(
      fc.asyncProperty(scriptArb, scriptArb, fc.integer({ min: 0, max: 500 }), async (scriptA, scriptB, skew) => {
        const a = new Peer('A', 10_000);
        const b = new Peer('B', 10_000 + skew);
        await seedBase(a);
        await exchange(a, b);
        await settle(a, b);

        for (const op of scriptA) await a.run(op);
        for (const op of scriptB) await b.run(op);
        await exchange(a, b);
        await settle(a, b);

        assertInvariants(a);
        assertInvariants(b);
        expect(treeShape(a)).toEqual(treeShape(b));
        // Provenance is per peer (local vs inbound); the converged data is not.
        const data = (peer: Peer) =>
          peer.oracle.materializeAll().map((m) => ({ type: m.type, id: m.id, data: m.data }));
        expect(data(a)).toEqual(data(b));
        a.reconciler.dispose();
        b.reconciler.dispose();
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});
