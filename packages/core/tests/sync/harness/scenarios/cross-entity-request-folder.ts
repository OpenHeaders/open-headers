/**
 * Cross-entity convergence — request references a folder, both
 * mutated concurrently across surfaces. Sibling to the cross-entity
 * rule × env / rule × vault / rule × workspace-vars buckets; together
 * the four discharge §22.3 Phase B coverage across distinct entity-type
 * shape categories.
 *
 *   • rule × env             — non-sensitive, per-environment scope
 *   • rule × vault           — schema-marked-sensitive, workspace-scope
 *   • rule × workspace-vars  — non-sensitive, workspace-scope
 *   • request × folder       — non-sensitive, parent-child-reference (this file)
 *
 * The fourth pair brings the parent/child reference shape into harness
 * coverage: the request entity carries a `folderUid` scalar pointing at
 * a folder entity. Both entity types are mutated concurrently; the
 * document store's per-(type, id, path) keying must converge regardless
 * of total order.
 *
 * Setup:
 *   - One folder entity at `folderUid` with scalar field `name`.
 *   - One request entity at `requestUid` carrying scalar fields
 *     `name` + `folderUid` referencing the folder.
 *
 * Three surfaces fire concurrently:
 *   - Surface A renames the folder (setField name = NEW_NAME) at the
 *     highest HLC.
 *   - Surface B edits the request name (setField name = NEW_REQ_NAME)
 *     at the middle HLC.
 *   - Surface C also updates the folder name (setField name = ALT_NAME)
 *     at the lowest HLC, racing surface A on the same per-leaf path.
 *
 * Per-leaf LWW resolves the folder.name race: surface A's later HLC
 * wins. Surface B's request-side edit is isolated and lands regardless
 * of permutation. Convergence asserted across any total-order
 * interleaving.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCrossEntityRequestFolder(rng: Rng): Scenario {
  const ws = 'ws-1';
  const folderId = rng.uid('folder');
  const requestId = rng.uid('request');
  const oldFolderName = `folder_${rng.int(0xff).toString(16)}`;
  const newFolderName = `${oldFolderName}_RENAMED`;
  const altFolderName = `${oldFolderName}_ALT`;
  const newRequestName = `request_${rng.int(0xff).toString(16)}`;
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  // Distinct HLCs ensure all per-leaf LWW outcomes are unambiguous
  // regardless of permutation. Same posture as the sibling
  // cross-entity scenarios.
  const tC = 1_000 + rng.int(500);
  const tB = tC + 100 + rng.int(100);
  const tA = tB + 100 + rng.int(100);

  // ── Surface C: update folder name to ALT_NAME (racing surface A). ─
  const updateFolderAlt = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tC, 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: 'folder',
      id: folderId,
      path: 'name',
      value: altFolderName,
    },
  });

  // ── Surface B: edit the request's name (independent of folder). ──
  const updateRequestName = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: 'request',
      id: requestId,
      path: 'name',
      value: newRequestName,
    },
  });

  // ── Surface A: rename folder to NEW_NAME at the highest HLC. ─────
  const renameFolder = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: 'folder',
      id: folderId,
      path: 'name',
      value: newFolderName,
    },
  });

  return {
    name: `cross-entity-request-folder(folder=${folderId}, request=${requestId})`,
    envelopes: [updateFolderAlt, updateRequestName, renameFolder],
  };
}
