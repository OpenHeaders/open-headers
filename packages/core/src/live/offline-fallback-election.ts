/**
 * Offline fallback election for exclusive Live Workflows (WS-C C14 / C15).
 *
 * Only matters when the backend is **offline** *and* the workflow is
 * **exclusive** (a concurrent run burns a single-use TOTP code / trips
 * OAuth reuse-detection and silently revokes the session). Idempotent
 * workflows just self-refresh everywhere when the backend is gone —
 * harmless, no election, no UI.
 *
 * The hard constraint: with the backend down the browsers are **fully
 * partitioned** — the desktop is the only path between them (extensions
 * can't bind sockets; the unified-oracle model §4.1`), so "exactly one
 * runner across browsers" can't be coordinated live (FLP/CAP). Each peer
 * therefore decides **locally**, with no live coordination, from two
 * inputs captured *while it was still connected*:
 *
 *   1. a frozen, last-synced **priority list** — an explicit, user-ordered
 *      ranking of the host identities (`Principal.id`) eligible to take
 *      over (the live-runner ownership plan §C.4);
 *   2. its own **seed eligibility** — whether it locally holds every secret
 *      the workflow consumes. A same-device host holds the loopback-synced
 *      vault seed (WS-B); a cross-device host structurally never does.
 *
 * The rule is **static-priority master/backup without failover** (VRRP /
 * keepalived, plan §5): the single rank-0 *eligible* host self-refreshes;
 * everyone else shows the "reconnect the desktop" banner. There is
 * deliberately **no promotion** when rank-0 is closed/evicted — promotion
 * needs liveness detection the partition can't provide, and a wrong
 * promotion double-runs the exclusive cred. rank-0 closed → nobody
 * refreshes → banner; the user relaunches the desktop or the primary
 * browser (plan §C.4 accepted failure semantics). The CAP boundary is
 * documented, not solved.
 *
 * Pure — no I/O. The host assembles `priorityList` from its frozen synced
 * copy, `selfPrincipalId` from its identity snapshot, and `eligible` from
 * its local secret availability, then passes them in.
 */

import type { ExclusivityReason } from './execution-policy';

// ── Eligibility (C15) ─────────────────────────────────────────────

/** The local secrets a workflow's exclusive credential needs to run on THIS host. */
export interface RequiredFallbackSecrets {
  /**
   * `kind: 'totp'` vault entry names the chain consumes. Loopback-gated
   * (WS-B B1) — replicated to paired same-device hosts only, so holding
   * the seed is exactly the same-device signal a cross-device host lacks.
   */
  vaultNames: ReadonlySet<string>;
  /**
   * Rotating-OAuth credential refs the chain authes with. The token
   * bundle syncs trust-zone-wide (rides §4 like OAuth always has), so any
   * paired host holds it — this does not distinguish same- from
   * cross-device the way the vault seed does.
   */
  oauthCredentialRefs: ReadonlySet<string>;
}

/**
 * Reduce a workflow's exclusivity reasons to the consumed secret refs it
 * needs locally. `opt-in` reasons require nothing local (no credential
 * signal) and contribute neither set.
 */
export function requiredFallbackSecrets(reasons: readonly ExclusivityReason[]): RequiredFallbackSecrets {
  const vaultNames = new Set<string>();
  const oauthCredentialRefs = new Set<string>();
  for (const reason of reasons) {
    if (reason.kind === 'totp') vaultNames.add(reason.vaultName);
    else if (reason.kind === 'rotating-oauth') oauthCredentialRefs.add(reason.credentialRef);
  }
  return { vaultNames, oauthCredentialRefs };
}

/** What THIS host locally holds, for the eligibility check. */
export interface LocalSecretAvailability {
  /** Vault entry names resident in this host's vault. */
  vaultNames: ReadonlySet<string>;
  /** OAuth credential refs whose token bundle is resident in this host. */
  oauthCredentialRefs: ReadonlySet<string>;
}

/**
 * A host is fallback-eligible for a workflow iff it locally holds **every**
 * secret the workflow's exclusive credential consumes. A missing TOTP seed
 * (the cross-device case) → ineligible: such a host could neither produce
 * the value nor should it ever be elected (it would race-and-fail). An
 * `opt-in`-only exclusive workflow (no credential signal) requires nothing
 * local → eligible everywhere.
 */
export function isFallbackEligible(reasons: readonly ExclusivityReason[], available: LocalSecretAvailability): boolean {
  const required = requiredFallbackSecrets(reasons);
  for (const name of required.vaultNames) {
    if (!available.vaultNames.has(name)) return false;
  }
  for (const ref of required.oauthCredentialRefs) {
    if (!available.oauthCredentialRefs.has(ref)) return false;
  }
  return true;
}

// ── Election (C14) ────────────────────────────────────────────────

export type FallbackElectionVerdict = { elected: true } | { elected: false; reason: FallbackNotElectedReason };

/**
 * Why a host is not the offline fallback runner:
 *   - `ineligible` — doesn't hold the consumed seed (cross-device host).
 *   - `no-list` — no priority list (or self-identity) is known; the safe
 *     default is no fallback at all (value goes stale + banner), never a
 *     free-for-all self-refresh that would race.
 *   - `not-listed` — a list exists but this host isn't ranked in it.
 *   - `outranked` — this host is in the list but a higher-ranked host owns
 *     the fallback; it defers (no failover even if that host is gone).
 */
export type FallbackNotElectedReason = 'ineligible' | 'no-list' | 'not-listed' | 'outranked';

export interface ElectOfflineFallbackInput {
  /** Frozen, last-synced priority order — ordered `Principal.id`s. */
  priorityList: readonly string[];
  /** This host's stable synthetic identity (`Principal.id`, derived from `hostInstallId`); null if unknown. */
  selfPrincipalId: string | null;
  /** Whether this host holds every secret the workflow consumes (see {@link isFallbackEligible}). */
  eligible: boolean;
}

/**
 * Decide whether THIS host should be the single offline fallback runner
 * for an exclusive workflow whose backend is offline.
 *
 * Eligible **and** rank-0 in the frozen list → elected (self-refresh as
 * the sole runner). Anything else → not elected, with the reason for the
 * banner + logs. An empty/unknown list is the **safe** default (`no-list`):
 * no fallback, value goes stale, banner — never a race (plan §C.4 "if the
 * seed lives only on the desktop: no browser fallback → stale + banner").
 */
export function electOfflineFallbackRunner(input: ElectOfflineFallbackInput): FallbackElectionVerdict {
  if (!input.eligible) return { elected: false, reason: 'ineligible' };
  if (input.selfPrincipalId === null || input.priorityList.length === 0) {
    return { elected: false, reason: 'no-list' };
  }
  const rank = input.priorityList.indexOf(input.selfPrincipalId);
  if (rank === -1) return { elected: false, reason: 'not-listed' };
  return rank === 0 ? { elected: true } : { elected: false, reason: 'outranked' };
}
