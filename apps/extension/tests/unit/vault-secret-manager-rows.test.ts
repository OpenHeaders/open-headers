/**
 * Vault table row codecs — the `secret-manager` kind's round-trip
 * through the LocalRow superset (secretsToLocal / secretsFromLocal),
 * the storage-key-order-insensitive fingerprint, and the conflict
 * tracker's form projection for locator leaves.
 */

import type { VaultSecret } from '@openheaders/core/types';
import {
  emptyRow,
  secretsFingerprint,
  secretsFromLocal,
  secretsToLocal,
} from '@openheaders/ui/workbench/components/panels/variable-table-rows';
import { projectSecretsToForm } from '@openheaders/ui/workbench/components/variables/use-vault-conflicts';
import { describe, expect, it } from 'vitest';

const SM_SECRET: VaultSecret = {
  uid: 'abcd1234',
  kind: 'secret-manager',
  name: 'ApiToken',
  locator: { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
};

describe('secret-manager row codecs', () => {
  it('secretsToLocal hydrates provider + flat locator fields', () => {
    const rows = secretsToLocal([SM_SECRET]);
    expect(rows).toHaveLength(2); // + trailing placeholder
    const row = rows[0];
    expect(row.kind).toBe('secret-manager');
    expect(row.isSensitive).toBe(true);
    expect(row.smProvider).toBe('onepassword');
    expect(row.smFields).toEqual({ vault: 'Engineering', item: 'api.openheaders.io', field: 'token' });
  });

  it('secretsFromLocal round-trips the locator', () => {
    const rows = secretsToLocal([SM_SECRET]);
    expect(secretsFromLocal(rows)).toEqual([SM_SECRET]);
  });

  it('partial locator input survives serialization (forgiving persistence)', () => {
    const row = { ...emptyRow(false), kind: 'secret-manager' as const, name: 'Draft', smFields: { vault: 'Eng' } };
    const out = secretsFromLocal([row]);
    expect(out).toEqual([
      {
        uid: row.uid,
        kind: 'secret-manager',
        name: 'Draft',
        locator: { provider: 'onepassword', vault: 'Eng', item: '', field: '' },
      },
    ]);
  });

  it('fingerprint is insensitive to locator key order (chrome.storage alphabetizes)', () => {
    // Same data, keys in alphabetized (storage round-trip) order vs the
    // constructor's declaration order.
    const alphabetized: VaultSecret = {
      uid: 'abcd1234',
      kind: 'secret-manager',
      name: 'ApiToken',
      locator: { field: 'token', item: 'api.openheaders.io', provider: 'onepassword', vault: 'Engineering' },
    };
    expect(secretsFingerprint([alphabetized])).toBe(secretsFingerprint([SM_SECRET]));
  });

  it('projectSecretsToForm flattens locator leaves under secrets.<uid>.locator.*', () => {
    const form = projectSecretsToForm([SM_SECRET]);
    expect(form['secrets.abcd1234.name']).toBe('ApiToken');
    expect(form['secrets.abcd1234.kind']).toBe('secret-manager');
    expect(form['secrets.abcd1234.locator.provider']).toBe('onepassword');
    expect(form['secrets.abcd1234.locator.vault']).toBe('Engineering');
    expect(form['secrets.abcd1234.locator.item']).toBe('api.openheaders.io');
    expect(form['secrets.abcd1234.locator.field']).toBe('token');
  });
});
