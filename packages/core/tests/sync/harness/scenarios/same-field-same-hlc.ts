/**
 * Two surfaces write the same field at structurally-equal physical+logical
 * HLC components but distinct nodeIds. compareHlc breaks the tie by
 * nodeId; both replays must agree on which value wins.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genSameFieldSameHlc(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const path = rng.pick(['name', 'enabled', 'description', 'priority']);
  const physical = 1_000 + rng.int(10_000);
  const logical = rng.int(5);
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const ws = 'ws-1';
  const envA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(physical, logical, nodeA),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'rule', id: entityId, path, value: `from-${nodeA}` },
  });
  const envB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(physical, logical, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'setField', type: 'rule', id: entityId, path, value: `from-${nodeB}` },
  });

  return { name: `same-field-same-hlc(${entityId}.${path})`, envelopes: [envA, envB] };
}
