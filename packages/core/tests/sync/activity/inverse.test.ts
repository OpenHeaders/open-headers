import { describe, expect, it } from 'vitest';

import { computeInverseSpec } from '../../../src/sync';
import type {
  InverseSpec,
  InverseSpecPriorAccess,
  MutationBody,
} from '../../../src/sync';

function emptyAccess(): InverseSpecPriorAccess {
  return {
    getFieldAt: () => ({ exists: false }),
    getSetMember: () => null,
  };
}

function fieldAccess(values: Record<string, unknown>): InverseSpecPriorAccess {
  return {
    getFieldAt: (path) =>
      Object.hasOwn(values, path) ? { exists: true, value: values[path] } : { exists: false },
    getSetMember: () => null,
  };
}

function setAccess(members: Record<string, Array<{ itemId: string; item: unknown; orderKey: string }>>): InverseSpecPriorAccess {
  return {
    getFieldAt: () => ({ exists: false }),
    getSetMember: (path, itemId) => {
      const live = members[path];
      if (!live) return null;
      const found = live.find((m) => m.itemId === itemId);
      return found ? { item: found.item, orderKey: found.orderKey } : null;
    },
  };
}

describe('computeInverseSpec — structural kinds', () => {
  it('inverts create → delete (no prior needed)', () => {
    const body: MutationBody = { kind: 'create', type: 'rule', id: 'r1', payload: {} };
    expect(computeInverseSpec(body, emptyAccess())).toEqual<InverseSpec>({ kind: 'create' });
  });

  it('marks delete as structurally unavailable under §7.2', () => {
    const body: MutationBody = { kind: 'delete', type: 'rule', id: 'r1' };
    expect(computeInverseSpec(body, emptyAccess())).toEqual<InverseSpec>({
      kind: 'unavailable',
      reason: 'delete-irreversible',
    });
  });
});

describe('computeInverseSpec — field kinds', () => {
  it('captures setField prior value when the path was populated', () => {
    const body: MutationBody = {
      kind: 'setField',
      type: 'environment',
      id: 'env-1',
      path: 'name',
      value: 'prod',
    };
    const spec = computeInverseSpec(body, fieldAccess({ name: 'staging' }));
    expect(spec).toEqual({ kind: 'setField', path: 'name', priorExists: true, priorValue: 'staging' });
  });

  it('marks setField path as previously absent — inverse downgrades to unset', () => {
    const body: MutationBody = {
      kind: 'setField',
      type: 'environment',
      id: 'env-1',
      path: 'description',
      value: 'created',
    };
    const spec = computeInverseSpec(body, emptyAccess());
    expect(spec).toEqual({ kind: 'setField', path: 'description', priorExists: false });
  });

  it('captures unsetField prior value when the path was populated', () => {
    const body: MutationBody = { kind: 'unsetField', type: 'rule', id: 'r1', path: 'description' };
    const spec = computeInverseSpec(body, fieldAccess({ description: 'old text' }));
    expect(spec).toEqual({
      kind: 'unsetField',
      path: 'description',
      priorExists: true,
      priorValue: 'old text',
    });
  });

  it('marks unsetField path as previously absent — inverse will be a no-op', () => {
    const body: MutationBody = { kind: 'unsetField', type: 'rule', id: 'r1', path: 'description' };
    const spec = computeInverseSpec(body, emptyAccess());
    expect(spec).toEqual({ kind: 'unsetField', path: 'description', priorExists: false });
  });

  it('passes explicit undefined values through priorValue unchanged', () => {
    const body: MutationBody = {
      kind: 'setField',
      type: 'rule',
      id: 'r1',
      path: 'description',
      value: 'new',
    };
    const spec = computeInverseSpec(body, fieldAccess({ description: undefined }));
    expect(spec).toEqual({
      kind: 'setField',
      path: 'description',
      priorExists: true,
      priorValue: undefined,
    });
  });
});

describe('computeInverseSpec — set kinds', () => {
  it('inverts addToSet → removeFromSet using only the original itemId', () => {
    const body: MutationBody = {
      kind: 'addToSet',
      type: 'rule',
      id: 'r1',
      path: 'headerMods',
      itemId: 'hm-1',
      item: { name: 'X-A' },
    };
    expect(computeInverseSpec(body, emptyAccess())).toEqual({
      kind: 'addToSet',
      path: 'headerMods',
      itemId: 'hm-1',
    });
  });

  it('inverts removeFromSet → carries the prior item + orderKey', () => {
    const body: MutationBody = {
      kind: 'removeFromSet',
      type: 'rule',
      id: 'r1',
      path: 'headerMods',
      itemId: 'hm-1',
    };
    const spec = computeInverseSpec(
      body,
      setAccess({ headerMods: [{ itemId: 'hm-1', item: { name: 'X-A' }, orderKey: 'a0' }] }),
    );
    expect(spec).toEqual({
      kind: 'removeFromSet',
      path: 'headerMods',
      itemId: 'hm-1',
      priorItem: { name: 'X-A' },
      priorOrderKey: 'a0',
    });
  });

  it('returns null on removeFromSet when the prior set member is missing', () => {
    const body: MutationBody = {
      kind: 'removeFromSet',
      type: 'rule',
      id: 'r1',
      path: 'headerMods',
      itemId: 'hm-1',
    };
    expect(computeInverseSpec(body, emptyAccess())).toBeNull();
  });

  it('inverts moveBefore → preserves the prior orderKey for restoration', () => {
    const body: MutationBody = {
      kind: 'moveBefore',
      type: 'rule',
      id: 'r1',
      path: 'headerMods',
      itemId: 'hm-1',
      orderKey: 'c0',
    };
    const spec = computeInverseSpec(
      body,
      setAccess({ headerMods: [{ itemId: 'hm-1', item: { name: 'X-A' }, orderKey: 'a0' }] }),
    );
    expect(spec).toEqual({
      kind: 'moveBefore',
      path: 'headerMods',
      itemId: 'hm-1',
      priorOrderKey: 'a0',
    });
  });
});
