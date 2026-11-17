/**
 * Deletes and restores of one entity among its edits, at HLCs in any
 * relation to each other. Tests the delete rule (§7.2): existence is
 * last-writer-wins between a `delete` and a restoring `create`, a
 * restore starts the entity over, and a plain create or an edit never
 * brings a deleted entity back. Convergence: regardless of apply
 * order, the entity is the same — a write that follows a restore in
 * HLC shows whether it arrived before it or after.
 */

import type { MutationBody } from '../../../../src/sync';
import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const FIELDS = ['name', 'description', 'enabled'] as const;
const SET_PATHS = ['headerMods', 'conditions'] as const;
const ITEM_IDS = ['a', 'b', 'c'] as const;

export function genDeleteRestoreOrder(rng: Rng): Scenario {
  const entityId = rng.uid('e');
  const nodes = [`node-${rng.int(0xffff).toString(16)}-a`, `node-${rng.int(0xffff).toString(16)}-b`];
  const ws = 'ws-1';
  const base = 1_000 + rng.int(1_000);

  const payload = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const field of FIELDS) {
      if (rng.int(2) === 0) out[field] = `p-${rng.int(100)}`;
    }
    return out;
  };

  const bodies: MutationBody[] = [{ kind: 'create', type: 'rule', id: entityId, payload: payload() }];
  const count = 4 + rng.int(8);
  for (let i = 0; i < count; i += 1) {
    const roll = rng.int(10);
    if (roll < 2) {
      bodies.push({ kind: 'delete', type: 'rule', id: entityId });
    } else if (roll < 4) {
      bodies.push({ kind: 'create', type: 'rule', id: entityId, payload: payload(), restore: true });
    } else if (roll < 5) {
      bodies.push({ kind: 'create', type: 'rule', id: entityId, payload: payload() });
    } else if (roll < 7) {
      bodies.push({ kind: 'setField', type: 'rule', id: entityId, path: rng.pick(FIELDS), value: `v-${rng.int(100)}` });
    } else if (roll < 8) {
      bodies.push({ kind: 'unsetField', type: 'rule', id: entityId, path: rng.pick(FIELDS) });
    } else if (roll < 9) {
      const itemId = rng.pick(ITEM_IDS);
      bodies.push({
        kind: 'addToSet',
        type: 'rule',
        id: entityId,
        path: rng.pick(SET_PATHS),
        itemId,
        item: { id: itemId, n: rng.int(100) },
      });
    } else {
      bodies.push({
        kind: 'removeFromSet',
        type: 'rule',
        id: entityId,
        path: rng.pick(SET_PATHS),
        itemId: rng.pick(ITEM_IDS),
      });
    }
  }

  // One HLC a body, distinct, in no relation to the body's position.
  const times = rng.shuffle(bodies.map((_, i) => base + i * 10));
  const envelopes = bodies.map((body, i) =>
    mintEnvelope({ workspaceId: ws, hlc: hlcAt(times[i], 0, rng.pick(nodes)), mutationId: rng.uid('m'), body }),
  );

  return { name: `delete-restore-order(${entityId})`, envelopes };
}
