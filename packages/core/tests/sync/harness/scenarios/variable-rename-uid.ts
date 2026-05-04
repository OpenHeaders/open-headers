/**
 * Concurrent same-row rename converges to one row, latest-name-wins.
 *
 * Post-session-66 the variable mutator surface collapsed to a single
 * primitive: `setVariable(uid, variable)` re-emits the whole record at
 * the same uid. Rename = same uid + new `name` field. Per-(setPath,
 * uid) LWW means the later-HLC record supersedes; concurrent same-row
 * renames converge on one row with the later-HLC name.
 *
 * This is the architectural guarantee the uid-identity refactor buys —
 * exercised here at the harness scale (1 500 scenarios × 4 random
 * permutations) so any regression to a name-as-identity model would
 * surface as a divergent materialization.
 *
 * Differs from `env-rename`, which still models the pre-uid two-mutation
 * atomic batch (removeFromSet(old) + addToSet(new)). That scenario
 * remains useful coverage for the catalog's atomic-rename batch shape;
 * this one covers the new uid-keyed re-emit shape used by every
 * variable mutator under the collapsed surface.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genVariableRenameSameUid(rng: Rng): Scenario {
  const entityKind = rng.pick(['environment', 'workspace-variables', 'collection'] as const);
  const entityId = entityKind === 'workspace-variables' ? 'singleton' : rng.uid(entityKind.slice(0, 3));
  const path = entityKind === 'environment' || entityKind === 'workspace-variables' ? 'variables' : 'variables';
  const rowUid = rng.uid('var');
  const baseName = `VAR_${rng.int(0xff).toString(16)}`;
  const nameA = `${baseName}_FROM_A`;
  const nameB = `${baseName}_FROM_B`;
  const ws = 'ws-1';
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;

  const t0 = 1_000 + rng.int(1_000);
  const tA = t0;
  const tB = t0 + 100 + rng.int(100);

  // Initial seed at t0-?: not needed — convergence is over the two
  // re-emits alone. The lock-protected store treats the higher-HLC
  // setter as the winner regardless of seed presence.

  // Surface A renames the row to nameA at HLC tA.
  const setA = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: entityKind,
      id: entityId,
      path,
      itemId: rowUid,
      item: { uid: rowUid, name: nameA, value: 'shared-value', type: 'default' },
      orderKey: 'm',
    },
  });
  // Surface B renames the SAME uid to nameB at later HLC tB. Convergence
  // requires the materialized row carries nameB and there is exactly one
  // entry at `path[itemId=rowUid]`.
  const setB = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: entityKind,
      id: entityId,
      path,
      itemId: rowUid,
      item: { uid: rowUid, name: nameB, value: 'shared-value', type: 'default' },
      orderKey: 'm',
    },
  });

  return {
    name: `var-rename-same-uid(${entityKind}/${entityId}/${rowUid}: ${nameA}↔${nameB})`,
    envelopes: [setA, setB],
  };
}
