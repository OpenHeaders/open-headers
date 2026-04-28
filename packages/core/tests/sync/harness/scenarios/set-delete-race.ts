/**
 * setField race against entity delete at varying HLCs. Tests
 * delete-wins-absolutely: tombstones suppress materialization
 * regardless of whether they arrived before or after the field
 * write, and regardless of HLC ordering between the two.
 *
 * The "move + delete race" the design doc calls out becomes this
 * once moveBefore lands; for Phase A we exercise the same conflict
 * shape on `setField`.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genSetDeleteRace(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const path = rng.pick(['name', 'description', 'enabled']);
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const ws = 'ws-1';

  const t1 = 1_000 + rng.int(1_000);
  const t2 = t1 + (rng.int(2) === 0 ? -50 : 50);

  const setEnv = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(t1, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: 'rule',
      id: entityId,
      path,
      value: `set-from-${nodeA}`,
    },
  });
  const delEnv = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(t2, 0, nodeB),
    mutationId: rng.uid('m'),
    body: { kind: 'delete', type: 'rule', id: entityId },
  });

  return { name: `set-delete-race(${entityId}.${path})`, envelopes: [setEnv, delEnv] };
}
