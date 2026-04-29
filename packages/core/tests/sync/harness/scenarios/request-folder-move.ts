/**
 * Request-folder reorder + reparent under contention.
 *
 * Mirrors `folder-move.ts` against the request-folder entity types
 * (`request-collection` parent, `request-folder` child slot). The
 * convergence engine doesn't care about routing keys per se — this
 * bucket is explicit coverage that the new types pass through the
 * per-(setPath, itemId) LWW path with the same determinism.
 *
 * Three folders seeded as children of one parent request collection,
 * then two surfaces concurrently move different folders while a third
 * surface reparents one of them under a sibling request collection.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const PARENT_TYPE = 'request-collection';
const SLOT_PATH = 'folders';

export function genRequestFolderMove(rng: Rng): Scenario {
  const parentA = rng.uid('rcol');
  const parentB = rng.uid('rcol');
  const ws = 'ws-1';
  const seedNode = `node-${rng.int(0xffff).toString(16)}-s`;
  const moverA = `node-${rng.int(0xffff).toString(16)}-a`;
  const moverB = `node-${rng.int(0xffff).toString(16)}-b`;
  const reparenter = `node-${rng.int(0xffff).toString(16)}-r`;

  const fAlpha = rng.uid('rf');
  const fBeta = rng.uid('rf');
  const fGamma = rng.uid('rf');

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
      type: PARENT_TYPE,
      id: parentB,
      path: SLOT_PATH,
      itemId: fGamma,
      item: { uid: fGamma },
      orderKey: 'h',
    },
  });

  return {
    name: `request-folder-move(${fAlpha},${fBeta},${fGamma}@${parentA}→${parentB})`,
    envelopes: [
      seedAlpha,
      seedBeta,
      seedGamma,
      moveAlphaToFront,
      moveBetaToEnd,
      reparentRemove,
      reparentAdd,
    ],
  };
}
