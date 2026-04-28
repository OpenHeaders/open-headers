/**
 * Two surfaces concurrently rename the same entity (`name` field).
 * Both writes are setField at the same path on the same entity;
 * pure LWW-by-HLC, distinct nodeIds. Convergent under any order.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genConcurrentRenames(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const tA = 1_000 + rng.int(1_000);
  const tB = tA + (rng.int(2) === 0 ? -1 : 1);

  const renameA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'rule', id: entityId, path: 'name', value: `name-from-${nodeA}` },
  });
  const renameB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'rule', id: entityId, path: 'name', value: `name-from-${nodeB}` },
  });

  return { name: `concurrent-renames(${entityId})`, envelopes: [renameA, renameB] };
}
