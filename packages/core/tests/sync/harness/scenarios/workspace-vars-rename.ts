/**
 * Two surfaces concurrently rename the same workspace variable to two
 * different new names. Each rename is the catalog's atomic batch:
 * `removeFromSet(old) + addToSet(new)`. Convergence requires that
 * after all four envelopes apply in any total order, materialization
 * is identical: the old name is tombstoned (max-HLC removeFromSet
 * wins), each new name appears as its own entry (per-itemId LWW), and
 * the relative order of those two entries is determined by the order
 * keys.
 *
 * Mirrors `env-rename.ts` / `collection-rename.ts` — the singleton
 * workspace-variables entity uses the fixed id `workspace-vars`.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genWorkspaceVarsRename(rng: Rng): Scenario {
  const oldName = `VAR_${rng.int(0xff).toString(16)}`;
  const newA = `${oldName}_A`;
  const newB = `${oldName}_B`;
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const tA = 1_000 + rng.int(1_000);
  const tB = tA + 100 + rng.int(100);

  const id = 'workspace-vars';
  const type = 'workspace-variables';
  const path = 'variables';

  const removeA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type, id, path, itemId: oldName },
  });
  const addA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type,
      id,
      path,
      itemId: newA,
      item: { name: newA, value: 'shared-value', type: 'default' },
      orderKey: 'a',
    },
  });
  const removeB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type, id, path, itemId: oldName },
  });
  const addB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 1, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type,
      id,
      path,
      itemId: newB,
      item: { name: newB, value: 'shared-value', type: 'default' },
      orderKey: 'b',
    },
  });

  return {
    name: `workspace-vars-rename(${oldName}→{${newA},${newB}})`,
    envelopes: [removeA, addA, removeB, addB],
  };
}
