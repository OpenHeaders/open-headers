import { describe, expect, it } from 'vitest';
import type { ExclusivityReason } from '../../src/live/execution-policy';
import {
  electOfflineFallbackRunner,
  isFallbackEligible,
  type LocalSecretAvailability,
  requiredFallbackSecrets,
} from '../../src/live/offline-fallback-election';

// ── Factories ──────────────────────────────────────────────────────

const totp = (vaultName: string, indirectVia?: string): ExclusivityReason => ({ kind: 'totp', vaultName, indirectVia });
const oauth = (credentialRef: string): ExclusivityReason => ({
  kind: 'rotating-oauth',
  credentialRef,
  flow: 'authorization-code-pkce',
});
const optIn: ExclusivityReason = { kind: 'opt-in' };

function availability(overrides: Partial<{ vault: string[]; oauth: string[] }> = {}): LocalSecretAvailability {
  return {
    vaultNames: new Set(overrides.vault ?? []),
    oauthCredentialRefs: new Set(overrides.oauth ?? []),
  };
}

// ── requiredFallbackSecrets ────────────────────────────────────────

describe('requiredFallbackSecrets', () => {
  it('collects TOTP vault names and OAuth credential refs, deduped', () => {
    const got = requiredFallbackSecrets([totp('seed-a'), totp('seed-a', 'aliasVar'), oauth('cred-1'), oauth('cred-1')]);
    expect([...got.vaultNames]).toEqual(['seed-a']);
    expect([...got.oauthCredentialRefs]).toEqual(['cred-1']);
  });

  it('opt-in contributes no required secret', () => {
    const got = requiredFallbackSecrets([optIn]);
    expect(got.vaultNames.size).toBe(0);
    expect(got.oauthCredentialRefs.size).toBe(0);
  });

  it('keys an indirect TOTP by its root vault name, not the alias', () => {
    const got = requiredFallbackSecrets([totp('root-seed', 'wsVar')]);
    expect([...got.vaultNames]).toEqual(['root-seed']);
  });
});

// ── isFallbackEligible ─────────────────────────────────────────────

describe('isFallbackEligible', () => {
  it('eligible when the local vault holds every consumed TOTP seed', () => {
    expect(isFallbackEligible([totp('seed-a')], availability({ vault: ['seed-a'] }))).toBe(true);
  });

  it('ineligible when a consumed TOTP seed is absent locally (cross-device host)', () => {
    expect(isFallbackEligible([totp('seed-a')], availability({ vault: [] }))).toBe(false);
  });

  it('ineligible when only some of several consumed seeds are resident', () => {
    expect(isFallbackEligible([totp('seed-a'), totp('seed-b')], availability({ vault: ['seed-a'] }))).toBe(false);
  });

  it('eligible when the OAuth bundle ref is resident', () => {
    expect(isFallbackEligible([oauth('cred-1')], availability({ oauth: ['cred-1'] }))).toBe(true);
  });

  it('ineligible when the required OAuth bundle ref is absent', () => {
    expect(isFallbackEligible([oauth('cred-1')], availability({ oauth: [] }))).toBe(false);
  });

  it('opt-in-only exclusivity requires nothing local — eligible everywhere', () => {
    expect(isFallbackEligible([optIn], availability())).toBe(true);
  });

  it('mixed reasons need BOTH the seed and the bundle present', () => {
    const reasons = [totp('seed-a'), oauth('cred-1')];
    expect(isFallbackEligible(reasons, availability({ vault: ['seed-a'], oauth: ['cred-1'] }))).toBe(true);
    expect(isFallbackEligible(reasons, availability({ vault: ['seed-a'] }))).toBe(false);
    expect(isFallbackEligible(reasons, availability({ oauth: ['cred-1'] }))).toBe(false);
  });
});

// ── electOfflineFallbackRunner ─────────────────────────────────────

describe('electOfflineFallbackRunner', () => {
  it('elects the eligible rank-0 host', () => {
    expect(
      electOfflineFallbackRunner({ priorityList: ['p-self', 'p-other'], selfPrincipalId: 'p-self', eligible: true }),
    ).toEqual({ elected: true });
  });

  it('declines a host outranked by a higher entry', () => {
    expect(
      electOfflineFallbackRunner({ priorityList: ['p-other', 'p-self'], selfPrincipalId: 'p-self', eligible: true }),
    ).toEqual({ elected: false, reason: 'outranked' });
  });

  it('does NOT promote on a closed rank-0 — rank-1 stays deferred (no failover)', () => {
    // The list still ranks the (now-closed) rank-0 host above self; self
    // never promotes — exactly the §C.4 accepted "rank-1 closed → banner".
    expect(
      electOfflineFallbackRunner({ priorityList: ['p-gone', 'p-self'], selfPrincipalId: 'p-self', eligible: true }),
    ).toEqual({ elected: false, reason: 'outranked' });
  });

  it('declines an eligible host that is not in the list', () => {
    expect(
      electOfflineFallbackRunner({ priorityList: ['p-other'], selfPrincipalId: 'p-self', eligible: true }),
    ).toEqual({ elected: false, reason: 'not-listed' });
  });

  it('safe default: empty list → no fallback (banner), never a race', () => {
    expect(electOfflineFallbackRunner({ priorityList: [], selfPrincipalId: 'p-self', eligible: true })).toEqual({
      elected: false,
      reason: 'no-list',
    });
  });

  it('unknown self-identity → no-list (cannot claim rank-0)', () => {
    expect(electOfflineFallbackRunner({ priorityList: ['p-other'], selfPrincipalId: null, eligible: true })).toEqual({
      elected: false,
      reason: 'no-list',
    });
  });

  it('ineligibility short-circuits ahead of ranking (cross-device rank-0 never fires)', () => {
    expect(
      electOfflineFallbackRunner({ priorityList: ['p-self'], selfPrincipalId: 'p-self', eligible: false }),
    ).toEqual({ elected: false, reason: 'ineligible' });
  });
});
