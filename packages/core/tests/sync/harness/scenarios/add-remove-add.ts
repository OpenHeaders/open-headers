/**
 * add → remove → add of the same set member, at three distinct HLCs in
 * any order. Stresses the (setItems, setTombstones) max-HLC-wins
 * combination. Every permutation must materialize identically: the
 * highest-HLC operation type per (path, itemId) decides presence.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genAddRemoveAdd(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const setPath = rng.pick(['headerMods', 'conditions', 'tags']);
  const itemId = rng.uid('i');
  const node = `node-${rng.int(0xffff).toString(16)}`;
  const ws = 'ws-1';

  const t1 = 1_000 + rng.int(1_000);
  const t2 = t1 + 10 + rng.int(100);
  const t3 = t2 + 10 + rng.int(100);

  const add1 = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(t1, 0, node),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: entityId,
      path: setPath,
      itemId,
      item: { id: itemId, v: 'first' },
    },
  });
  const remove = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(t2, 0, node),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type: 'rule', id: entityId, path: setPath, itemId },
  });
  const add2 = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(t3, 0, node),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: entityId,
      path: setPath,
      itemId,
      item: { id: itemId, v: 'second' },
    },
  });

  return { name: `add-remove-add(${entityId}.${setPath}/${itemId})`, envelopes: [add1, remove, add2] };
}
