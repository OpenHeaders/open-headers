/**
 * HTTP surface of the CLIENT-initiated pairing — the device flow's
 * server side (the client sign-in plan §6, D2). A native client (the
 * extension, the desktop app, the CLI) starts a pair here, shows the
 * person the short code, and polls on the long handle it holds; the
 * person approves the code on THIS server's own page by signing in
 * with whatever the server's identity plane accepts. The sibling
 * `pairing-http.ts` owns the admin initiative and lends this module its
 * page shell; the `/pair/` prefix stays one owner's, with this module's
 * page reached through that owner's `clientPairView` seam so a
 * navigation costs one `peek`.
 *
 *   - `POST /pair`                  — the client's start: `{client,
 *     deviceLabel?}` in, `{code, pollToken, expiresAt, approveUrl}` out.
 *     The peer named on the page is the ADMISSION-resolved one (the
 *     setup route's precedent — behind a trusted proxy every remote
 *     start would otherwise read as loopback).
 *   - `GET  /pair/<code>`           — the device-authorization page for a
 *     client pair (§6.3): "Approve this device?" naming the device and
 *     the client kind, then the server's gate state from ONE server-side
 *     resolver: the claim pointer, the password form, the provider link,
 *     or the no-login sentence. The phishing mitigation is a COMPARISON,
 *     not a printed address: only when the client that asked sits at a
 *     different peer than the browser now approving does the page say
 *     so — a person approving their own device reads nothing about
 *     addresses at all.
 *   - `POST /pair/<code>/approve`   — the password form: verifies through
 *     the password service (same lockout, same decoy burn) WITHOUT
 *     minting a browser session, binds the pair, and redirects to the
 *     approved page. Every refused credential answers ONE uniform 401
 *     page — the admission limiter's counted failure on the `pairing`
 *     route.
 *   - `POST /pair/<code>/deny`      — "Not me".
 *   - `GET  /pair/<code>/approved`  — "Device approved — you can close
 *     this tab." The OIDC device arm lands here too.
 *   - `GET  /pair/poll`             — bearer = the poll handle; JSON.
 *     `approved` carries the secret ONCE; an unknown handle is a 404
 *     the admission matrix counts.
 *
 * The secret is never on any page: it rides the poll handle only, and
 * the approving browser is never signed in by approving (§12).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type ApprovePairFailureReason,
  type ApprovePairResult,
  DAEMON_PAIRING_CLIENT_KINDS,
  type DaemonPairingClientKind,
  type DaemonPairingService,
  emitAuditEntry,
  type PendingPair,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { DaemonGateMode, GateModeResolver } from '../daemon/gate-mode';
import type { DaemonPasswordLoginService } from '../daemon/password/password-login-service';
import { resolveExternalOrigin } from './external-origin';
import { readRawBody } from './http-body';
import { escapeHtml, htmlResponse, pageShell, renderState } from './pairing-http';
import { isLoopbackRemote } from './ws-server/classify';

const SCOPE = 'DeviceAuthorizationHttp';

const START_PATH = '/pair';
const POLL_PATH = '/pair/poll';
const CODE_ROUTE = /^\/pair\/(\d+)\/(approve|deny|approved)$/;
const MAX_DEVICE_LABEL_LENGTH = 64;

/** How the page names each client kind — lowercase; capitalized when it leads the sentence. */
const CLIENT_KIND_LABELS: Record<DaemonPairingClientKind, string> = {
  extension: 'the browser extension',
  desktop: 'the desktop app',
  cli: 'the command-line tool',
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The OIDC device arm's refusals, rendered as fixed sentences — never a URL's own words. */
const SSO_ERROR_LINES: Readonly<Record<string, string>> = {
  'unknown-user': 'That account is not a user on this server. Ask its administrator to add you.',
  'user-deactivated': 'That account has been deactivated on this server.',
  'seat-limit-reached': 'This server has no free seats for a new user. Ask its administrator.',
  'state-mismatch': 'The sign-in did not complete in this browser. Try again.',
};
const SSO_ERROR_FALLBACK = 'The sign-in did not complete. Try again.';

export interface DeviceAuthorizationHttpOptions {
  readonly pairing: DaemonPairingService;
  /** Admission's peer resolution — the socket address, or the trusted proxy's `X-Forwarded-For` entry. */
  readonly resolvePeer: (req: IncomingMessage) => string;
  /** The one server-side gate truth (`gate-mode.ts`). */
  readonly gateMode: GateModeResolver;
  /** The password verifier when password login is composed; null under SSO (the page offers the provider). */
  readonly passwordLogin: DaemonPasswordLoginService | null;
  /** Same trust posture as the admission control's peer resolution. */
  readonly trustedProxy?: boolean;
  /** Test seam — defaults to the live audit sink. */
  readonly emitAudit?: typeof emitAuditEntry;
}

/** Composition contract shared with healthz/pairing/mcp/oidc/password: `true` = response owned. */
export type DeviceAuthorizationHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface DeviceAuthorizationHttp {
  readonly handler: DeviceAuthorizationHttpHandler;
  /** The pairing surface's client-initiative page owner — wire as `clientPairView`. */
  readonly renderPairView: (pair: PendingPair, req: IncomingMessage, res: ServerResponse) => void;
  /**
   * The audited approval — the ONE verb both arms bind a pair with: the
   * password form here, the OIDC completion through its `approveDevice`
   * seam. One `daemon.device-login` allow row per approval, the person
   * as the actor.
   */
  readonly approveDeviceLogin: (code: string, userId: string) => ApprovePairResult;
}

function jsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // The poll's success body carries the one-shot secret.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.statusCode = 405;
  res.setHeader('Allow', allow);
  res.end();
}

function redirectResponse(res: ServerResponse, location: string): void {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end();
}

function isClientKind(value: unknown): value is DaemonPairingClientKind {
  return typeof value === 'string' && (DAEMON_PAIRING_CLIENT_KINDS as readonly string[]).includes(value);
}

interface StartInput {
  readonly client: DaemonPairingClientKind;
  readonly deviceLabel?: string;
}

function parseStart(raw: string): StartInput | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed === null || typeof parsed !== 'object') return null;
    const { client, deviceLabel } = parsed as { client?: unknown; deviceLabel?: unknown };
    if (!isClientKind(client)) return null;
    if (deviceLabel === undefined) return { client };
    if (typeof deviceLabel !== 'string' || deviceLabel.trim().length > MAX_DEVICE_LABEL_LENGTH) return null;
    const trimmed = deviceLabel.trim();
    return trimmed ? { client, deviceLabel: trimmed } : { client };
  } catch {
    return null;
  }
}

/**
 * The approve form's fields, from the HTML form's urlencoded body or a
 * JSON body — the same two fields `/auth/password/login` takes.
 */
function parseCredentials(req: IncomingMessage, raw: string): { email: string; password: string } | null {
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed === null || typeof parsed !== 'object') return null;
      const { email, password } = parsed as { email?: unknown; password?: unknown };
      if (typeof email !== 'string' || typeof password !== 'string') return null;
      return { email, password };
    } catch {
      return null;
    }
  }
  const form = new URLSearchParams(raw);
  const email = form.get('email');
  const password = form.get('password');
  if (email === null || password === null) return null;
  return { email, password };
}

function readBearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * The heading names WHAT asks; the address line appears only when the
 * client that asked and the browser now approving sit at different
 * peers — that is the one case an address tells the person anything.
 */
function deviceHeading(pair: PendingPair, viewerPeer: string): string {
  const label = pair.deviceLabel?.trim();
  const kind = CLIENT_KIND_LABELS[pair.client ?? 'cli'];
  const who = label
    ? `<span class="device">${escapeHtml(label)}</span> (${escapeHtml(kind)})`
    : escapeHtml(capitalize(kind));
  const elsewhere =
    pair.peer && pair.peer !== viewerPeer
      ? `
<p class="warn">This request came from a different device at <code>${escapeHtml(pair.peer)}</code>. If that isn't you, click Not me.</p>`
      : '';
  return `<h1>Approve this device?</h1>
<p>${who} asked to sign in to this server as you.</p>${elsewhere}
<p class="muted">Code <code>${escapeHtml(pair.code)}</code> · expires in about ${Math.max(0, Math.round((pair.expiresAt - Date.now()) / 60000))} min</p>`;
}

function notMeForm(code: string): string {
  return `<form method="POST" action="/pair/${escapeHtml(code)}/deny"><button type="submit" class="secondary">Not me</button></form>`;
}

function renderGate(pair: PendingPair, gate: DaemonGateMode, notice: string | null, viewerPeer: string): string {
  const code = escapeHtml(pair.code);
  const noticeHtml = notice ? `<p class="err">${escapeHtml(notice)}</p>` : '';
  const heading = deviceHeading(pair, viewerPeer);
  switch (gate.kind) {
    case 'setup':
      return `${heading}
<p>This server has no administrator yet. <a href="/">Set it up first</a>, then start the sign-in again from the device.</p>`;
    case 'sso':
      return `${heading}
${noticeHtml}
<p>Sign in with ${escapeHtml(gate.provider)} to approve it.</p>
<div class="row">
  <a class="button" href="/auth/oidc/start?device=${code}">Sign in with ${escapeHtml(gate.provider)}</a>
  ${notMeForm(pair.code)}
</div>`;
    case 'password':
      return `${heading}
${noticeHtml}
<p>Sign in with the email and password the server admin set for you to approve it.</p>
<form method="POST" action="/pair/${code}/approve" id="approve">
  <label class="field">Email<input name="email" type="email" autocomplete="username" required /></label>
  <label class="field">Password<input name="password" type="password" autocomplete="current-password" required /></label>
</form>
<div class="row">
  <button type="submit" form="approve">Approve</button>
  ${notMeForm(pair.code)}
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

function renderRefusedCredential(code: string): string {
  // ONE body for every refusal — unknown email, no password, wrong
  // password, a locked account — so the page enumerates nothing.
  return pageShell(
    'Sign-in refused',
    `<h1 class="err">Sign-in refused</h1>
<p>That email and password were not accepted.</p>
<a class="button" href="/pair/${escapeHtml(code)}">Try again</a>`,
  );
}

/** The state page for a client pair that is not pending, with its HTTP status. */
function settledStatePage(reason: Exclude<ApprovePairFailureReason, 'not-client'>): {
  status: number;
  body: string;
} {
  switch (reason) {
    case 'unknown':
      return {
        status: 404,
        body: renderState(
          'Sign-in request not found',
          'This code has expired or was never issued. Start the sign-in again from the device.',
          'unknown',
        ),
      };
    case 'expired':
      return {
        status: 410,
        body: renderState(
          'Sign-in request expired',
          'The 5-minute window has elapsed. Start the sign-in again from the device.',
          'expired',
        ),
      };
    case 'denied':
      return { status: 410, body: renderDenied() };
    case 'consumed':
      return { status: 200, body: renderApproved() };
  }
}

export function createDeviceAuthorizationHttp(options: DeviceAuthorizationHttpOptions): DeviceAuthorizationHttp {
  const { pairing, resolvePeer, gateMode, passwordLogin } = options;
  const emitAudit = options.emitAudit ?? emitAuditEntry;

  function approveDeviceLogin(code: string, userId: string): ApprovePairResult {
    const result = pairing.approve(code, userId);
    if (!result.ok) return result;
    emitAudit({ actorUserId: userId, capability: 'daemon.device-login', decision: { allow: true } });
    logger.info(SCOPE, `device sign-in approved for user=${userId}`);
    return result;
  }

  /** A pair that is not pending answers its settled page; a pending one answers null. */
  function settledPage(pair: PendingPair): { status: number; body: string } | null {
    switch (pair.status) {
      case 'pending':
        return null;
      case 'expired':
        return settledStatePage('expired');
      case 'denied':
        return settledStatePage('denied');
      default:
        // approved | confirmed | consumed — the person already decided.
        return settledStatePage('consumed');
    }
  }

  function renderPairView(pair: PendingPair, req: IncomingMessage, res: ServerResponse): void {
    const settled = settledPage(pair);
    if (settled) {
      htmlResponse(res, settled.status, settled.body);
      return;
    }
    const viewerPeer = resolvePeer(req);
    const peerIsLoopback = isLoopbackRemote(viewerPeer);
    const errorParam = new URL(req.url ?? '', 'http://placeholder').searchParams.get('error');
    const notice = errorParam === null ? null : (SSO_ERROR_LINES[errorParam] ?? SSO_ERROR_FALLBACK);
    void (async () => {
      try {
        const gate = await gateMode(peerIsLoopback);
        htmlResponse(res, 200, pageShell('Approve this device?', renderGate(pair, gate, notice, viewerPeer)));
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

  function handleStart(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    const peer = resolvePeer(req);
    const origin = resolveExternalOrigin(req, { trustedProxy: options.trustedProxy });
    void (async () => {
      const raw = await readRawBody(req).catch(() => '');
      const input = parseStart(raw);
      if (input === null) {
        jsonResponse(res, 400, { ok: false, reason: 'malformed-request' });
        return;
      }
      try {
        const started = await pairing.startClientPair({ ...input, peer });
        jsonResponse(res, 200, {
          ok: true,
          code: started.code,
          pollToken: started.pollToken,
          expiresAt: started.expiresAt,
          approveUrl: `${origin}/pair/${started.code}`,
        });
      } catch (err) {
        // The caps: a start is refused, not queued — the client says so
        // and the person retries once one pending sign-in settles.
        logger.warn(SCOPE, `device sign-in start refused (peer=${peer})`, err);
        jsonResponse(res, 503, { ok: false, reason: 'too-many-pending' });
      }
    })();
  }

  function handlePoll(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const handle = readBearer(req);
    if (handle === null) {
      jsonResponse(res, 400, { ok: false, reason: 'malformed-request' });
      return;
    }
    void (async () => {
      try {
        const polled = await pairing.poll(handle);
        switch (polled.status) {
          case 'pending':
            jsonResponse(res, 200, { status: 'pending', expiresAt: polled.expiresAt });
            return;
          case 'approved':
            logger.info(SCOPE, `device sign-in minted session token ${polled.tokenId} for user=${polled.userId}`);
            jsonResponse(res, 200, { status: 'approved', secret: polled.secret, tokenId: polled.tokenId });
            return;
          case 'denied':
          case 'expired':
            jsonResponse(res, 200, { status: polled.status });
            return;
          case 'unknown':
            jsonResponse(res, 404, { status: 'unknown' });
            return;
        }
      } catch (err) {
        // A mint failure is a server fault, not a handle-state fault:
        // the approval stands and the client's next poll retries.
        logger.warn(SCOPE, 'poll failed', err);
        jsonResponse(res, 500, { status: 'pending' });
      }
    })();
  }

  function handleApprove(code: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    if (passwordLogin === null) {
      // Under SSO the page never offers this form; a POST here is a
      // route that does not exist on this deployment.
      htmlResponse(res, 404, settledStatePage('unknown').body);
      return;
    }
    void (async () => {
      const pair = pairing.peek(code);
      if (pair?.initiative !== 'client') {
        const page = settledStatePage('unknown');
        htmlResponse(res, page.status, page.body);
        return;
      }
      const settled = settledPage(pair);
      if (settled) {
        htmlResponse(res, settled.status, settled.body);
        return;
      }
      const raw = await readRawBody(req).catch(() => '');
      const credentials = parseCredentials(req, raw);
      if (credentials === null) {
        htmlResponse(res, 401, renderRefusedCredential(code));
        return;
      }
      try {
        const verified = await passwordLogin.verify(credentials.email, credentials.password);
        if (!verified.ok) {
          htmlResponse(res, 401, renderRefusedCredential(code));
          return;
        }
        const approved = approveDeviceLogin(code, verified.userId);
        if (!approved.ok) {
          const page = settledStatePage(approved.reason === 'not-client' ? 'unknown' : approved.reason);
          htmlResponse(res, page.status, page.body);
          return;
        }
        redirectResponse(res, `/pair/${code}/approved`);
      } catch (err) {
        logger.warn(SCOPE, 'approve failed', err);
        htmlResponse(res, 401, renderRefusedCredential(code));
      }
    })();
  }

  function handleDeny(code: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      methodNotAllowed(res, 'POST');
      return;
    }
    const denied = pairing.deny(code);
    if (denied.ok) {
      htmlResponse(res, 200, renderDenied());
      return;
    }
    const page = settledStatePage(denied.reason === 'not-client' ? 'unknown' : denied.reason);
    htmlResponse(res, page.status, page.body);
  }

  function handleApproved(code: string, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET') {
      methodNotAllowed(res, 'GET');
      return;
    }
    const pair = pairing.peek(code);
    if (pair?.initiative !== 'client') {
      const page = settledStatePage('unknown');
      htmlResponse(res, page.status, page.body);
      return;
    }
    if (pair.status === 'pending') {
      // Nothing was approved — back to the page that asks.
      redirectResponse(res, `/pair/${code}`);
      return;
    }
    const page = settledPage(pair) ?? settledStatePage('consumed');
    htmlResponse(res, page.status, page.body);
  }

  const handler: DeviceAuthorizationHttpHandler = (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (pathOnly === START_PATH) {
      handleStart(req, res);
      return true;
    }
    if (pathOnly === POLL_PATH) {
      handlePoll(req, res);
      return true;
    }
    const match = CODE_ROUTE.exec(pathOnly);
    if (!match) return false;
    const [, code, verb] = match;
    if (verb === 'approve') handleApprove(code, req, res);
    else if (verb === 'deny') handleDeny(code, req, res);
    else handleApproved(code, req, res);
    return true;
  };

  return { handler, renderPairView, approveDeviceLogin };
}
