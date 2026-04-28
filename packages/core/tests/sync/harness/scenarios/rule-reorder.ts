/**
 * Rule reorder under contention: three header mods seeded onto a rule,
 * then two surfaces concurrently move different items at different
 * HLCs while a third surface deletes one of them. Exercises:
 *   - moveBefore LWW-by-(setPath,itemId) under interleaving
 *   - delete-wins-absolutely intersecting reorders
 *   - removeFromSet hiding an item the other surface tried to move
 *
 * The convergence invariant is byte-identical materialization across
 * any total order — fractional indexing only buys us a deterministic
 * sort key per item, the lock-protected interleaver is what proves
 * convergence under arbitrary timing.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const SET_PATH = 'action.requestHeaders';

export function genRuleReorder(rng: Rng): Scenario {
  const ruleId = rng.uid('r');
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  const itemAlpha = rng.uid('h');
  const itemBeta = rng.uid('h');
  const itemGamma = rng.uid('h');

  const tBase = 1_000 + rng.int(1_000);

  // Seed three mods at distinct HLCs.
  const seedAlpha = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: ruleId,
      path: SET_PATH,
      itemId: itemAlpha,
      item: { operation: 'override', headerName: 'X-Alpha', value: 'a' },
    },
  });
  const seedBeta = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 1, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: ruleId,
      path: SET_PATH,
      itemId: itemBeta,
      item: { operation: 'override', headerName: 'X-Beta', value: 'b' },
    },
  });
  const seedGamma = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 2, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: ruleId,
      path: SET_PATH,
      itemId: itemGamma,
      item: { operation: 'override', headerName: 'X-Gamma', value: 'g' },
    },
  });

  // Concurrent reorders + a delete of one of the items. Order keys
  // are writer-committed at emit time (§7.2 contract); the property
  // tests don't care about the absolute lex values, only that the
  // store converges under any apply order.
  const tMove = tBase + 50 + rng.int(50);
  const moveAlphaToEnd = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tMove, 0, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'moveBefore',
      type: 'rule',
      id: ruleId,
      path: SET_PATH,
      itemId: itemAlpha,
      orderKey: 'zz',
    },
  });
  const moveBetaToFront = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tMove + (rng.int(2) === 0 ? -5 : 5), 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'moveBefore',
      type: 'rule',
      id: ruleId,
      path: SET_PATH,
      itemId: itemBeta,
      orderKey: 'ab',
    },
  });
  const removeGamma = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tMove + 100 + rng.int(50), 0, nodeC),
    mutationId: rng.uid('m'),
    body: { kind: 'removeFromSet', type: 'rule', id: ruleId, path: SET_PATH, itemId: itemGamma },
  });

  return {
    name: `rule-reorder(${ruleId})`,
    envelopes: [seedAlpha, seedBeta, seedGamma, moveAlphaToEnd, moveBetaToFront, removeGamma],
  };
}
