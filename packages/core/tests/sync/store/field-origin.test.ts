/**
 * Per-field `origin` provenance tracking — Phase C F2.h foundation.
 *
 * Pins the `applyOrigin` contract end-to-end: every write into
 * `EntityState.fieldValues` records whether the apply came from a
 * local user gesture or arrived inbound (peer / hydration / snapshot
 * replay); the materializer surfaces those tags on
 * `MaterializedEntity.fieldOrigins`.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope, newMutationId } from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number): MutationEnvelope => ({
  mutationId: newMutationId(),
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body,
});

describe('field origin tracking', () => {
  it('defaults to local when applyOrigin is omitted', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'first' } }, 1_000));
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins).toEqual({ name: 'local' });
  });

  it('tags every leaf in a create payload with the supplied origin', () => {
    const store = new InMemoryDocumentStore();
    store.apply(
      env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a', enabled: true } }, 1_000),
      'inbound',
    );
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins).toEqual({ name: 'inbound', enabled: 'inbound' });
  });

  it('overwrites the origin when a newer setField at the same path lands', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a' } }, 1_000), 'inbound');
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'b' }, 2_000), 'local');
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins?.name).toBe('local');
  });

  it('does not overwrite the origin when a stale setField (older HLC) drops', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: {} }, 100), 'inbound');
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'a' }, 2_000), 'local');
    // Stale write at lower HLC — `local` origin must survive.
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'b' }, 1_000), 'inbound');
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins?.name).toBe('local');
  });

  it('omits origins for tombstoned paths from the materialized view', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a', desc: 'd' } }, 1_000), 'local');
    store.apply(env({ kind: 'unsetField', type: 'rule', id: 'r1', path: 'desc' }, 2_000), 'local');
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins).toEqual({ name: 'local' });
  });

  it('tracks origins per leaf path independently across mixed local + inbound writes', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a', desc: 'd' } }, 1_000), 'inbound');
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'a2' }, 2_000), 'local');
    const m = store.materializeOne('rule', 'r1');
    expect(m?.fieldOrigins).toEqual({ name: 'local', desc: 'inbound' });
  });
});
