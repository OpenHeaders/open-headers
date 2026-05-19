import { describe, expect, it } from 'vitest';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeVaultSecret,
  setVaultSecret,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_MUTATOR_VERSION,
  VAULT_PATH,
} from '../../../../src/sync';
import type { VaultSecret } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const stringSecret = (uid: string, name: string, value = 'sek'): VaultSecret => ({
  uid,
  kind: 'string',
  name,
  value,
});

const totpSecret = (uid: string, name: string): VaultSecret => ({
  uid,
  kind: 'totp',
  name,
  seed: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
});

describe('setVaultSecret', () => {
  it('emits addToSet on the singleton id with itemId = secret.uid', () => {
    const secret = stringSecret('sec-aaaa', 'API_KEY');
    const intent = setVaultSecret(ctx(), { secret });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(VAULT_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 'sec-aaaa',
      item: secret,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc: ctx().hlc },
    ]);
  });

  it('carries a TOTP secret through unchanged', () => {
    const secret = totpSecret('sec-bbbb', 'OTP');
    const intent = setVaultSecret(ctx(), { secret });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'sec-bbbb',
      item: secret,
    });
  });

  it('honors explicit orderKey', () => {
    const intent = setVaultSecret(ctx(), { secret: stringSecret('sec-cccc', 'A'), orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({ orderKey: 'm' });
  });

  it('shares a batchId across mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setVaultSecret(c, { secret: stringSecret('sec-dddd', 'A') });
    expect(a.batch.batchId).toBe('batch-shared');
  });

  it('rename is a re-emit at the same uid with a new name', () => {
    const renamed = stringSecret('sec-aaaa', 'BASE_KEY');
    const intent = setVaultSecret(ctx(), { secret: renamed });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'sec-aaaa',
      item: { uid: 'sec-aaaa', name: 'BASE_KEY' },
    });
  });

  it('kind transition (string ↔ totp) is a re-emit at the same uid (whole-record LWW)', () => {
    const transitioned = totpSecret('sec-aaaa', 'API_KEY');
    const intent = setVaultSecret(ctx(), { secret: transitioned });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'sec-aaaa',
      item: { uid: 'sec-aaaa', kind: 'totp', name: 'API_KEY' },
    });
  });
});

describe('removeVaultSecret', () => {
  it('emits removeFromSet with itemId = uid', () => {
    const intent = removeVaultSecret(ctx(), { uid: 'sec-aaaa' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 'sec-aaaa',
    });
  });
});
