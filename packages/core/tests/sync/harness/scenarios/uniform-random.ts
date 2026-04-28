/**
 * Uniform-random control scenario. Mixes every mutation kind across a
 * small entity pool and a small disjoint-leaf path pool. Disjoint
 * leaves are an explicit harness constraint: parent/child path
 * overlap is out of scope until the rule-mutator session adds
 * ancestor-aware materialization.
 *
 * HLCs come from {@link HlcSequencer} so distinct events at one node
 * are always strictly-increasing — the same guarantee `advanceHlc`
 * provides at runtime. Without that, randomly-minted HLCs collide
 * and convergence becomes apply-order-dependent (which is a harness
 * bug, not a mutator bug).
 */

import type { MutationBody } from '../../../../src/sync';
import { mintEnvelope } from '../envelope-gen';
import { HlcSequencer } from '../hlc-sequencer';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const LEAF_PATHS = ['name', 'enabled', 'description', 'priority'];
const SET_PATHS = ['tags', 'bag'];
const NODES = ['a', 'b', 'c'];

export function genUniformRandom(rng: Rng): Scenario {
  const ws = 'ws-1';
  const entityCount = 1 + rng.int(3);
  const opCount = 4 + rng.int(12);
  const entityIds = Array.from({ length: entityCount }, () => rng.uid('e'));
  const itemPool = Array.from({ length: 1 + rng.int(3) }, () => rng.uid('i'));
  const seq = new HlcSequencer();

  const envelopes = [];
  for (let i = 0; i < opCount; i += 1) {
    const id = rng.pick(entityIds);
    const node = `node-${rng.pick(NODES)}`;
    const t = 1_000 + i * 5 + rng.int(50);
    const hlc = seq.next(node, t);

    const choice = rng.int(7);
    let body: MutationBody;
    if (choice === 0) {
      body = {
        kind: 'create',
        type: 'rule',
        id,
        payload: { name: `init-${id}`, enabled: rng.int(2) === 0 },
      };
    } else if (choice === 1) {
      body = { kind: 'delete', type: 'rule', id };
    } else if (choice === 2) {
      body = {
        kind: 'setField',
        type: 'rule',
        id,
        path: rng.pick(LEAF_PATHS),
        value: rng.uid('v'),
      };
    } else if (choice === 3) {
      body = { kind: 'unsetField', type: 'rule', id, path: rng.pick(LEAF_PATHS) };
    } else if (choice === 4) {
      const itemId = rng.pick(itemPool);
      body = {
        kind: 'addToSet',
        type: 'rule',
        id,
        path: rng.pick(SET_PATHS),
        itemId,
        item: { id: itemId, payload: rng.uid('p') },
      };
    } else if (choice === 5) {
      body = {
        kind: 'removeFromSet',
        type: 'rule',
        id,
        path: rng.pick(SET_PATHS),
        itemId: rng.pick(itemPool),
      };
    } else {
      body = {
        kind: 'setField',
        type: 'rule',
        id,
        path: rng.pick(LEAF_PATHS),
        value: rng.int(1_000),
      };
    }

    envelopes.push(mintEnvelope({ workspaceId: ws, hlc, mutationId: rng.uid('m'), body }));
  }
  return { name: `uniform-random(n=${opCount})`, envelopes };
}
