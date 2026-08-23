/**
 * Server claim support for the web tab — the SPA side of the front
 * door's unclaimed state (the server front door plan §4.2).
 *
 * The first browser to reach an unclaimed server creates the admin
 * account. It is the successor to the gate that asked a stranger to
 * paste `ohd show-token` output: a browser never pastes a machine
 * credential, and with the claim shipped it never has to.
 *
 * Both routes are composed on EVERY deployment, SSO included, so the
 * probe is well-defined everywhere — an IdP-fronted daemon answers
 * `unclaimed: false` and means it. The JSON-only guard the password
 * probe uses is kept regardless: anything that is not JSON is the
 * static SPA fallback answering under an auth URL, and that has to
 * read as "claimed", never as "offer to set this server up".
 *
 * A successful claim answers with the same `secret` field
 * `/auth/password/login` does, so it rides the existing candidate →
 * HELLO → persist path unchanged — the claim is a third way to obtain
 * an ordinary session, not a second way to hold one. `revokedTokens`
 * rides along as the claim's disclosure of how many paired devices it
 * just unpaired.
 *
 * Refusals arrive split by what they reveal: a typed 400 the form
 * renders beside the field it names, and one byte-identical 403 for
 * everything that turns on server state — already claimed, a wrong or
 * stale setup code, an SSO server.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type { MessageKey } from '@openheaders/i18n';

const SCOPE = 'SetupClaim';

const META_PATH = '/auth/setup/meta';
const CLAIM_PATH = '/auth/setup/claim';
const META_PROBE_TIMEOUT_MS = 1500;

/**
 * Mirrors the daemon's own minimum. The server re-runs the check and
 * owns the verdict; holding it here lets the form refuse a short
 * password without spending a round trip on a typo.
 */
export const PASSWORD_MIN_LENGTH = 8;

export interface SetupMeta {
  /** No directory user has ever been admitted, and no IdP is configured. */
  readonly unclaimed: boolean;
  /** The claim is open and a setup code exists — non-loopback browsers must carry it. */
  readonly requiresCode: boolean;
}

export interface SetupClaimInput {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  /** Unnecessary from the server's own browser, mandatory from anywhere else. */
  readonly code: string;
}

/** Wrong in a way the person filling the form can see and fix. */
export type SetupClaimInvalidReason =
  | 'display-name-required'
  | 'email-required'
  | 'password-too-short'
  | 'malformed-request';

export type SetupClaimResult =
  | { readonly ok: true; readonly secret: string; readonly revokedTokens: number }
  | { readonly ok: false; readonly kind: 'invalid'; readonly reason: SetupClaimInvalidReason }
  /** The uniform 403 — already claimed, wrong or stale code, an SSO server. */
  | { readonly ok: false; readonly kind: 'refused' }
  | { readonly ok: false; readonly kind: 'offline' };

/**
 * Is this server waiting to be claimed? Fails towards "claimed": an
 * unreachable or non-JSON answer must never draw a create-the-admin
 * form on a server that already has one.
 */
export async function fetchSetupMeta(): Promise<SetupMeta> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), META_PROBE_TIMEOUT_MS);
    const response = await fetch(META_PATH, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) {
      return { unclaimed: false, requiresCode: false };
    }
    const payload = (await response.json()) as { unclaimed?: unknown; requiresCode?: unknown };
    return { unclaimed: payload.unclaimed === true, requiresCode: payload.requiresCode === true };
  } catch {
    return { unclaimed: false, requiresCode: false };
  }
}

/** Create the first admin and take the session it mints. */
export async function submitSetupClaim(input: SetupClaimInput): Promise<SetupClaimResult> {
  const code = input.code.trim();
  try {
    const response = await fetch(CLAIM_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: input.displayName.trim(),
        email: input.email.trim(),
        password: input.password,
        ...(code ? { code } : {}),
      }),
    });
    if (!(response.headers.get('content-type') ?? '').includes('application/json')) {
      return { ok: false, kind: 'offline' };
    }
    const payload = (await response.json()) as {
      ok?: unknown;
      secret?: unknown;
      revokedTokens?: unknown;
      reason?: unknown;
    };
    if (response.ok && payload.ok === true && typeof payload.secret === 'string') {
      return {
        ok: true,
        secret: payload.secret,
        revokedTokens: typeof payload.revokedTokens === 'number' ? payload.revokedTokens : 0,
      };
    }
    if (response.status === 400) {
      return { ok: false, kind: 'invalid', reason: asInvalidReason(payload.reason) };
    }
    return { ok: false, kind: 'refused' };
  } catch (err) {
    logger.warn(SCOPE, 'claim failed', err);
    return { ok: false, kind: 'offline' };
  }
}

/** A reason the route does not name yet reads as a body this build could not compose. */
function asInvalidReason(reason: unknown): SetupClaimInvalidReason {
  switch (reason) {
    case 'display-name-required':
    case 'email-required':
    case 'password-too-short':
      return reason;
    default:
      return 'malformed-request';
  }
}

/** The setup form's field a typed 400 belongs to — null goes to the card's error line. */
export type SetupClaimField = 'displayName' | 'email' | 'password';

export interface SetupClaimFieldError {
  readonly field: SetupClaimField | null;
  readonly key: MessageKey;
}

/** Where a typed 400 renders, and what it says there. */
export function setupClaimInvalidError(reason: SetupClaimInvalidReason): SetupClaimFieldError {
  switch (reason) {
    case 'display-name-required':
      return { field: 'displayName', key: 'web.gate.setupErrorDisplayName' };
    case 'email-required':
      return { field: 'email', key: 'web.gate.setupErrorEmail' };
    case 'password-too-short':
      return { field: 'password', key: 'web.gate.setupErrorPasswordShort' };
    default:
      return { field: null, key: 'web.gate.setupErrorMalformed' };
  }
}
