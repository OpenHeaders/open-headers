import { describe, expect, it } from 'vitest';

import type { MutationEnvelope } from '../../src/sync';
import {
  isSameDeviceOnlyEntityType,
  isSameDeviceOnlyMutation,
  RULE_ENTITY_TYPE,
  VAULT_ENTITY_TYPE,
} from '../../src/sync';

function makeEnvelope(type: string): MutationEnvelope {
  return {
    mutationId: 'm-1',
    hlc: { physicalMs: 1, logical: 0, nodeId: 'node-a' },
    origin: { surfaceId: 's-1', deviceId: 'd-1' },
    workspaceId: 'ws-1',
    orgId: 'org-1',
    mutatorVersion: 1,
    body: { kind: 'addToSet', type, id: 'e-1', path: 'secrets', itemId: 'i-1', item: { uid: 'i-1' } },
  };
}

describe('isSameDeviceOnlyEntityType', () => {
  it('classifies the vault as same-device-only', () => {
    expect(isSameDeviceOnlyEntityType(VAULT_ENTITY_TYPE)).toBe(true);
  });

  it('does not classify derived/non-secret entities (rule)', () => {
    expect(isSameDeviceOnlyEntityType(RULE_ENTITY_TYPE)).toBe(false);
  });

  it('does not classify the derived sensitive entities (oauth / live-value) as same-device-only', () => {
    // Reach gate is vault-only; OAuth bundles + live values are trust-zone-scoped
    // (paired, possibly LAN), not device-scoped — they must keep flowing to LAN peers.
    expect(isSameDeviceOnlyEntityType('oauth-bundle')).toBe(false);
    expect(isSameDeviceOnlyEntityType('live-value')).toBe(false);
  });

  it('treats an unknown entity type as not same-device-only', () => {
    expect(isSameDeviceOnlyEntityType('not-a-real-entity')).toBe(false);
  });
});

describe('isSameDeviceOnlyMutation', () => {
  it('is true for a vault mutation envelope', () => {
    expect(isSameDeviceOnlyMutation(makeEnvelope(VAULT_ENTITY_TYPE))).toBe(true);
  });

  it('is false for a non-vault mutation envelope', () => {
    expect(isSameDeviceOnlyMutation(makeEnvelope(RULE_ENTITY_TYPE))).toBe(false);
  });
});
