/**
 * Cross-oracle convergence — workspace-meta singleton (lives at global
 * scope, workspaceId='__global__') racing with a per-workspace
 * entity's edit. Carryover bucket from §22.3 Phase B.
 *
 * Why this bucket. The runtime topology splits into two oracle scopes
 * (per-workspace at workspaceId='ws-*' and global at
 * workspaceId='__global__'); session 32 proved the split is purely a
 * lifecycle distinction (when do you init/dispose) and a sentinel-id
 * distinction (which IDB stripe), NOT a fork in the engine's
 * convergence contracts. This bucket discharges the data-plane half
 * of that claim — by mixing envelopes with two different
 * `workspaceId` tags in one in-memory store, it verifies the document
 * store converges regardless of the workspaceId envelope tag, which
 * underwrites the runtime "two oracles, one engine" architectural
 * posture.
 *
 * Setup:
 *   - One ExtensionWorkspace singleton at the GLOBAL scope
 *     (workspaceId='__global__', type='extensionWorkspace', id='global')
 *     carrying scalar `activeId`.
 *   - One per-workspace Environment at workspaceId='ws-1' carrying a
 *     `name` scalar.
 *
 * Three surfaces fire concurrently:
 *   - Surface A flips `activeId` to 'ws-2' on the global singleton at
 *     the highest HLC.
 *   - Surface B renames the per-workspace environment at the middle
 *     HLC (independent of the global singleton).
 *   - Surface C also flips `activeId` to 'ws-3' on the global
 *     singleton at the lowest HLC, racing surface A on the same
 *     per-leaf path.
 *
 * Per-leaf LWW resolves the activeId race: surface A's later HLC
 * wins. Surface B's per-workspace edit is isolated. Convergence
 * asserted across any total-order interleaving.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

const GLOBAL_SCOPE = '__global__';
const EXTENSION_WORKSPACE_TYPE = 'extensionWorkspace';
const EXTENSION_WORKSPACE_ID = 'global';
const ACTIVE_ID_PATH = 'activeId';

export function genCrossEntityWorkspaceMeta(rng: Rng): Scenario {
  const wsScope = `ws-${rng.int(0xff).toString(16)}`;
  const envId = rng.uid('env');
  const newEnvName = `env_${rng.int(0xff).toString(16)}`;
  const wsAValue = `ws-A-${rng.int(0xff).toString(16)}`;
  const wsCValue = `ws-C-${rng.int(0xff).toString(16)}`;
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  const tC = 1_000 + rng.int(500);
  const tB = tC + 100 + rng.int(100);
  const tA = tB + 100 + rng.int(100);

  // ── Surface C: lower-HLC activeId flip on the global singleton. ──
  // Tagged with the global workspaceId — same tag the runtime's
  // global-service oracle stamps on its envelopes.
  const flipActiveLow = mintEnvelope({
    workspaceId: GLOBAL_SCOPE,
    hlc: hlcAt(tC, 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: EXTENSION_WORKSPACE_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: ACTIVE_ID_PATH,
      value: wsCValue,
    },
  });

  // ── Surface B: rename a per-workspace environment. ──────────────
  // Tagged with a per-workspace `wsScope` — same tag the runtime's
  // per-workspace oracle stamps on its envelopes. The data plane
  // doesn't partition by workspaceId, so this lands cleanly alongside
  // the global-scope envelopes.
  const renameEnv = mintEnvelope({
    workspaceId: wsScope,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: 'environment',
      id: envId,
      path: 'name',
      value: newEnvName,
    },
  });

  // ── Surface A: highest-HLC activeId flip — wins per-leaf LWW. ───
  const flipActiveHigh = mintEnvelope({
    workspaceId: GLOBAL_SCOPE,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'setField',
      type: EXTENSION_WORKSPACE_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: ACTIVE_ID_PATH,
      value: wsAValue,
    },
  });

  return {
    name: `cross-entity-workspace-meta(scope=${wsScope}, env=${envId})`,
    envelopes: [flipActiveLow, renameEnv, flipActiveHigh],
  };
}
