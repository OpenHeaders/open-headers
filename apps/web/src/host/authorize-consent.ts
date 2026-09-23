/**
 * The SPA side of the consent route (the client sign-in plan §14.4) —
 * this tab as the approver of a native client's sign-in.
 *
 * The daemon's OAuth handler validates and parks the authorize (or
 * device verify) request and 302s the browser to `/#authorize=<id>`:
 * an opaque handle in the fragment, never the request's parameters.
 * This module pulls it out of the URL before anything else reads it,
 * fetches the record's public facts, and carries the person's decision
 * with the session bearer this tab already holds. The card never learns
 * a code or a token: an approval answers a redirect target on the code
 * grant (navigated, never parsed) and nothing on the device grant.
 *
 * An SSO refusal on this arm lands back on the same fragment with
 * `&error=<reason>` — the OIDC vocabulary, rendered as the gate renders
 * `#oidc-error=`. A refused bearer means this tab's session is stale:
 * it is dropped the way a sign-out drops it and the boot re-gates with
 * the id kept, never retried blindly.
 */

import type { AuthorizationFacts } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { peekDaemonToken } from './daemon-token';
import { signOutWeb } from './sign-out';

const SCOPE = 'AuthorizeConsent';

const AUTHORIZE_HASH_KEY = 'authorize';
const AUTHORIZE_HASH_PREFIX = `#${AUTHORIZE_HASH_KEY}=`;
const RECORD_PATH_PREFIX = '/auth/oauth/authorize/';

const CLIENT_KINDS: ReadonlySet<string> = new Set(['desktop', 'extension', 'cli']);
const GRANTS: ReadonlySet<string> = new Set(['code', 'device']);
const STATUSES: ReadonlySet<string> = new Set(['pending', 'approved', 'denied', 'consumed', 'expired']);
const DECISION_REFUSALS: ReadonlySet<string> = new Set(['unknown', 'expired', 'denied', 'consumed']);

/** A pending decision carried across the boot — the record's id and the SSO arm's refusal when there was one. */
export interface PendingAuthorization {
  readonly id: string;
  readonly error?: string;
}

/** The fragment the boot lands on, rebuilt when the tab must reload with the decision kept. */
export function authorizeLocation(id: string): string {
  return `/${AUTHORIZE_HASH_PREFIX}${encodeURIComponent(id)}`;
}

/**
 * Pull the pending authorization out of `location.hash` and strip it
 * from the URL (and browser history) at once, the way the OIDC result
 * is consumed — the id is held in memory for the life of the decision.
 */
export function consumeAuthorizeHash(
  location: Pick<Location, 'hash'> = window.location,
  replaceUrl: (url: string) => void = (url) => window.history.replaceState(null, '', url),
): PendingAuthorization | null {
  const hash = location.hash;
  if (!hash.startsWith(AUTHORIZE_HASH_PREFIX)) return null;
  const params = new URLSearchParams(hash.slice(1));
  const id = params.get(AUTHORIZE_HASH_KEY) ?? '';
  const error = params.get('error') ?? '';
  replaceUrl('/');
  if (!id) return null;
  return error ? { id, error } : { id };
}

function isFacts(value: unknown): value is AuthorizationFacts {
  if (value === null || typeof value !== 'object') return false;
  const facts = value as Record<string, unknown>;
  return (
    typeof facts.id === 'string' &&
    typeof facts.clientId === 'string' &&
    typeof facts.clientKind === 'string' &&
    CLIENT_KINDS.has(facts.clientKind) &&
    typeof facts.clientName === 'string' &&
    typeof facts.grant === 'string' &&
    GRANTS.has(facts.grant) &&
    (facts.deviceLabel === undefined || typeof facts.deviceLabel === 'string') &&
    (facts.userCode === undefined || typeof facts.userCode === 'string') &&
    typeof facts.peer === 'string' &&
    typeof facts.status === 'string' &&
    STATUSES.has(facts.status) &&
    typeof facts.expiresAt === 'number'
  );
}

export type AuthorizationRead =
  | { readonly ok: true; readonly facts: AuthorizationFacts }
  | { readonly ok: false; readonly reason: 'unknown' | 'offline' };

/** The record's public facts — a 404 is an unknown id; anything but a JSON `ok` answer reads as offline. */
export async function fetchAuthorizationFacts(id: string, fetchFn: typeof fetch = fetch): Promise<AuthorizationRead> {
  try {
    const response = await fetchFn(`${RECORD_PATH_PREFIX}${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { ok: false, reason: 'unknown' };
    if (!response.ok) return { ok: false, reason: 'offline' };
    const payload = (await response.json()) as { ok?: unknown; authorization?: unknown };
    if (payload.ok !== true || !isFacts(payload.authorization)) return { ok: false, reason: 'offline' };
    return { ok: true, facts: payload.authorization };
  } catch (err) {
    logger.warn(SCOPE, 'authorization read failed', err);
    return { ok: false, reason: 'offline' };
  }
}

/** The server's verdict on a decision that found no pending record. */
export type DecisionRefusal = 'unknown' | 'expired' | 'denied' | 'consumed';

export type ApproveOutcome =
  | { readonly ok: true; readonly redirectTo: string | null }
  | { readonly ok: false; readonly reason: DecisionRefusal | 'session-refused' | 'offline' };

function refusalFrom(status: number, payload: { reason?: unknown }): DecisionRefusal {
  if (status === 404) return 'unknown';
  return typeof payload.reason === 'string' && DECISION_REFUSALS.has(payload.reason)
    ? (payload.reason as DecisionRefusal)
    : 'expired';
}

/**
 * Approve as the signed-in person: the session bearer names the
 * approver. The code grant answers where the browser goes next — the
 * client's registered redirect, opaque to this tab; the device grant
 * answers nothing, the device's poll takes it from there. A 401 is the
 * bearer refused, never the record.
 */
export async function approveAuthorization(id: string, fetchFn: typeof fetch = fetch): Promise<ApproveOutcome> {
  const bearer = peekDaemonToken();
  if (bearer === null) return { ok: false, reason: 'session-refused' };
  try {
    const response = await fetchFn(`${RECORD_PATH_PREFIX}${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: '{}',
    });
    if (response.status === 401) return { ok: false, reason: 'session-refused' };
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: unknown;
      redirectTo?: unknown;
      reason?: unknown;
    };
    if (response.status === 404 || response.status === 410)
      return { ok: false, reason: refusalFrom(response.status, payload) };
    if (!response.ok || payload.ok !== true) return { ok: false, reason: 'offline' };
    return { ok: true, redirectTo: typeof payload.redirectTo === 'string' ? payload.redirectTo : null };
  } catch (err) {
    logger.warn(SCOPE, 'approve failed', err);
    return { ok: false, reason: 'offline' };
  }
}

export type DenyOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: DecisionRefusal | 'offline' };

/** "Not me" — no credential needed; the record settles denied. */
export async function denyAuthorization(id: string, fetchFn: typeof fetch = fetch): Promise<DenyOutcome> {
  try {
    const response = await fetchFn(`${RECORD_PATH_PREFIX}${encodeURIComponent(id)}/deny`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: '{}',
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: unknown; reason?: unknown };
    if (response.status === 404 || response.status === 410)
      return { ok: false, reason: refusalFrom(response.status, payload) };
    if (!response.ok || payload.ok !== true) return { ok: false, reason: 'offline' };
    return { ok: true };
  } catch (err) {
    logger.warn(SCOPE, 'deny failed', err);
    return { ok: false, reason: 'offline' };
  }
}

/** What the card draws — the record's state as read or as settled by a decision. */
export type ConsentState =
  | { readonly kind: 'pending'; readonly facts: AuthorizationFacts }
  | { readonly kind: 'approved' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'offline' };

/** The record as read: a settled record draws its verdict, `consumed` being an approval the client redeemed. */
export function consentStateFromRead(read: AuthorizationRead): ConsentState {
  if (!read.ok) return { kind: read.reason };
  switch (read.facts.status) {
    case 'pending':
      return { kind: 'pending', facts: read.facts };
    case 'approved':
    case 'consumed':
      return { kind: 'approved' };
    case 'denied':
      return { kind: 'denied' };
    case 'expired':
      return { kind: 'expired' };
  }
}

/** A decision refused because the record had already settled draws that verdict. */
export function consentStateFromRefusal(reason: DecisionRefusal): ConsentState {
  switch (reason) {
    case 'unknown':
      return { kind: 'unknown' };
    case 'expired':
      return { kind: 'expired' };
    case 'denied':
      return { kind: 'denied' };
    case 'consumed':
      return { kind: 'approved' };
  }
}

/**
 * The session this tab holds was refused as the approver — drop it as
 * a sign-out does and reload on the consent fragment, so the boot gates
 * first and returns to the card with the id kept.
 */
export function reGateWithAuthorization(
  id: string,
  navigate: () => void = () => {
    window.history.replaceState(null, '', authorizeLocation(id));
    window.location.reload();
  },
): Promise<void> {
  return signOutWeb(navigate);
}
