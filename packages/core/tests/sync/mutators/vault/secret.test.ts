import { describe, expect, it } from 'vitest';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeVaultSecret,
  renameVaultSecret,
  setVaultSecret,
  VAULT_ENTITY_TYPE,
  VAULT_ID,
  VAULT_MUTATOR_VERSION,
  VAULT_PATH,
} from '../../../../src/sync';
import type { V5 } from '../../../../src/types';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const stringSecret = (name: string, value = 'sek'): V5.VaultSecret => ({
  kind: 'string',
  name,
  value,
});

const totpSecret = (name: string): V5.VaultSecret => ({
  kind: 'totp',
  name,
  seed: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
});

describe('setVaultSecret', () => {
  it('emits addToSet on the singleton id with itemId = secret name', () => {
    const intent = setVaultSecret(ctx(), { secret: stringSecret('API_KEY') });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(VAULT_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 'API_KEY',
      item: { kind: 'string', name: 'API_KEY', value: 'sek' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: VAULT_ID, hlc: ctx().hlc },
    ]);
  });

  it('carries a TOTP secret through unchanged', () => {
    const intent = setVaultSecret(ctx(), { secret: totpSecret('OTP') });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'OTP',
      item: {
        kind: 'totp',
        name: 'OTP',
        seed: 'JBSWY3DPEHPK3PXP',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      },
    });
  });

  it('honors explicit orderKey', () => {
    const intent = setVaultSecret(ctx(), { secret: stringSecret('A'), orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({ orderKey: 'm' });
  });

  it('shares a batchId across mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setVaultSecret(c, { secret: stringSecret('A') });
    expect(a.batch.batchId).toBe('batch-shared');
  });
});

describe('removeVaultSecret', () => {
  it('emits removeFromSet with itemId = name', () => {
    const intent = removeVaultSecret(ctx(), { name: 'API_KEY' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: VAULT_ENTITY_TYPE,
      id: VAULT_ID,
      path: VAULT_PATH,
      itemId: 'API_KEY',
    });
  });
});

describe('renameVaultSecret', () => {
  it('emits an atomic batch — removeFromSet(old) + addToSet(new) under one batchId', () => {
    const intent = renameVaultSecret(ctx(), {
      oldName: 'API_KEY',
      newSecret: stringSecret('BASE_KEY', 'sek'),
    });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      itemId: 'API_KEY',
      path: VAULT_PATH,
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'BASE_KEY',
      path: VAULT_PATH,
      item: { kind: 'string', name: 'BASE_KEY', value: 'sek' },
    });
  });

  it('preserves TOTP fields across rename', () => {
    const intent = renameVaultSecret(ctx(), {
      oldName: 'OTP',
      newSecret: totpSecret('NEW_OTP'),
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      item: { kind: 'totp', name: 'NEW_OTP', seed: 'JBSWY3DPEHPK3PXP' },
    });
  });

  it('is a no-op when oldName equals newSecret.name', () => {
    const intent = renameVaultSecret(ctx(), {
      oldName: 'X',
      newSecret: stringSecret('X'),
    });
    expect(intent.batch.mutations).toHaveLength(0);
    expect(intent.sideEffects).toEqual([]);
  });
});
