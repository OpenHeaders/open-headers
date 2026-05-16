/**
 * Phase C F2 — Activity Feed classifier contract.
 *
 * Pure function tests; no IDB, no oracle. Pins skip-when-not-inbound,
 * skip-when-not-applied, and the three structural kinds the first
 * cut emits.
 */

import type {
  MaterializedEntity,
  MutationBody,
  MutationEnvelope,
  MutatorOutcome,
  MutatorStatus,
} from '@openheaders/core/sync';
import { classifyEnvelopeForActivity } from '@openheaders/oracle/sync';
import { describe, expect, it } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';

function envelope(body: MutationBody, overrides: Partial<MutationEnvelope> = {}): MutationEnvelope {
  return {
    mutationId: 'm1',
    hlc: { physicalMs: 1_000, logical: 0, nodeId: 'sw' },
    origin: { surfaceId: 'popup', deviceId: 'device-peer' },
    workspaceId: WS,
    mutatorVersion: 1,
    body,
    ...overrides,
  };
}

const applied: MutatorOutcome = { status: 'applied' };

describe('classifyEnvelopeForActivity', () => {
  it('classifies create as create-entity', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} }),
      outcome: applied,
      isInbound: true,
      observedAt: 42,
    });
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe('create-entity');
    expect(out[0].entityType).toBe('rule');
    expect(out[0].entityId).toBe('r1');
    expect(out[0].workspaceId).toBe(WS);
    expect(out[0].observedAt).toBe(42);
    expect(out[0].read).toBe(false);
  });

  it('classifies delete as delete-entity', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'delete', type: 'rule', id: 'r1' }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
    });
    expect(out.map((e) => e.kind)).toEqual(['delete-entity']);
  });

  it('classifies setField/unsetField/addToSet/removeFromSet/moveBefore as edit-entity', () => {
    const bodies: MutationBody[] = [
      { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'x' },
      { kind: 'unsetField', type: 'rule', id: 'r1', path: 'name' },
      { kind: 'addToSet', type: 'rule', id: 'r1', path: 'headerMods', itemId: 'h1', item: {} },
      { kind: 'removeFromSet', type: 'rule', id: 'r1', path: 'headerMods', itemId: 'h1' },
      { kind: 'moveBefore', type: 'rule', id: 'r1', path: 'headerMods', itemId: 'h1', orderKey: 'a0' },
    ];
    for (const body of bodies) {
      const out = classifyEnvelopeForActivity({
        envelope: envelope(body, { mutationId: `m-${body.kind}` }),
        outcome: applied,
        isInbound: true,
        observedAt: 0,
      });
      expect(out.map((e) => e.kind)).toEqual(['edit-entity']);
    }
  });

  it('captures path + itemId in context when present', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({
        kind: 'addToSet',
        type: 'rule',
        id: 'r1',
        path: 'headerMods',
        itemId: 'h1',
        item: { name: 'X-Token' },
      }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
    });
    expect(out[0].context).toEqual({ path: 'headerMods', itemId: 'h1' });
  });

  it('omits context entirely when neither path nor itemId apply (create / delete)', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
    });
    expect(out[0].context).toBeUndefined();
  });

  it('skips envelopes that did not arrive over the wire', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} }),
      outcome: applied,
      isInbound: false,
      observedAt: 0,
    });
    expect(out).toEqual([]);
  });

  it('skips outcomes that did not apply', () => {
    const statuses: MutatorStatus[] = [
      'duplicate',
      'superseded-by-hlc',
      'tombstoned',
      'concurrent-create-with-tombstone',
      'invalid-path',
      'schema-rejected',
      'unknown-mutator-version',
    ];
    for (const status of statuses) {
      const out = classifyEnvelopeForActivity({
        envelope: envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} }),
        outcome: { status },
        isInbound: true,
        observedAt: 0,
      });
      expect(out).toEqual([]);
    }
  });

  it('emits sensitive-field-rotation alongside edit-entity when a vault secret value changes', () => {
    const prior: MaterializedEntity = {
      type: 'vault',
      id: 'vault',
      data: { secrets: [{ uid: 's1', kind: 'string', value: 'old' }] },
    };
    const next: MaterializedEntity = {
      type: 'vault',
      id: 'vault',
      data: { secrets: [{ uid: 's1', kind: 'string', value: 'new' }] },
    };
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'setField', type: 'vault', id: 'vault', path: 'secrets.s1.value', value: 'new' }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
      prior,
      next,
    });
    expect(out.map((e) => e.kind)).toEqual(['edit-entity', 'sensitive-field-rotation']);
  });

  it('emits permission-scope-expansion alongside edit-entity when a rule condition is removed', () => {
    const prior: MaterializedEntity = {
      type: 'rule',
      id: 'r1',
      data: {
        conditions: [
          { uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] },
          { uid: 'c2', type: 'request-methods', values: ['GET'] },
        ],
      },
    };
    const next: MaterializedEntity = {
      type: 'rule',
      id: 'r1',
      data: {
        conditions: [{ uid: 'c1', type: 'url-filter', values: ['*.openheaders.io'] }],
      },
    };
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'removeFromSet', type: 'rule', id: 'r1', path: 'conditions', itemId: 'c2' }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
      prior,
      next,
    });
    expect(out.map((e) => e.kind)).toEqual(['edit-entity', 'permission-scope-expansion']);
  });

  it('omits highlight kinds on create / delete envelopes even with prior+next supplied', () => {
    const next: MaterializedEntity = { type: 'rule', id: 'r1', data: { conditions: [] } };
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
      prior: null,
      next,
    });
    expect(out.map((e) => e.kind)).toEqual(['create-entity']);
  });

  it('emits structural row alone when prior or next is null', () => {
    const out = classifyEnvelopeForActivity({
      envelope: envelope({ kind: 'setField', type: 'vault', id: 'vault', path: 'secrets.s1.value', value: 'new' }),
      outcome: applied,
      isInbound: true,
      observedAt: 0,
      prior: null,
      next: null,
    });
    expect(out.map((e) => e.kind)).toEqual(['edit-entity']);
  });

  it('encodes a deterministic id derived from (hlc, mutationId, kind)', () => {
    const env = envelope({ kind: 'create', type: 'rule', id: 'r1', payload: {} });
    const a = classifyEnvelopeForActivity({
      envelope: env,
      outcome: applied,
      isInbound: true,
      observedAt: 0,
    });
    const b = classifyEnvelopeForActivity({
      envelope: env,
      outcome: applied,
      isInbound: true,
      observedAt: 999,
    });
    expect(a[0].id).toBe(b[0].id);
  });
});
