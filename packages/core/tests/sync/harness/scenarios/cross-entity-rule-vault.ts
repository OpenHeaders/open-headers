/**
 * Cross-entity convergence — rule references a vault secret, both
 * mutated concurrently across surfaces. Sibling to
 * `cross-entity-rule-env.ts`; together they cover the §22.3 Phase B
 * claim across two distinct entity-type pairings — a non-sensitive
 * entity (env) AND a schema-marked-sensitive entity (vault). The
 * vault path proves the per-entity-type indexing in
 * `InMemoryDocumentStore` doesn't accept any cross-pollination from
 * the sensitive scope back into the rule scope (the awareness scrub
 * lives at the SW oracle, but the document store is what the harness
 * verifies — and the convergence claim must hold regardless of
 * sensitivity).
 *
 * Setup:
 *   - One vault entity with secret `SECRET_X` (string kind).
 *   - One rule entity with a header mod whose value templates
 *     `{{vault.SECRET_X}}`.
 *
 * Three surfaces fire concurrently:
 *   - Surface A renames vault `SECRET_X` → `SECRET_Y` via the catalog
 *     atomic batch (removeFromSet + addToSet).
 *   - Surface B replaces the rule header value with a literal `'fixed'`
 *     (removeFromSet old itemId + addToSet new itemId).
 *   - Surface C updates `SECRET_X`'s value to `'rotated'` (whole-record
 *     addToSet at name=SECRET_X), racing surface A's tombstone.
 *
 * Per-(setPath, itemId) LWW resolves the vault-side race: HLC ordering
 * (tA > tB > tC) makes the rename's tombstone win; SECRET_X disappears,
 * SECRET_Y appears, the rule still references the now-absent
 * SECRET_X. Rule-side mutation is isolated. Convergence asserted
 * against any total-order interleaving.
 */

import { hlcAt, mintEnvelope } from '../envelope-gen';
import type { Rng } from '../random';
import type { Scenario } from '../run';

export function genCrossEntityRuleVault(rng: Rng): Scenario {
  const ws = 'ws-1';
  const ruleId = rng.uid('rule');
  const oldName = `SECRET_${rng.int(0xff).toString(16)}`;
  const newName = `${oldName}_RENAMED`;
  const oldHeaderItemId = rng.uid('hm-old');
  const newHeaderItemId = rng.uid('hm-new');
  const nodeA = `node-${rng.int(0xffff).toString(16)}-a`;
  const nodeB = `node-${rng.int(0xffff).toString(16)}-b`;
  const nodeC = `node-${rng.int(0xffff).toString(16)}-c`;

  // Distinct HLCs ensure all per-(setPath, itemId) and per-leaf LWW
  // outcomes are unambiguous regardless of permutation. The rename
  // (tA) is later than the value-edit (tC) so the rename's tombstone
  // wins on the vault side.
  const tC = 1_000 + rng.int(500);
  const tB = tC + 100 + rng.int(100);
  const tA = tB + 100 + rng.int(100);

  // ── Surface C: update SECRET_X's value (whole-record replace). ──
  const updateXValue = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tC, 0, nodeC),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'vault',
      id: 'vault',
      path: 'secrets',
      itemId: oldName,
      item: { kind: 'string', name: oldName, value: 'rotated' },
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

  // ── Surface A: rename vault SECRET_X → SECRET_Y (atomic batch). ──
  const removeOldSecret = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 0, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'removeFromSet',
      type: 'vault',
      id: 'vault',
      path: 'secrets',
      itemId: oldName,
    },
  });
  const addNewSecret = mintEnvelope({
    workspaceId: ws,
    hlc: hlcAt(tA, 1, nodeA),
    mutationId: rng.uid('m'),
    body: {
      kind: 'addToSet',
      type: 'vault',
      id: 'vault',
      path: 'secrets',
      itemId: newName,
      item: { kind: 'string', name: newName, value: 'rotated' },
      orderKey: 'b',
    },
  });

  return {
    name: `cross-entity-rule-vault(vault=${oldName}→${newName}, rule=${ruleId})`,
    envelopes: [updateXValue, removeOldHeader, addNewHeader, removeOldSecret, addNewSecret],
  };
}
