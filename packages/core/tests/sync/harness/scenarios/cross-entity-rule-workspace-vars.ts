/**
 * Cross-entity convergence — rule references a workspace-scoped
 * variable, both mutated concurrently across surfaces. Sibling to
 * `cross-entity-rule-env.ts` and `cross-entity-rule-vault.ts`; together
 * the three discharge §22.3 Phase B coverage across distinct
 * entity-type shape categories:
 *
 *   • rule × env             — non-sensitive, per-environment scope
 *   • rule × vault           — schema-marked-sensitive, workspace-scope
 *   • rule × workspace-vars  — non-sensitive, workspace-scope (this file)
 *
 * The third pair proves the per-(setPath, itemId) LWW + per-leaf LWW
 * convergence claims hold against ANY entity-type pair the document
 * store indexes — sensitivity flag and scope axis are independent of
 * the data-plane convergence guarantee.
 *
 * Setup:
 *   - One workspace-variables singleton with variable `VAR_X`.
 *   - One rule entity with a header mod whose value templates
 *     `{{vars.VAR_X}}`.
 *
 * Three surfaces fire concurrently:
 *   - Surface A renames workspace var `VAR_X` → `VAR_Y` via the catalog
 *     atomic batch (removeFromSet + addToSet).
 *   - Surface B replaces the rule header value with a literal `'fixed'`
 *     (removeFromSet old itemId + addToSet new itemId).
 *   - Surface C updates `VAR_X`'s value to `'rotated'` (whole-record
 *     addToSet at name=VAR_X), racing surface A's tombstone.
 *
 * Per-(setPath, itemId) LWW resolves the workspace-vars-side race:
 * HLC ordering tA > tB > tC makes the rename's tombstone win; VAR_X
 * disappears, VAR_Y appears. Rule-side mutation is isolated.
 * Convergence asserted against any total-order interleaving.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCrossEntityRuleWorkspaceVars(rng: Rng): Scenario {
  const ws = 'ws-1';
  const ruleId = rng.uid('rule');
  const oldName = `VAR_${rng.int(0xff).toString(16)}`;
  const newName = `${oldName}_RENAMED`;
  const oldHeaderItemId = rng.uid('hm-old');
  const newHeaderItemId = rng.uid('hm-new');
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  // Distinct HLCs ensure all per-(setPath, itemId) and per-leaf LWW
  // outcomes are unambiguous regardless of permutation. Same posture
  // as the sibling cross-entity scenarios.
  const tC = 1_000 + rng.int(500);
  const tB = tC + 100 + rng.int(100);
  const tA = tB + 100 + rng.int(100);

  // ── Surface C: update VAR_X's value (whole-record replace). ─────
  const updateXValue = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tC, 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'workspace-variables',
      id: 'workspace-vars',
      path: 'variables',
      itemId: oldName,
      item: { name: oldName, value: 'rotated', type: 'default' },
      orderKey: 'a',
    },
  });

  // ── Surface B: rewrite rule header value to a literal. ──────────
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

  // ── Surface A: rename VAR_X → VAR_Y (atomic batch). ─────────────
  const removeOld = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: 'workspace-variables',
      id: 'workspace-vars',
      path: 'variables',
      itemId: oldName,
    },
  });
  const addNew = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'workspace-variables',
      id: 'workspace-vars',
      path: 'variables',
      itemId: newName,
      item: { name: newName, value: 'rotated', type: 'default' },
      orderKey: 'b',
    },
  });

  return {
    name: `cross-entity-rule-workspace-vars(vars=${oldName}→${newName}, rule=${ruleId})`,
    envelopes: [updateXValue, removeOldHeader, addNewHeader, removeOld, addNew],
  };
}
