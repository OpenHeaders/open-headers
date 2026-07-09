/**
 * Batch replay-order regression (found by the multi-backend two-backend
 * acceptance gate against a WAN daemon).
 *
 * A seed batch (create + addToSets) used to stamp ONE HLC on every
 * envelope. The mutation log orders by `(hlc, mutationId)`, so a peer
 * replaying the log could receive an `addToSet` BEFORE its `create`;
 * the document store mints an implicit blank entity for any mutation
 * kind, and that create-less entity materialized without its
 * schema-required scalars (no uid/name/path) and crashed every
 * consumer that assumes complete rules.
 *
 * Two fixes pinned here:
 *   1. `mintBatch` ticks the HLC logical component per envelope, so
 *      log order preserves batch order (create first).
 *   2. materialization is create-gated — an implicit create-less
 *      entity stays invisible (`materializeEntity` → null) instead of
 *      surfacing half-shaped, and converges once the create lands.
 */

import { describe, expect, it } from 'vitest';
import {
  compareHlc,
  type EntitySchemaRegistry,
  hlcToString,
  InMemoryDocumentStore,
  type MutationEnvelope,
  type MutatorContext,
} from '../../src/sync';
import { projectRule, seedRule } from '../../src/sync-builders/projections/rule-projection';
import type { Rule } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const headerRule: Rule = {
  schemaVersion: 5,
  uid: 'ruleaaaa',
  path: 'rules/my-rules-coll0001/header-rule-ruleaaaa',
  name: 'Header rule',
  type: 'header',
  enabled: true,
  published: true,
  conditions: [{ uid: 'cond0001', type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
  action: {
    requestHeaders: [{ uid: 'hmod0001', operation: 'override', headerName: 'X-A', value: '1' }],
    responseHeaders: [],
  },
} as Rule;

const schemas: EntitySchemaRegistry = new Map([
  [
    'rule',
    {
      setPaths: (partial: unknown) =>
        typeof partial === 'object' && partial !== null && (partial as { type?: unknown }).type === 'header'
          ? ['conditions', 'action.requestHeaders', 'action.responseHeaders']
          : ['conditions'],
    },
  ],
]);

/** The mutation log's ordering: `(hlc, mutationId)` ascending. */
function logOrder(envelopes: readonly MutationEnvelope[]): MutationEnvelope[] {
  return envelopes
    .slice()
    .sort((a, b) =>
      hlcToString(a.hlc) === hlcToString(b.hlc)
        ? a.mutationId.localeCompare(b.mutationId)
        : hlcToString(a.hlc).localeCompare(hlcToString(b.hlc)),
    );
}

describe('mintBatch intra-batch HLC order', () => {
  it('every envelope in a batch carries a strictly greater HLC than the one before it', () => {
    const { mutations } = seedRule(headerRule, ctx(1_000));
    expect(mutations.length).toBeGreaterThan(1);
    for (let i = 1; i < mutations.length; i += 1) {
      expect(compareHlc(mutations[i].hlc, mutations[i - 1].hlc)).toBeGreaterThan(0);
    }
  });

  it('log order preserves batch order — the create replays first', () => {
    const { mutations } = seedRule(headerRule, ctx(1_000));
    const replayed = logOrder(mutations);
    expect(replayed[0].body.kind).toBe('create');
    expect(replayed.map((e) => e.mutationId)).toEqual(mutations.map((e) => e.mutationId));
  });
});

describe('create-gated materialization', () => {
  it('keeps a create-less implicit entity invisible, then converges once the create lands', () => {
    const { mutations } = seedRule(headerRule, ctx(1_000));
    const create = mutations.find((e) => e.body.kind === 'create');
    const rest = mutations.filter((e) => e.body.kind !== 'create');
    expect(create).toBeTruthy();
    expect(rest.length).toBeGreaterThan(0);

    // Adversarial order: the non-create mutations land first (a peer
    // replaying a pre-fix log). The implicit entity must stay invisible.
    const store = new InMemoryDocumentStore(schemas);
    for (const env of rest) store.apply(env);
    expect(store.materializeOne('rule', headerRule.uid)).toBeNull();

    // The create arrives — the materialization converges to the seeded rule.
    store.apply(create as MutationEnvelope);
    const complete = store.materializeOne('rule', headerRule.uid);
    expect(complete).toBeTruthy();
    expect(projectRule(complete as NonNullable<typeof complete>)).toEqual(headerRule);
  });
});
