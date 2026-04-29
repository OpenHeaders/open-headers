/**
 * Collection scalar/setField + variable add race.
 *
 * Surface A renames the collection (`setField` on `name`); surface B
 * concurrently adds a collection-scoped variable (`addToSet` on
 * `variables`). These target different paths within the same entity;
 * convergence requires the rename and the variable add both land
 * regardless of total order — the §6.2 "killer demo" property
 * generalised to a third entity.
 *
 * Two diverging renames at distinct HLCs are also threaded through so
 * scalar LWW is exercised alongside the cross-path orthogonality
 * check. The variable add carries an explicit `orderKey` so
 * materialization is byte-stable across permutations.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCollectionRename(rng: Rng): Scenario {
  const collectionId = rng.uid('coll');
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const tA = 1_000 + rng.int(1_000);
  const tB = tA + 100 + rng.int(100);
  const newNameA = `Collection-A-${rng.int(0xffff).toString(16)}`;
  const newNameB = `Collection-B-${rng.int(0xffff).toString(16)}`;
  const varName = `VAR_${rng.int(0xff).toString(16)}`;

  const renameA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'collection', id: collectionId, path: 'name', value: newNameA },
  });
  const addVar = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'collection',
      id: collectionId,
      path: 'variables',
      itemId: varName,
      item: { name: varName, value: 'shared-value', type: 'default' },
      orderKey: 'a',
    },
  });
  const renameB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'collection', id: collectionId, path: 'name', value: newNameB },
  });

  return {
    name: `collection-rename(${collectionId}/${varName})`,
    envelopes: [renameA, addVar, renameB],
  };
}
