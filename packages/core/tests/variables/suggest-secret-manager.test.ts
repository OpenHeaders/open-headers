import { describe, expect, it } from 'vitest';
import { buildSuggestions, type SuggestionRegistries } from '../../src/variables';

const EMPTY_REGS: SuggestionRegistries = {
  vault: [],
  environments: [],
  activeEnvironmentId: null,
  defaultEnvironmentId: null,
  collections: [],
  workspaceVariables: [],
  liveRegistry: new Map(),
};

describe('buildSuggestions — vault secret-manager entries', () => {
  it('secret-manager entries surface with a provider + native-idiom reference preview', () => {
    const out = buildSuggestions(
      {
        ...EMPTY_REGS,
        vault: [
          {
            kind: 'secret-manager',
            name: 'ApiToken',
            locator: { provider: 'onepassword', vault: 'Engineering', item: 'api.openheaders.io', field: 'token' },
          },
        ],
      },
      {},
    );
    const row = out.find((s) => s.scope === 'vault' && s.preview.kind !== 'namespace');
    expect(row?.reference).toBe('vault.ApiToken');
    expect(row?.preview.kind).toBe('secret-manager');
    if (row?.preview.kind === 'secret-manager') {
      expect(row.preview.provider).toBe('onepassword');
      expect(row.preview.reference).toBe('op://Engineering/api.openheaders.io/token');
    }
  });

  it('never carries a resolved value in the preview', () => {
    const out = buildSuggestions(
      {
        ...EMPTY_REGS,
        vault: [{ kind: 'secret-manager', name: 'BwToken', locator: { provider: 'bitwarden', secretId: 'bw-id' } }],
      },
      {},
    );
    const row = out.find((s) => s.scope === 'vault' && s.preview.kind !== 'namespace');
    expect(row?.preview.kind).toBe('secret-manager');
    expect(row?.preview).not.toHaveProperty('value');
  });
});
