/**
 * create + delete on the same entity at varying HLC orderings. Tests
 * delete-wins-absolutely (§7.2): once any delete tombstone exists,
 * later creates with the same id drop. Convergence: regardless of
 * apply order, the entity is absent from materialized output.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCreateDeleteHlcOrder(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const node = `node-${rng.int(0xffff).toString(16)}`;
  const ws = 'ws-1';

  const tCreate = 1_000 + rng.int(1_000);
  const tDelete = tCreate + (rng.int(2) === 0 ? -50 : 50);

  const create = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tCreate, 0, node),
    mutationId: rng.uid('m'),
    body: {
      kind: 'create',
      type: 'rule',
      id: entityId,
      payload: { name: 'r', enabled: true, headerMods: [{ op: 'set', name: 'x', value: 'y' }] },
    },
  });
  const del = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tDelete, 0, node),
    mutationId: rng.uid('m'),
    body: { kind: 'delete', type: 'rule', id: entityId },
  });

  return { name: `create-delete-order(${entityId})`, envelopes: [create, del] };
}
