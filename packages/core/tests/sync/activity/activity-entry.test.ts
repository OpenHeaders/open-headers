import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { activityEntryId, ActivityEntryKindSchema, ActivityEntrySchema } from '../../../src/sync';
import type { ActivityEntry } from '../../../src/sync';

const baseEntry: ActivityEntry = {
  id: '',
  workspaceId: '0193a8ff-c000-7000-8000-000000000001',
  mutationId: 'mut-001',
  hlc: { physicalMs: 1700000000000, logical: 0, nodeId: 'sw-openheaders' },
  kind: 'edit-entity',
  entityType: 'rule',
  entityId: 'r1',
  origin: { surfaceId: 'popup', deviceId: 'device-1' },
  observedAt: 1700000000123,
  read: false,
};

describe('activityEntryId', () => {
  it('encodes hlc + mutationId + kind in a sortable shape', () => {
    const a = activityEntryId({ hlc: baseEntry.hlc, mutationId: 'mA', kind: 'create-entity' });
    const b = activityEntryId({
      hlc: { ...baseEntry.hlc, physicalMs: baseEntry.hlc.physicalMs + 1 },
      mutationId: 'mA',
      kind: 'create-entity',
    });
    expect(a < b).toBe(true);
  });

  it('distinguishes the same envelope across different kinds', () => {
    const a = activityEntryId({ hlc: baseEntry.hlc, mutationId: 'mA', kind: 'edit-entity' });
    const b = activityEntryId({ hlc: baseEntry.hlc, mutationId: 'mA', kind: 'sensitive-field-rotation' });
    expect(a).not.toBe(b);
  });
});

describe('ActivityEntryKindSchema', () => {
  it('accepts the six known kinds', () => {
    for (const k of [
      'create-entity',
      'edit-entity',
      'delete-entity',
      'supersede-local-edit',
      'sensitive-field-rotation',
      'permission-scope-expansion',
    ]) {
      expect(v.parse(ActivityEntryKindSchema, k)).toBe(k);
    }
  });

  it('rejects unknown strings', () => {
    expect(() => v.parse(ActivityEntryKindSchema, 'made-up-kind')).toThrow();
  });
});

describe('ActivityEntrySchema', () => {
  it('round-trips a well-formed entry', () => {
    const entry: ActivityEntry = {
      ...baseEntry,
      id: activityEntryId(baseEntry),
    };
    expect(v.parse(ActivityEntrySchema, entry)).toEqual(entry);
  });

  it('accepts optional summary and context', () => {
    const entry: ActivityEntry = {
      ...baseEntry,
      id: activityEntryId(baseEntry),
      summary: 'rule X-Bearer-Token updated',
      context: { fieldPath: 'headerMods.0.value', sensitive: true },
    };
    expect(v.parse(ActivityEntrySchema, entry)).toEqual(entry);
  });

  it('rejects missing mutationId', () => {
    const broken = { ...baseEntry, id: 'x', mutationId: '' };
    expect(() => v.parse(ActivityEntrySchema, broken)).toThrow();
  });

  it('rejects negative observedAt', () => {
    const broken = { ...baseEntry, id: 'x', observedAt: -1 };
    expect(() => v.parse(ActivityEntrySchema, broken)).toThrow();
  });

  it('rejects malformed hlc', () => {
    const broken = { ...baseEntry, id: 'x', hlc: { physicalMs: -1, logical: 0, nodeId: 'n' } };
    expect(() => v.parse(ActivityEntrySchema, broken)).toThrow();
  });
});
