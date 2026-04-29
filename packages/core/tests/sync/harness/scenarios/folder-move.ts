/**
 * Folder reorder + reparent under contention.
 *
 * Three folders are seeded as children of a single parent collection
 * (one `addToSet` per folder slot at distinct HLCs). Then two surfaces
 * concurrently move different folders at different HLCs while a third
 * surface reparents one of them under a sibling parent. Exercises:
 *   - moveBefore LWW-by-(setPath, itemId) on the parent's `folders` set
 *     under interleaving
 *   - removeFromSet + addToSet (the reparent case) interleaving with
 *     intra-parent moves
 *   - itemId tie-break under accidentally-equal order keys
 *
 * The folder entity itself is untouched by these envelopes — slot
 * identity (the folder uid) is the only thing the parent's set carries.
 * Convergence holds because every wire-resident `orderKey` is
 * deterministic and per-(setPath, itemId) LWW is what the engine
 * applies.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const PARENT_TYPE = 'collection';
const SLOT_PATH = 'folders';
const SECOND_PARENT_TYPE = 'collection';

export function genFolderMove(rng: Rng): Scenario {
  const parentA = rng.uid('col');
  const parentB = rng.uid('col');
  const ws = 'ws-1';
  const seedNode = `node-${rng.int(0xffff).toString(16)}-s`;
  const moverA = `node-${rng.int(0xffff).toString(16)}-a`;
  const moverB = `node-${rng.int(0xffff).toString(16)}-b`;
  const reparenter = `node-${rng.int(0xffff).toString(16)}-r`;

  const fAlpha = rng.uid('f');
  const fBeta = rng.uid('f');
  const fGamma = rng.uid('f');

  const tBase = 1_000 + rng.int(1_000);

  const seedAlpha = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fAlpha,
      item: { uid: fAlpha },
      orderKey: 'm',
    },
  });
  const seedBeta = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 1, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fBeta,
      item: { uid: fBeta },
      orderKey: 'q',
    },
  });
  const seedGamma = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tBase + 2, 0, seedNode),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fGamma,
      item: { uid: fGamma },
      orderKey: 'u',
    },
  });

  const tMove = tBase + 50 + rng.int(50);
  const moveAlphaToFront = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tMove, 0, moverA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'moveBefore',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fAlpha,
      orderKey: 'a',
    },
  });
  const moveBetaToEnd = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tMove + (rng.int(2) === 0 ? -5 : 5), 0, moverB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'moveBefore',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fBeta,
      orderKey: 'zz',
    },
  });

  // Reparent gamma to parentB. removeFromSet on the source is paired
  // with an addToSet on the target carrying a fresh order key. Both
  // sides land — convergence isolates by (parent, itemId).
  const tReparent = tMove + 100 + rng.int(50);
  const reparentRemove = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tReparent, 0, reparenter),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: PARENT_TYPE,
      id: parentA,
      path: SLOT_PATH,
      itemId: fGamma,
    },
  });
  const reparentAdd = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tReparent, 1, reparenter),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: SECOND_PARENT_TYPE,
      id: parentB,
      path: SLOT_PATH,
      itemId: fGamma,
      item: { uid: fGamma },
      orderKey: 'h',
    },
  });

  return {
    name: `folder-move(${fAlpha},${fBeta},${fGamma}@${parentA}→${parentB})`,
    envelopes: [seedAlpha, seedBeta, seedGamma, moveAlphaToFront, moveBetaToEnd, reparentRemove, reparentAdd],
  };
}
