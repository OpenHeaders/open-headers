/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) — the host-neutral
 * half of the flow. A host POSTs the device authorization request,
 * shows the user the verification URI + user code, and polls the token
 * endpoint at the cadence the provider dictates until the user approves
 * on another device (or refuses, or the code expires). What lives here:
 *
 *   • the device authorization response parser (§3.2) — the pending
 *     record a host keeps while the user approves;
 *   • the pure poll reducer (§3.4 / §3.5): one poll's outcome plus the
 *     clock → grant, wait (the interval, grown by `slow_down`), denial,
 *     expiry, or failure. The host owns the timer and the wire; the
 *     reducer owns the rules, so a unit test walks every branch without
 *     a network;
 *   • the state vocabulary every host broadcasts to its editor and
 *     answers on the status channel — the same record the CLI polls.
 *
 * The `device_code` is the grant's secret half (§5.1 — never shown to
 * the user); the public {@link OAuth2DeviceApproval} facts are what
 * cross to a UI surface, the full {@link OAuth2DeviceAuthorization}
 * stays host-side.
 */

import { type OAuth2TokenBundle, parseTokenResponse } from './index';

export const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code';

/** §3.2: a response without `interval` means five seconds. */
export const DEVICE_DEFAULT_INTERVAL_SECONDS = 5;

/** §3.5: `slow_down` grows the interval by five seconds, permanently. */
export const DEVICE_SLOW_DOWN_INCREMENT_SECONDS = 5;

/** The facts a user sees while approving: where to go, what to type,
 *  how long they have. Safe to show and to broadcast. */
export interface OAuth2DeviceApproval {
  userCode: string;
  verificationUri: string;
  /** §3.3.1 — the URI with the code embedded, when the provider offers one. */
  verificationUriComplete?: string;
  /** Absolute wall-clock ms the device code stops being redeemable. */
  expiresAt: number;
  /** Seconds between polls — the provider's `interval`, grown by every `slow_down`. */
  intervalSeconds: number;
}

/** The pending record a host keeps — the approval facts plus the
 *  `device_code` the poll redeems. Never crosses to a UI surface. */
export interface OAuth2DeviceAuthorization extends OAuth2DeviceApproval {
  deviceCode: string;
}

/**
 * Fold a device authorization response (§3.2) into the pending record.
 * `device_code`, `user_code`, `verification_uri` and `expires_in` are
 * required; `interval` defaults to five seconds and a non-positive
 * value falls back to it (a provider cannot ask for a zero-second
 * poll); `verification_uri_complete` is kept when present.
 */
export function parseDeviceAuthorizationResponse(
  json: Record<string, unknown>,
  issuedAt: number = Date.now(),
): OAuth2DeviceAuthorization {
  const deviceCode = asString(json.device_code);
  const userCode = asString(json.user_code);
  const verificationUri = asString(json.verification_uri);
  const expiresIn = asNumber(json.expires_in);
  if (!deviceCode) throw new Error('Device authorization response missing device_code');
  if (!userCode) throw new Error('Device authorization response missing user_code');
  if (!verificationUri) throw new Error('Device authorization response missing verification_uri');
  if (expiresIn === null) throw new Error('Device authorization response missing expires_in');
  const interval = asNumber(json.interval);
  const verificationUriComplete = asString(json.verification_uri_complete);
  return {
    deviceCode,
    userCode,
    verificationUri,
    ...(verificationUriComplete ? { verificationUriComplete } : {}),
    expiresAt: issuedAt + expiresIn * 1000,
    intervalSeconds: interval !== null && interval > 0 ? interval : DEVICE_DEFAULT_INTERVAL_SECONDS,
  };
}

/** One poll of the token endpoint as the host saw it: the HTTP status
 *  and the parsed JSON body (`null` when the body was not JSON). */
export interface DevicePollResponse {
  status: number;
  json: Record<string, unknown> | null;
}

/** What the reducer decides after one poll. */
export type DevicePollStep =
  | { kind: 'granted'; bundle: OAuth2TokenBundle }
  | { kind: 'wait'; delayMs: number; intervalSeconds: number }
  | { kind: 'denied'; message: string }
  | { kind: 'expired'; message: string }
  | { kind: 'failed'; message: string };

/**
 * The §3.5 rules over one poll outcome. A 2xx body is the token
 * response (a malformed one fails the flow); `authorization_pending`
 * waits one interval; `slow_down` grows the interval by five seconds
 * and waits the grown interval; `access_denied` is the user's refusal;
 * `expired_token` — or a wait that would outlive `expiresAt` — is the
 * code's expiry; anything else fails with the provider's own words.
 */
export function stepDevicePoll(
  pending: OAuth2DeviceAuthorization,
  response: DevicePollResponse,
  now: number = Date.now(),
): DevicePollStep {
  const { status, json } = response;
  if (status >= 200 && status < 300) {
    if (json === null) return { kind: 'failed', message: 'Token endpoint returned non-JSON body' };
    try {
      return { kind: 'granted', bundle: parseTokenResponse(json, now) };
    } catch (err) {
      return { kind: 'failed', message: `Failed to parse token response: ${(err as Error).message}` };
    }
  }
  const error = json === null ? null : asString(json.error);
  const description = json === null ? null : asString(json.error_description);
  const detail = description ? `${error}: ${description}` : (error ?? `HTTP ${status}`);
  switch (error) {
    case 'authorization_pending':
      return waitOrExpire(pending, pending.intervalSeconds, now);
    case 'slow_down':
      return waitOrExpire(pending, pending.intervalSeconds + DEVICE_SLOW_DOWN_INCREMENT_SECONDS, now);
    case 'access_denied':
      return { kind: 'denied', message: detail };
    case 'expired_token':
      return { kind: 'expired', message: detail };
    default:
      return { kind: 'failed', message: `Token endpoint returned ${status}: ${detail}` };
  }
}

function waitOrExpire(pending: OAuth2DeviceAuthorization, intervalSeconds: number, now: number): DevicePollStep {
  const delayMs = intervalSeconds * 1000;
  if (now + delayMs >= pending.expiresAt) {
    return { kind: 'expired', message: 'The device code expired before the authorization was approved' };
  }
  return { kind: 'wait', delayMs, intervalSeconds };
}

/**
 * The flow's observable state — what a host broadcasts on every
 * transition and answers on the status channel. `pending` carries the
 * approval facts (never the device code); the terminal states stay
 * readable until the next start or a cancel clears them, so a late
 * reader (the CLI's poll, a reopened editor) sees how the flow ended.
 */
export type OAuth2DeviceState =
  | { state: 'pending'; approval: OAuth2DeviceApproval; startedAt: number }
  | { state: 'granted'; grantedAt: number }
  | { state: 'denied'; message: string }
  | { state: 'expired'; message: string }
  | { state: 'failed'; message: string }
  | { state: 'cancelled' };

/** The approval facts of a pending record — the device code stripped. */
export function approvalOf(authorization: OAuth2DeviceAuthorization): OAuth2DeviceApproval {
  const { deviceCode: _secret, ...approval } = authorization;
  return approval;
}

/** The URI the "Open" affordance follows: the complete form when the
 *  provider gave one (the code pre-filled), else the plain one. */
export function deviceVerificationUrl(approval: OAuth2DeviceApproval): string {
  return approval.verificationUriComplete ?? approval.verificationUri;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
