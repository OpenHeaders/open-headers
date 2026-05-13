import { describe, expect, it } from 'vitest';
import type { Vault } from '../../src/types';
import { EMPTY_TOTP_REGISTRY, VariableResolver } from '../../src/variables';

function vaultWith(secrets: Vault['secrets']): Vault {
  return { schemaVersion: 5, secrets };
}

describe('VariableResolver — vault `kind` discriminator', () => {
  it('string-kind vault entries resolve to their stored value', () => {
    const r = new VariableResolver();
    r.setVault(vaultWith([{ uid: 'sec-001', kind: 'string', name: 'TOKEN', value: 'plain-token' }]));
    const out = r.resolve('TOKEN');
    expect(out?.value).toBe('plain-token');
    expect(out?.scope).toBe('vault');
    expect(out?.isSensitive).toBe(true);
  });

  it('totp-kind vault entries return null when no TOTP registry is installed', () => {
    // This is the architectural gate: the DNR compile pipeline never
    // installs a registry, so TOTP-kind entries surface as unresolved
    // and the rule referencing them is dropped from DNR.
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-002', kind: 'totp', name: 'GitHubTOTP', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    expect(r.resolve('GitHubTOTP')).toBeNull();
  });

  it('totp-kind vault entries resolve to the precomputed code from the registry', () => {
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-003', kind: 'totp', name: 'GitHubTOTP', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    r.setTotpRegistry(new Map([['GitHubTOTP', '123456']]));
    const out = r.resolve('GitHubTOTP');
    expect(out?.value).toBe('123456');
    expect(out?.scope).toBe('vault');
    expect(out?.isSensitive).toBe(true);
  });

  it('totp-kind entry NOT in the registry still surfaces as unresolved (per-entry granularity)', () => {
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-004', kind: 'totp', name: 'A', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
        { uid: 'sec-005', kind: 'totp', name: 'B', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    // Only A's code was precomputed. B falls through (e.g. seed
    // failed to decode in `buildTotpRegistry`).
    r.setTotpRegistry(new Map([['A', '111111']]));
    expect(r.resolve('A')?.value).toBe('111111');
    expect(r.resolve('B')).toBeNull();
  });

  it('clearing the registry (EMPTY_TOTP_REGISTRY) re-gates the entry', () => {
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-006', kind: 'totp', name: 'GitHubTOTP', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    r.setTotpRegistry(new Map([['GitHubTOTP', '123456']]));
    expect(r.resolve('GitHubTOTP')?.value).toBe('123456');
    r.setTotpRegistry(EMPTY_TOTP_REGISTRY);
    expect(r.resolve('GitHubTOTP')).toBeNull();
  });

  it('explicit `{{vault.X}}` follows the same kind discriminator', () => {
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-007', kind: 'string', name: 'StrKey', value: 'literal' },
        { uid: 'sec-008', kind: 'totp', name: 'TotpKey', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    r.setTotpRegistry(new Map([['TotpKey', '987654']]));
    const tplStr = r.resolveTemplate('{{vault.StrKey}} / {{vault.TotpKey}}');
    expect(tplStr.result).toBe('literal / 987654');
    expect(tplStr.errors).toEqual([]);
  });

  it('TOTP entry with no registry surfaces as `unset-in-scope` for explicit refs', () => {
    const r = new VariableResolver();
    r.setVault(
      vaultWith([
        { uid: 'sec-009', kind: 'totp', name: 'TotpKey', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
      ]),
    );
    const tplStr = r.resolveTemplate('Bearer {{vault.TotpKey}}');
    // Reference is left literal in the output, error surfaces.
    expect(tplStr.result).toBe('Bearer {{vault.TotpKey}}');
    expect(tplStr.errors).toHaveLength(1);
    expect(tplStr.errors[0]?.reason).toBe('unset-in-scope');
    expect(tplStr.errors[0]?.namespace).toBe('vault');
  });
});
