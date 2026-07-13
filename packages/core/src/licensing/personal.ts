/**
 * Personal-seat identity match — the enforcement rule that makes a
 * `kind: 'personal-seat'` license an admission ticket for its holder
 * and nobody else. Pure and daemon-local: the licensee's email claim
 * must equal the presenting user's verified email under the same
 * case-insensitive fold the directory's SSO join uses. No central
 * state, no presence tracking, no machine binding — a mismatch is a
 * typed refusal, which IS the anti-sharing mechanism.
 */

import type { License } from './schema';

export type PersonalSeatIdentityMismatchReason =
  /** The artifact is an org license, not a personal seat. */
  | 'not-personal-seat'
  /** The license carries no licensee email — unredeemable as issued. */
  | 'licensee-email-missing'
  /** The presenting user has no verified email identity to match against. */
  | 'presented-email-missing'
  /** Both emails exist and differ — the license belongs to someone else. */
  | 'identity-mismatch';

export type PersonalSeatIdentityResult =
  | { readonly ok: true; readonly email: string }
  | { readonly ok: false; readonly reason: PersonalSeatIdentityMismatchReason };

/** The directory's email fold: trimmed, lowercased. */
export function foldLicenseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Procurement-control seam — same pattern as the seat-limit provider:
 * the daemon spine installs its config knob at boot; unset (desktop,
 * tests) redemption is allowed. Consulted at every admission, never
 * cached.
 */
let redemptionProvider: (() => boolean) | null = null;

export function setPersonalSeatRedemptionProvider(next: (() => boolean) | null): void {
  redemptionProvider = next;
}

export function isPersonalSeatRedemptionEnabled(): boolean {
  return redemptionProvider?.() ?? true;
}

/**
 * Decide whether `presentedEmail` (the joining user's verified email)
 * is the holder of `license`. On match, returns the folded email — the
 * canonical form callers stamp into admission provenance.
 */
export function matchPersonalSeatIdentity(
  license: Pick<License, 'kind' | 'licensee'>,
  presentedEmail: string | null | undefined,
): PersonalSeatIdentityResult {
  if (license.kind !== 'personal-seat') return { ok: false, reason: 'not-personal-seat' };
  const licenseeEmail = license.licensee.email?.trim();
  if (!licenseeEmail) return { ok: false, reason: 'licensee-email-missing' };
  const presented = presentedEmail?.trim();
  if (!presented) return { ok: false, reason: 'presented-email-missing' };
  const folded = foldLicenseEmail(presented);
  if (folded !== foldLicenseEmail(licenseeEmail)) return { ok: false, reason: 'identity-mismatch' };
  return { ok: true, email: folded };
}
