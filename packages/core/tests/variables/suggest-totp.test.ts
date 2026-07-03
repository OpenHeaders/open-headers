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

describe('buildSuggestions — vault TOTP entries', () => {
  it('totp-kind vault entries surface with a `totp` preview carrying algorithm/digits/period', () => {
    const out = buildSuggestions(
      {
        ...EMPTY_REGS,
        vault: [{ kind: 'totp', name: 'GitHubTOTP', algorithm: 'SHA1', digits: 6, period: 30 }],
      },
      {},
    );
    const totpRow = out.find((s) => s.scope === 'vault');
    expect(totpRow).toBeDefined();
    expect(totpRow?.reference).toBe('vault.GitHubTOTP');
    expect(totpRow?.preview.kind).toBe('totp');
    if (totpRow?.preview.kind === 'totp') {
      expect(totpRow.preview.algorithm).toBe('SHA1');
      expect(totpRow.preview.digits).toBe(6);
      expect(totpRow.preview.period).toBe(30);
    }
  });

  it('issuer rides the TOTP preview when present', () => {
    const out = buildSuggestions(
      {
        ...EMPTY_REGS,
        vault: [{ kind: 'totp', name: 'AwsTOTP', algorithm: 'SHA256', digits: 6, period: 30, issuer: 'AWS' }],
      },
      {},
    );
    const row = out.find((s) => s.scope === 'vault');
    expect(row?.preview.kind).toBe('totp');
    if (row?.preview.kind === 'totp') {
      expect(row.preview.issuer).toBe('AWS');
    }
  });

  it('string-kind and totp-kind vault entries can coexist', () => {
    const out = buildSuggestions(
      {
        ...EMPTY_REGS,
        vault: [
          { kind: 'string', name: 'API_KEY', value: 'sk_abc' },
          { kind: 'totp', name: 'GitHubTOTP', algorithm: 'SHA1', digits: 6, period: 30 },
        ],
      },
      {},
    );
    const refs = out.filter((s) => s.scope === 'vault' && s.preview.kind !== 'namespace').map((s) => s.reference);
    expect(refs).toEqual(['vault.API_KEY', 'vault.GitHubTOTP']);
    const apiKey = out.find((s) => s.reference === 'vault.API_KEY');
    const totp = out.find((s) => s.reference === 'vault.GitHubTOTP');
    expect(apiKey?.preview.kind).toBe('value');
    expect(totp?.preview.kind).toBe('totp');
  });
});
