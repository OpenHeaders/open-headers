import { describe, expect, it } from 'vitest';
import type { Vault } from '../../src/types';
import {
  collectSentTemplateStrings,
  referencesSecretManager,
  secretManagerNamesOf,
  secretManagerReferences,
} from '../../src/variables';

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

  it('names the referenced rows once each — the count a transit sentence states', () => {
    const names = secretManagerNamesOf({
      ...VAULT,
      secrets: [
        ...VAULT.secrets,
        {
          uid: 'sec-sm02',
          kind: 'secret-manager',
          name: 'opKey',
          locator: {
            provider: 'onepassword',
            connectionId: 'conn0001',
            vault: 'Demo',
            item: 'api.openheaders.io',
            field: 'key',
          },
        },
      ],
    });
    const refs = secretManagerReferences(
      ['Bearer {{vault.opToken}}', '{{opToken}} {{vault.opKey}}', '{{Plain}}'],
      names,
    );
    expect([...refs].sort()).toEqual(['opKey', 'opToken']);
    expect(secretManagerReferences(['{{vault.opToken}}'], new Set()).size).toBe(0);
  });

  it('collects the templates a send would fill, skipping a row switched off', () => {
    const draft = {
      url: 'https://api.openheaders.io/{{env.path}}',
      headers: [
        { key: 'Authorization', value: 'Bearer {{vault.opToken}}', enabled: true },
        { key: 'X-Off', value: '{{vault.opKey}}', enabled: false },
      ],
      auth: { type: 'bearer', token: '{{opToken}}' },
      plain: 'no template',
    };
    expect(collectSentTemplateStrings(draft)).toEqual([
      'https://api.openheaders.io/{{env.path}}',
      'Bearer {{vault.opToken}}',
      '{{opToken}}',
    ]);
  });
});
