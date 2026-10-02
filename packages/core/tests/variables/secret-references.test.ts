import { describe, expect, it } from 'vitest';
import type { Vault } from '../../src/types';
import { referencesSecretManager, secretManagerNamesOf } from '../../src/variables';

const VAULT: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'sec-plain', kind: 'string', name: 'Plain', value: 'p' },
    {
      uid: 'sec-sm01',
      kind: 'secret-manager',
      name: 'opToken',
      locator: {
        provider: 'onepassword',
        connectionId: 'conn0001',
        vault: 'Demo',
        item: 'api.openheaders.io',
        field: 'token',
      },
    },
  ],
};

describe('secret references — the names side of the redaction law', () => {
  it('collects the secret-manager row names and nothing else', () => {
    expect([...secretManagerNamesOf(VAULT)]).toEqual(['opToken']);
  });

  it('a template naming a secret-manager row references it, explicit or flat; a plain row does not', () => {
    const names = secretManagerNamesOf(VAULT);
    expect(referencesSecretManager(['Bearer {{vault.opToken}}'], names)).toBe(true);
    expect(referencesSecretManager(['Bearer {{opToken}}'], names)).toBe(true);
    expect(referencesSecretManager(['Bearer {{vault.Plain}}', '{{env.opToken}}'], names)).toBe(false);
    expect(referencesSecretManager(['Bearer {{vault.opToken}}'], new Set())).toBe(false);
  });
});
