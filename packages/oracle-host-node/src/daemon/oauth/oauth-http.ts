/**
 * The daemon's OAuth 2.0 authorization server for its OWN person
 * sign-in (the client sign-in plan §14.2) — the HTTP surface over the
 * authorization service in core. A native client (the extension, the
 * desktop app, the CLI) is a registered PUBLIC client; the person
 * approves in a browser; the client redeems at the token endpoint and
 * receives the `session`-kind credential the HELLO carries. Beside the
 * OIDC relying party under the identity prefix:
 *
 *   - `GET  /.well-known/oauth-authorization-server` — RFC 8414
 *     metadata, `issuer` = the admission-resolved external origin.
 *   - `GET  /auth/oauth/authorize` — the code grant's entry, a
 *     top-level navigation. Validated server-side, parked under an
 *     opaque id, then the browser is handed to the consent rendering:
 *     `302 /#authorize=<id>` where the web app can boot, else the
 *     server-rendered page below. A malformed request is refused ON
 *     THE PAGE — never redirected to an unverified `redirect_uri`.
 *   - `POST /auth/oauth/device` — RFC 8628 §3.1/§3.2: the device grant's
 *     start; `verification_uri` is the verify page, `_complete` carries
 *     the user code.
 *   - `GET  /auth/oauth/device/verify` — with `?user_code=` the same
 *     consent routing as authorize (the code is shown and the person
 *     asked to check it, §3.3.1 / §5.4); without it the "enter the
 *     code" page (the plain `verification_uri`).
 *   - `GET  /auth/oauth/authorize/<id>` — the record's public facts as
 *     JSON for the SPA's consent card (`Accept: application/json`), or
 *     the server-rendered consent page: the client, the device label,
 *     the user code on the device grant, the peer comparison, then the
 *     gate — the claim pointer, the credential form, the provider link
 *     (`/auth/oidc/start?authorize=<id>`) or the no-login sentence.
 *   - `POST /auth/oauth/authorize/<id>/approve` · `/deny` — the
 *     decision: the SPA's session bearer names the approver (the MCP
 *     handler's bearer idiom), or the fallback page's credential form
 *     verifies through the password service WITHOUT minting a browser
 *     session. Approve on the code grant answers the redirect target
 *     (`redirect_uri?code&state&iss`, RFC 9207) — JSON `{redirectTo}`
 *     for the SPA, a 303 for the page; on the device grant it settles
 *     the record. One `daemon.device-login` audit row per approval.
 *   - `POST /auth/oauth/token` — RFC 6749 §4.1.3 + RFC 8628 §3.4: the
 *     two grants, `application/x-www-form-urlencoded` or JSON; the
 *     RFC error vocabulary as 400s; a 2xx carries `access_token`,
 *     `token_type: "Bearer"`, `expires_in`. An `invalid_grant` on an
 *     UNKNOWN code or device code is reported to admission as a guess.
 *   - `POST /auth/oauth/revoke` — RFC 7009: the ledger's revoke of the
 *     presented token; 200 whatever the outcome.
 *
 * The token is never on any page: the code alone yields nothing, the
 * verifier / the device code binds the client, the mint happens at the
 * token endpoint. The page shell is the pairing surface's.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type ApproveAuthorizationResult,
  type AuthorizationFacts,
  type BeginCodeRefusalReason,
  type DaemonAuthorizationService,
  emitAuditEntry,
  findDaemonAuthorizationClient,
  peekDaemonAuthToken,
  resolveDaemonPeerUser,
  revokeDaemonAuthToken,
  validateDaemonAuthToken,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { DEVICE_CODE_GRANT_TYPE } from '@openheaders/core/oauth';
import { resolveExternalOrigin } from '../../host-runtime/external-origin';
import { readRawBody } from '../../host-runtime/http-body';
import { escapeHtml, htmlResponse, pageShell, renderState } from '../../host-runtime/pairing-http';
import { isLoopbackRemote } from '../../host-runtime/ws-server/classify';
import type { DaemonGateMode, GateModeResolver } from '../gate-mode';
import type { DaemonPasswordLoginService } from '../password/password-login-service';
import { CONSENT_PAGE_PREFIX, type ConsentRouter, fallbackConsentLocation } from './consent-route';

const SCOPE = 'OAuthHttp';

export const OAUTH_METADATA_PATH = '/.well-known/oauth-authorization-server';
export const OAUTH_PATH_PREFIX = '/auth/oauth/';
export const OAUTH_AUTHORIZE_PATH = '/auth/oauth/authorize';
export const OAUTH_DEVICE_PATH = '/auth/oauth/device';
export const OAUTH_DEVICE_VERIFY_PATH = '/auth/oauth/device/verify';
export const OAUTH_TOKEN_PATH = '/auth/oauth/token';
export const OAUTH_REVOKE_PATH = '/auth/oauth/revoke';
const DECISION_ROUTE = /^\/auth\/oauth\/authorize\/([A-Za-z0-9_-]+)\/(approve|deny)$/;
const RECORD_ROUTE = /^\/auth\/oauth\/authorize\/([A-Za-z0-9_-]+)$/;
const MAX_DEVICE_LABEL_LENGTH = 64;
const AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The OIDC arm's refusals, rendered as fixed sentences — never a URL's own words. */
const SSO_ERROR_LINES: Readonly<Record<string, string>> = {
  'unknown-user': 'That account is not a user on this server. Ask its administrator to add you.',
  'user-deactivated': 'That account has been deactivated on this server.',
  'seat-limit-reached': 'This server has no free seats for a new user. Ask its administrator.',
  'state-mismatch': 'The sign-in did not complete in this browser. Try again.',
};
const SSO_ERROR_FALLBACK = 'The sign-in did not complete. Try again.';

/** Why an authorize request is refused on the page, in the person's words. */
const AUTHORIZE_REFUSAL_LINES: Readonly<Record<BeginCodeRefusalReason | 'invalid-response-type', string>> = {
  'invalid-response-type': 'The request asks for a response type this server does not issue.',
  'unknown-client': 'The request names a client this server does not know.',
  'unsupported-grant': 'The request names a client that cannot use this sign-in.',
  'invalid-redirect': 'The request names a return address that is not registered for its client.',
  'invalid-state': 'The request carries no state.',
  'invalid-challenge': 'The request carries no valid S256 code challenge.',
  'too-many-pending': 'Too many sign-ins are waiting to be approved. Try again in a few minutes.',
};

export interface OAuthHttpOptions {
  readonly authorization: DaemonAuthorizationService;
  /** Admission's peer resolution — the socket address, or the trusted proxy's `X-Forwarded-For` entry. */
  readonly resolvePeer: (req: IncomingMessage) => string;
  /** The one server-side gate truth (`gate-mode.ts`). */
  readonly gateMode: GateModeResolver;
  /** The password verifier when password login is composed; null under SSO (the page offers the provider). */
  readonly passwordLogin: DaemonPasswordLoginService | null;
  /** Decides the consent rendering — the SPA's fragment entry or the server-rendered page. */
  readonly consent: ConsentRouter;
  /** Same trust posture as the admission control's peer resolution. */
  readonly trustedProxy?: boolean;
  /** Admission's guess counter — called once per `invalid_grant` on an unknown code or device code. */
  readonly reportGuess?: (req: IncomingMessage) => void;
  /** Test seams — default to the live audit sink and the live ledger. */
  readonly emitAudit?: typeof emitAuditEntry;
  readonly validateToken?: typeof validateDaemonAuthToken;
  readonly resolvePeerUser?: typeof resolveDaemonPeerUser;
  readonly peekToken?: typeof peekDaemonAuthToken;
  readonly revokeToken?: typeof revokeDaemonAuthToken;
}

/** Composition contract shared with healthz/pairing/mcp/oidc/password: `true` = response owned. */
export type OAuthHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface OAuthHttp {
  readonly handler: OAuthHttpHandler;
  /**
   * The audited approval — the ONE verb every arm binds a record with:
   * the SPA's bearer and the page's form here, the OIDC completion
   * through its `approveAuthorization` seam. One `daemon.device-login`
   * allow row per approval, the person as the actor.
   */
  readonly approveAuthorization: (id: string, userId: string) => Promise<ApproveAuthorizationResult>;
}

function jsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // RFC 6749 §5.1: a token response is never cached.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

function oauthError(res: ServerResponse, statusCode: number, error: string, description?: string): void {
  jsonResponse(res, statusCode, { error, ...(description ? { error_description: description } : {}) });
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.statusCode = 405;
  res.setHeader('Allow', allow);
  res.end();
}

function redirectResponse(res: ServerResponse, statusCode: 302 | 303, location: string): void {
  res.statusCode = statusCode;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  // The code-grant redirect carries the one-shot code; the fragment
  // entry carries the opaque id. Neither may leak via Referer chains.
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end();
}

/** A machine caller (the SPA's fetch) asks for JSON or sends it; a browser navigation or form does neither. */
function wantsJson(req: IncomingMessage): boolean {
  return (
    (req.headers.accept ?? '').includes('application/json') ||
    (req.headers['content-type'] ?? '').includes('application/json')
  );
}

function readBearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** One parameter reader for the form-encoded and JSON bodies every POST route accepts. */
function parseParams(req: IncomingMessage, raw: string): Map<string, string> | null {
  const params = new Map<string, string>();
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') params.set(key, value);
      }
      return params;
    } catch {
      return null;
    }
  }
  for (const [key, value] of new URLSearchParams(raw)) params.set(key, value);
  return params;
}

/** A device label is a display hint: trimmed, bounded, absent when empty; over-long is malformed. */
function parseDeviceLabel(raw: string | null | undefined): { ok: true; label?: string } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true };
  const trimmed = raw.trim();
  if (trimmed.length > MAX_DEVICE_LABEL_LENGTH) return { ok: false };
  return trimmed ? { ok: true, label: trimmed } : { ok: true };
}

function appendRedirectParams(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * The heading names WHAT asks; the address line appears only when the
 * client that asked and the browser now approving sit at different
 * peers — that is the one case an address tells the person anything.
 * The device grant shows its user code and asks the person to check it
 * (RFC 8628 §5.4).
 */
function consentHeading(facts: AuthorizationFacts, viewerPeer: string): string {
  const label = facts.deviceLabel?.trim();
  const who = label
    ? `<span class="device">${escapeHtml(label)}</span> (${escapeHtml(facts.clientName)})`
    : escapeHtml(capitalize(facts.clientName));
  const elsewhere =
    facts.peer !== viewerPeer
      ? `
<p class="warn">This request came from a different device at <code>${escapeHtml(facts.peer)}</code>. If that isn't you, click Not me.</p>`
      : '';
  const code =
    facts.userCode !== undefined
      ? `
<p>Code <code>${escapeHtml(facts.userCode)}</code> — check that it matches the code your device shows.</p>`
      : '';
  return `<h1>Approve this device?</h1>
<p>${who} asked to sign in to this server as you.</p>${elsewhere}${code}
<p class="muted">Expires in about ${Math.max(0, Math.round((facts.expiresAt - Date.now()) / 60000))} min</p>`;
}

function notMeForm(id: string): string {
  return `<form method="POST" action="${escapeHtml(fallbackConsentLocation(id))}/deny"><button type="submit" class="secondary">Not me</button></form>`;
}

function renderGate(
  facts: AuthorizationFacts,
  gate: DaemonGateMode,
  notice: string | null,
  viewerPeer: string,
): string {
  const id = escapeHtml(encodeURIComponent(facts.id));
  const noticeHtml = notice ? `<p class="err">${escapeHtml(notice)}</p>` : '';
  const heading = consentHeading(facts, viewerPeer);
  switch (gate.kind) {
    case 'setup':
      return `${heading}
<p>This server has no administrator yet. <a href="/">Set it up first</a>, then start the sign-in again from the device.</p>`;
    case 'sso':
      return `${heading}
${noticeHtml}
<p>Sign in with ${escapeHtml(gate.provider)} to approve it.</p>
<div class="row">
  <a class="button" href="/auth/oidc/start?authorize=${id}">Sign in with ${escapeHtml(gate.provider)}</a>
  ${notMeForm(facts.id)}
</div>`;
    case 'password':
      return `${heading}
${noticeHtml}
<p>Sign in with the email and password the server admin set for you to approve it.</p>
<form method="POST" action="${escapeHtml(fallbackConsentLocation(facts.id))}/approve" id="approve">
  <label class="field">Email<input name="email" type="email" autocomplete="username" required /></label>
  <label class="field">Password<input name="password" type="password" autocomplete="current-password" required /></label>
</form>
<div class="row">
  <button type="submit" form="approve">Approve</button>
  ${notMeForm(facts.id)}
</div>`;
    case 'no-login':
      return `${heading}
<p>Nobody can sign in to this server from a browser. Ask its administrator for a pairing code.</p>`;
  }
}

function renderApproved(): string {
  return pageShell(
    'Device approved',
    `<h1>Device approved</h1>
<p>The device is signed in as you. You can close this tab.</p>`,
  );
}

function renderDenied(): string {
  return pageShell(
    'Sign-in denied',
    `<h1>Sign-in denied</h1>
<p>That device will not be signed in. You can close this tab.</p>`,
  );
}

function renderRefusedCredential(id: string): string {
  // ONE body for every refusal — unknown email, no password, wrong
  // password, a locked account — so the page enumerates nothing.
  return pageShell(
    'Sign-in refused',
    `<h1 class="err">Sign-in refused</h1>
<p>That email and password were not accepted.</p>
<a class="button" href="${escapeHtml(fallbackConsentLocation(id))}">Try again</a>`,
  );
}

function renderMalformed(status: number, line: string): { status: number; body: string } {
  return {
    status,
    body: renderState('Sign-in request refused', `${line} Start the sign-in again from the device.`, 'unknown'),
  };
}

/** The "enter the code" page — RFC 8628 §3.3's plain `verification_uri`. */
function renderCodeEntry(notice: string | null): string {
  const noticeHtml = notice ? `<p class="err">${escapeHtml(notice)}</p>` : '';
  return pageShell(
    'Enter the code',
    `<h1>Enter the code your device shows</h1>
${noticeHtml}
<form method="GET" action="${OAUTH_DEVICE_VERIFY_PATH}">
  <label class="field">Code<input name="user_code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BCDF-GHJK" required /></label>
  <button type="submit">Continue</button>
</form>`,
  );
}

/** The state page for a record that is not pending, with its HTTP status. */
function settledStatePage(status: Exclude<AuthorizationFacts['status'], 'pending'> | 'unknown'): {
  status: number;
  body: string;
} {
  switch (status) {
    case 'unknown':
      return {
        status: 404,
        body: renderState(
          'Sign-in request not found',
          'This request has expired or was never issued. Start the sign-in again from the device.',
          'unknown',
        ),
      };
    case 'expired':
      return {
        status: 410,
        body: renderState(
          'Sign-in request expired',
          'The window has elapsed. Start the sign-in again from the device.',
          'expired',
        ),
      };
    case 'denied':
      return { status: 410, body: renderDenied() };
    case 'approved':
    case 'consumed':
      return { status: 200, body: renderApproved() };
  }
}

/** A record that is not pending answers its settled page; a pending one answers null. */
function settledPageFor(facts: AuthorizationFacts | null): { status: number; body: string } | null {
  if (facts === null) return settledStatePage('unknown');
  if (facts.status === 'pending') return null;
  return settledStatePage(facts.status);
}

export function createOAuthHttp(options: OAuthHttpOptions): OAuthHttp {
  const { authorization, resolvePeer, gateMode, passwordLogin, consent } = options;
  const emitAudit = options.emitAudit ?? emitAuditEntry;
  const validateToken = options.validateToken ?? validateDaemonAuthToken;
  const resolvePeerUser = options.resolvePeerUser ?? resolveDaemonPeerUser;
  const peekToken = options.peekToken ?? peekDaemonAuthToken;
  const revokeToken = options.revokeToken ?? revokeDaemonAuthToken;
  const reportGuess = options.reportGuess ?? ((): void => undefined);

  const externalOrigin = (req: IncomingMessage): string =>
    resolveExternalOrigin(req, { trustedProxy: options.trustedProxy });

  async function approveAuthorization(id: string, userId: string): Promise<ApproveAuthorizationResult> {
    const result = await authorization.approve(id, userId);
    if (!result.ok) return result;
    emitAudit({ actorUserId: userId, capability: 'daemon.device-login', decision: { allow: true } });
    logger.info(SCOPE, `device sign-in approved for user=${userId} (${result.grant} grant)`);
    return result;
  }

  /** The redirect target of an approved code grant — `redirect_uri?code&state&iss` (RFC 9207). */
  function redirectTarget(req: IncomingMessage, approved: Extract<ApproveAuthorizationResult, { grant: 'code' }>) {
    return appendRedirectParams(approved.redirectUri, {
      code: approved.code,
      state: approved.state,
      iss: externalOrigin(req),
    });
  }

  function handleMetadata(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const issuer = externalOrigin(req);
    jsonResponse(res, 200, {
      issuer,
      authorization_endpoint: `${issuer}${OAUTH_AUTHORIZE_PATH}`,
      token_endpoint: `${issuer}${OAUTH_TOKEN_PATH}`,
      device_authorization_endpoint: `${issuer}${OAUTH_DEVICE_PATH}`,
      revocation_endpoint: `${issuer}${OAUTH_REVOKE_PATH}`,
      response_types_supported: ['code'],
      grant_types_supported: [AUTHORIZATION_CODE_GRANT_TYPE, DEVICE_CODE_GRANT_TYPE],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  }

  function handleAuthorize(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const query = new URL(req.url ?? '', 'http://placeholder').searchParams;
    if (query.get('response_type') !== 'code') {
      const page = renderMalformed(400, AUTHORIZE_REFUSAL_LINES['invalid-response-type']);
      htmlResponse(res, page.status, page.body);
      return;
    }
    const label = parseDeviceLabel(query.get('device_label'));
    if (!label.ok) {
      const page = renderMalformed(400, 'The request carries an over-long device label.');
      htmlResponse(res, page.status, page.body);
      return;
    }
    const begun = authorization.beginCode({
      clientId: query.get('client_id') ?? '',
      redirectUri: query.get('redirect_uri') ?? '',
      state: query.get('state') ?? '',
      codeChallenge: query.get('code_challenge') ?? '',
      codeChallengeMethod: query.get('code_challenge_method') ?? '',
      peer: resolvePeer(req),
      ...(label.label !== undefined ? { deviceLabel: label.label } : {}),
    });
    if (!begun.ok) {
      const page = renderMalformed(
        begun.reason === 'too-many-pending' ? 503 : 400,
        AUTHORIZE_REFUSAL_LINES[begun.reason],
      );
      htmlResponse(res, page.status, page.body);
      return;
    }
    redirectResponse(res, 302, consent.location(req, begun.id));
  }

  function handleDeviceStart(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    const peer = resolvePeer(req);
    const origin = externalOrigin(req);
    void (async () => {
      const params = parseParams(req, await readRawBody(req).catch(() => ''));
      const clientId = params?.get('client_id');
      const label = parseDeviceLabel(params?.get('device_label'));
      if (params === null || !clientId || !label.ok) {
        oauthError(res, 400, 'invalid_request');
        return;
      }
      let begun: Awaited<ReturnType<DaemonAuthorizationService['beginDevice']>>;
      try {
        begun = await authorization.beginDevice({
          clientId,
          peer,
          ...(label.label !== undefined ? { deviceLabel: label.label } : {}),
        });
      } catch (err) {
        logger.warn(SCOPE, 'device sign-in start failed', err);
        oauthError(res, 500, 'server_error');
        return;
      }
      if (!begun.ok) {
        switch (begun.reason) {
          case 'unknown-client':
            oauthError(res, 400, 'invalid_client');
            return;
          case 'unsupported-grant':
            oauthError(res, 400, 'unauthorized_client');
            return;
          case 'too-many-pending':
            // The caps: a start is refused, not queued — the client says
            // so and the person retries once one pending sign-in settles.
            logger.warn(SCOPE, `device sign-in start refused: too many pending (peer=${peer})`);
            oauthError(res, 503, 'temporarily_unavailable');
            return;
        }
      }
      const verificationUri = `${origin}${OAUTH_DEVICE_VERIFY_PATH}`;
      jsonResponse(res, 200, {
        device_code: begun.deviceCode,
        user_code: begun.userCode,
        verification_uri: verificationUri,
        verification_uri_complete: `${verificationUri}?user_code=${encodeURIComponent(begun.userCode)}`,
        expires_in: Math.max(0, Math.floor((begun.expiresAt - Date.now()) / 1000)),
        interval: begun.intervalSeconds,
      });
    })();
  }

  function handleDeviceVerify(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const userCode = new URL(req.url ?? '', 'http://placeholder').searchParams.get('user_code');
    if (userCode === null) {
      htmlResponse(res, 200, renderCodeEntry(null));
      return;
    }
    const found = authorization.lookupByUserCode(userCode);
    if (!found.ok) {
      htmlResponse(res, 404, renderCodeEntry('That code was not found. Check it against your device and try again.'));
      return;
    }
    redirectResponse(res, 302, consent.location(req, found.id));
  }

  function handleRecord(id: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const facts = authorization.facts(id);
    if (wantsJson(req)) {
      if (facts === null) {
        jsonResponse(res, 404, { ok: false });
        return;
      }
      jsonResponse(res, 200, { ok: true, authorization: facts });
      return;
    }
    const settled = settledPageFor(facts);
    if (settled !== null || facts === null) {
      const page = settled ?? settledStatePage('unknown');
      htmlResponse(res, page.status, page.body);
      return;
    }
    const viewerPeer = resolvePeer(req);
    const errorParam = new URL(req.url ?? '', 'http://placeholder').searchParams.get('error');
    const notice = errorParam === null ? null : (SSO_ERROR_LINES[errorParam] ?? SSO_ERROR_FALLBACK);
    void (async () => {
      try {
        const gate = await gateMode(isLoopbackRemote(viewerPeer));
        htmlResponse(res, 200, pageShell('Approve this device?', renderGate(facts, gate, notice, viewerPeer)));
      } catch (err) {
        logger.warn(SCOPE, 'gate resolution failed', err);
        htmlResponse(
          res,
          500,
          renderState('Sign-in unavailable', 'The server could not resolve its sign-in state. Try again.', 'unknown'),
        );
      }
    })();
  }

  /** The bearer arm of a decision: the presented session names the approver. Null = refused (401 answered). */
  async function approverFromBearer(bearer: string, res: ServerResponse): Promise<string | null> {
    const validated = await validateToken(bearer);
    const resolved = validated.ok ? await resolvePeerUser(validated.userId) : null;
    if (resolved === null || !resolved.ok) {
      oauthError(res, 401, 'invalid_token');
      return null;
    }
    return resolved.userId;
  }

  function handleApprove(id: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    const bearer = readBearer(req);
    void (async () => {
      try {
        if (bearer !== null) {
          const userId = await approverFromBearer(bearer, res);
          if (userId === null) return;
          const approved = await approveAuthorization(id, userId);
          if (!approved.ok) {
            jsonResponse(res, approved.reason === 'unknown' ? 404 : 410, { ok: false, reason: approved.reason });
            return;
          }
          jsonResponse(
            res,
            200,
            approved.grant === 'code' ? { ok: true, redirectTo: redirectTarget(req, approved) } : { ok: true },
          );
          return;
        }
        // The fallback page's form — only where password login is
        // composed; under SSO the page never offers it.
        if (passwordLogin === null) {
          const page = settledStatePage('unknown');
          htmlResponse(res, page.status, page.body);
          return;
        }
        const settled = settledPageFor(authorization.facts(id));
        if (settled !== null) {
          htmlResponse(res, settled.status, settled.body);
          return;
        }
        const params = parseParams(req, await readRawBody(req).catch(() => ''));
        const email = params?.get('email');
        const password = params?.get('password');
        if (email === undefined || password === undefined) {
          htmlResponse(res, 401, renderRefusedCredential(id));
          return;
        }
        const verified = await passwordLogin.verify(email, password);
        if (!verified.ok) {
          htmlResponse(res, 401, renderRefusedCredential(id));
          return;
        }
        const approved = await approveAuthorization(id, verified.userId);
        if (!approved.ok) {
          const page = settledStatePage(approved.reason);
          htmlResponse(res, page.status, page.body);
          return;
        }
        if (approved.grant === 'code') {
          redirectResponse(res, 303, redirectTarget(req, approved));
          return;
        }
        redirectResponse(res, 303, fallbackConsentLocation(id));
      } catch (err) {
        logger.warn(SCOPE, 'approve failed', err);
        if (bearer !== null) oauthError(res, 500, 'server_error');
        else htmlResponse(res, 401, renderRefusedCredential(id));
      }
    })();
  }

  function handleDeny(id: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    const denied = authorization.deny(id);
    if (wantsJson(req) || readBearer(req) !== null) {
      if (denied.ok) jsonResponse(res, 200, { ok: true });
      else jsonResponse(res, denied.reason === 'unknown' ? 404 : 410, { ok: false, reason: denied.reason });
      return;
    }
    if (denied.ok) {
      htmlResponse(res, 200, renderDenied());
      return;
    }
    const page = settledStatePage(denied.reason);
    htmlResponse(res, page.status, page.body);
  }

  function handleToken(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    void (async () => {
      const params = parseParams(req, await readRawBody(req).catch(() => ''));
      if (params === null) {
        oauthError(res, 400, 'invalid_request');
        return;
      }
      const grantType = params.get('grant_type');
      const clientId = params.get('client_id') ?? '';
      const client = findDaemonAuthorizationClient(clientId);
      if (grantType !== AUTHORIZATION_CODE_GRANT_TYPE && grantType !== DEVICE_CODE_GRANT_TYPE) {
        oauthError(res, 400, 'unsupported_grant_type');
        return;
      }
      if (client === null) {
        oauthError(res, 400, 'invalid_client');
        return;
      }
      const grant = grantType === AUTHORIZATION_CODE_GRANT_TYPE ? 'code' : 'device';
      if (!client.grants.includes(grant)) {
        oauthError(res, 400, 'unauthorized_client');
        return;
      }
      try {
        if (grant === 'code') {
          const code = params.get('code');
          const codeVerifier = params.get('code_verifier');
          const redirectUri = params.get('redirect_uri');
          if (!code || !codeVerifier || !redirectUri) {
            oauthError(res, 400, 'invalid_request');
            return;
          }
          const redeemed = await authorization.redeemCode({ code, codeVerifier, redirectUri, clientId });
          if (!redeemed.ok) {
            if (redeemed.reason === 'unknown') reportGuess(req);
            oauthError(res, 400, 'invalid_grant');
            return;
          }
          logger.info(SCOPE, `device sign-in minted session token ${redeemed.tokenId} for user=${redeemed.userId}`);
          jsonResponse(res, 200, {
            access_token: redeemed.secret,
            token_type: 'Bearer',
            expires_in: Math.max(0, Math.floor((redeemed.expiresAt - Date.now()) / 1000)),
          });
          return;
        }
        const deviceCode = params.get('device_code');
        if (!deviceCode) {
          oauthError(res, 400, 'invalid_request');
          return;
        }
        const polled = await authorization.pollDevice({ deviceCode, clientId });
        switch (polled.status) {
          case 'pending':
            oauthError(res, 400, 'authorization_pending');
            return;
          case 'slow_down':
            oauthError(res, 400, 'slow_down');
            return;
          case 'denied':
            oauthError(res, 400, 'access_denied');
            return;
          case 'expired':
            oauthError(res, 400, 'expired_token');
            return;
          case 'unknown':
            reportGuess(req);
            oauthError(res, 400, 'invalid_grant');
            return;
          case 'approved':
            logger.info(SCOPE, `device sign-in minted session token ${polled.tokenId} for user=${polled.userId}`);
            jsonResponse(res, 200, {
              access_token: polled.secret,
              token_type: 'Bearer',
              expires_in: Math.max(0, Math.floor((polled.expiresAt - Date.now()) / 1000)),
            });
            return;
        }
      } catch (err) {
        // A mint failure is a server fault, not a grant fault: the
        // approval stands and the client's next attempt retries.
        logger.warn(SCOPE, 'token endpoint failed', err);
        oauthError(res, 500, 'server_error');
      }
    })();
  }

  function handleRevoke(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    void (async () => {
      const params = parseParams(req, await readRawBody(req).catch(() => ''));
      const token = params?.get('token');
      if (!token) {
        oauthError(res, 400, 'invalid_request');
        return;
      }
      // RFC 7009 §2.2: the outcome is 200 whether or not the token was
      // known — an invalid token is a no-op, never an oracle.
      try {
        const peeked = await peekToken(token);
        if (peeked.ok) {
          await revokeToken(peeked.tokenId);
          logger.info(SCOPE, `token ${peeked.tokenId} revoked by its holder`);
        }
      } catch (err) {
        logger.warn(SCOPE, 'revoke failed', err);
      }
      res.statusCode = 200;
      res.setHeader('Cache-Control', 'no-store');
      res.end();
    })();
  }

  const handler: OAuthHttpHandler = (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (pathOnly === OAUTH_METADATA_PATH) {
      handleMetadata(req, res);
      return true;
    }
    if (!pathOnly.startsWith(OAUTH_PATH_PREFIX)) return false;
    if (pathOnly === OAUTH_AUTHORIZE_PATH) handleAuthorize(req, res);
    else if (pathOnly === OAUTH_DEVICE_PATH) handleDeviceStart(req, res);
    else if (pathOnly === OAUTH_DEVICE_VERIFY_PATH) handleDeviceVerify(req, res);
    else if (pathOnly === OAUTH_TOKEN_PATH) handleToken(req, res);
    else if (pathOnly === OAUTH_REVOKE_PATH) handleRevoke(req, res);
    else {
      const decision = DECISION_ROUTE.exec(pathOnly);
      const record = decision === null ? RECORD_ROUTE.exec(pathOnly) : null;
      if (decision !== null) {
        const id = decodeURIComponent(decision[1]);
        if (decision[2] === 'approve') handleApprove(id, req, res);
        else handleDeny(id, req, res);
      } else if (record !== null && pathOnly.startsWith(CONSENT_PAGE_PREFIX)) {
        handleRecord(decodeURIComponent(record[1]), req, res);
      } else {
        // Claimed prefix, unknown subpath — never let the SPA fallback
        // serve HTML under an auth URL.
        jsonResponse(res, 404, { ok: false });
      }
    }
    return true;
  };

  return { handler, approveAuthorization };
}
