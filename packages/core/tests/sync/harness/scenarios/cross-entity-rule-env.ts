/**
 * Cross-entity convergence — rule references an env var, both
 * mutated concurrently across surfaces. Closes the §22.3 Phase B
 * coverage requirement: "convergence across all entities; cross-entity
 * reference integrity (rule references env var; both mutated
 * concurrently)."
 *
 * Every prior scenario bucket is single-entity-type. This one
 * interleaves envelopes targeting BOTH entity types in the same total
 * order. The convergence claim is identical (byte-stable
 * materialization under any total order) but the bucket exercises the
 * per-entity-type indexing inside the document store + the per-entity
 * lock model — a regression where one entity's state could clobber
 * another's via shared pathing would surface here.
 *
 * Setup:
 *   - One env entity with variable `X` (value=`v0`).
 *   - One rule entity with a header mod whose value is `{{env.X}}`.
 *
 * Three surfaces fire concurrently:
 *   - Surface A renames env `X` → `Y` via the catalog atomic batch
 *     (removeFromSet name=X + addToSet name=Y).
 *   - Surface B rewrites the rule header value to a literal `fixed`
 *     via removeFromSet old itemId + addToSet new itemId. (The
 *     rule's reference to env X is NOT updated — that's a UI-side
 *     decision the engine never makes; the harness only verifies the
 *     mutation log converges.)
 *   - Surface C updates env var `X`'s value to `v1` (whole-record
 *     addToSet at the same itemId, racing surface A's removeFromSet).
 *
 * Per-(setPath, itemId) LWW resolves the env-side race: the highest
 * HLC at name=X wins between Surface A's remove and Surface C's add
 * (we set tA > tC so the rename's tombstone wins; X disappears,
 * Y appears, the rule still references the now-absent X). Rule-side
 * mutation is isolated; surface B's edit applies under any order.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCrossEntityRuleEnv(rng: Rng): Scenario {
  const ws = 'ws-1';
  const envId = rng.uid('env');
  const ruleId = rng.uid('rule');
  const oldName = `VAR_${rng.int(0xff).toString(16)}`;
  const newName = `${oldName}_RENAMED`;
  const oldHeaderItemId = rng.uid('hm-old');
  const newHeaderItemId = rng.uid('hm-new');
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  // Distinct HLCs ensure all per-(setPath, itemId) and per-leaf LWW
  // outcomes are unambiguous regardless of permutation. The rename
  // (tA) is later than the value-edit (tC) so the rename's tombstone
  // wins: env ends up with `Y` only, no `X`. Rule edit (tB) is
  // unrelated to the env races.
  const tC = 1_000 + rng.int(500);
  const tB = tC + 100 + rng.int(100);
  const tA = tB + 100 + rng.int(100);

  // ── Surface C: update env var X's value (whole-record replace). ──
  const updateXValue = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tC, 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'environment',
      id: envId,
      path: 'variables',
      itemId: oldName,
      item: { name: oldName, value: 'v1', type: 'default' },
      orderKey: 'a',
    },
  });

  // ── Surface B: rewrite rule header value to a literal. ───────────
  const removeOldHeader = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 0, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: 'rule',
      id: ruleId,
      path: 'action.requestHeaders',
      itemId: oldHeaderItemId,
    },
  });
  const addNewHeader = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tB, 1, nodeB),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'rule',
      id: ruleId,
      path: 'action.requestHeaders',
      itemId: newHeaderItemId,
      item: { uid: newHeaderItemId, key: 'X-Token', value: 'fixed', operation: 'set', enabled: true },
      orderKey: 'a',
    },
  });

  // ── Surface A: rename env X → Y (atomic batch). ──────────────────
  const removeOldEnv = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: 'environment',
      id: envId,
      path: 'variables',
      itemId: oldName,
    },
  });
  const addNewEnv = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'environment',
      id: envId,
      path: 'variables',
      itemId: newName,
      item: { name: newName, value: 'v1', type: 'default' },
      orderKey: 'b',
    },
  });

  return {
    name: `cross-entity-rule-env(env=${envId}/${oldName}→${newName}, rule=${ruleId})`,
    envelopes: [updateXValue, removeOldHeader, addNewHeader, removeOldEnv, addNewEnv],
  };
}
