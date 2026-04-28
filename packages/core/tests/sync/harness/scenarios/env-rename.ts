/**
 * Two surfaces concurrently rename the same env variable to two
 * different new names. Each rename is the catalog's atomic batch:
 * `removeFromSet(old) + addToSet(new)`. Convergence requires that
 * after all four envelopes apply in any total order, materialization
 * is identical: the old name is tombstoned (max-HLC removeFromSet
 * wins), each new name appears as its own entry (per-itemId LWW), and
 * the relative order of those two entries is determined by the order
 * keys.
 *
 * This is the core "atomic rename converges across surfaces" property
 * for §8 environment mutators. Using the generic `addToSet` /
 * `removeFromSet` envelopes — the catalog factory produces those — so
 * the harness's lock-protected store can apply them directly without
 * running the catalog itself.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genEnvRename(rng: Rng): Scenario {
  const envId = rng.uid('env');
  const oldName = `VAR_${rng.int(0xff).toString(16)}`;
  const newA = `${oldName}_A`;
  const newB = `${oldName}_B`;
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const tA = 1_000 + rng.int(1_000);
  // Distinct HLCs across the two renames so per-itemId LWW is unambiguous;
  // tA tombstones the old, tA's add seeds newA; tB does the same for newB.
  const tB = tA + 100 + rng.int(100);

  const removeA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type: 'environment', id: envId, path: 'variables', itemId: oldName },
  });
  const addA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'environment',
      id: envId,
      path: 'variables',
      itemId: newA,
      item: { name: newA, value: 'shared-value', type: 'default' },
      orderKey: 'a',
    },
  });
  const removeB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type: 'environment', id: envId, path: 'variables', itemId: oldName },
  });
  const addB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 1, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'environment',
      id: envId,
      path: 'variables',
      itemId: newB,
      item: { name: newB, value: 'shared-value', type: 'default' },
      orderKey: 'b',
    },
  });

  return {
    name: `env-rename(${envId}/${oldName}→{${newA},${newB}})`,
    envelopes: [removeA, addA, removeB, addB],
  };
}
