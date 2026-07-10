/**
 * HTTP request handler for the daemon device-flow pairing UX (U3.3,
 * `DATA_PLANE_TOPOLOGIES.md` §11.4 hybrid improvement).
 *
 * Rides on the same bound socket as the WebSocket upgrade handler — see
 * {@link startOracleWsServer}'s `pairingService` option. Two routes
 * matter:
 *
 *   - `GET  /pair/<code>` — server-rendered confirm page the peer sees
 *     when they open the URL the daemon admin read to them. Renders the
 *     pair's pre-populated `deviceLabel` (if any) + a Confirm button.
 *     A GET against an unknown / expired / consumed code renders the
 *     matching state page (without leaking whether the code was ever
 *     valid — same body for unknown vs expired modulo the headline).
 *   - `POST /pair/<code>/confirm` — peer clicked Confirm. The handler
 *     calls {@link DaemonPairingService.confirm}, which mints a real
 *     {@link DaemonAuthToken}, and renders the secret as the response
 *     body. The page is one-shot: subsequent GETs render the "already
 *     paired" state. A client that sends `Accept: application/json`
 *     (the extension's in-app code-entry flow, A2) gets the same
 *     one-shot confirm as a `{ ok, secret, tokenId }` / `{ ok, reason }`
 *     JSON body instead of the HTML page — same `confirm()` call, same
 *     A5 brute-force budget, just a machine representation.
 *
 * Anything else returns 404. We deliberately don't emit a hint about
 * what *would* be a valid path; the daemon's reachability check is
 * already covered by the WS server's default 400-on-non-upgrade
 * response for non-`/pair/...` requests (extension/desktop clients
 * never hit this surface).
 *
 * The HTML is intentionally inline rather than asset-loaded: this
 * surface is exactly two pages, the daemon binary should be deployable
 * without bundling static-asset paths, and shipping a static-asset
 * pipeline for two pages is the kind of premature abstraction
 * `feedback_no_overengineering` calls out.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DaemonPairingService, PendingPair } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { readRawBody } from './http-body';

const SCOPE = 'PairingHttp';

const PAIR_PREFIX = '/pair/';
const CONFIRM_SUFFIX = '/confirm';

interface ParsedRoute {
  readonly kind: 'view' | 'confirm';
  readonly code: string;
}

function parseRoute(url: string | undefined): ParsedRoute | null {
  if (!url) return null;
  // Drop query string — pairing URLs don't use one but a careless paste
  // ("…?utm=…") shouldn't 404 the user.
  const pathOnly = url.split('?', 1)[0];
  if (!pathOnly.startsWith(PAIR_PREFIX)) return null;
  const rest = pathOnly.slice(PAIR_PREFIX.length);
  if (rest.endsWith(CONFIRM_SUFFIX)) {
    const code = rest.slice(0, -CONFIRM_SUFFIX.length);
    if (!code || !/^\d+$/.test(code)) return null;
    return { kind: 'confirm', code };
  }
  // Allow a trailing slash for permissive parsing — `/pair/123456/` is
  // the same as `/pair/123456`.
  const code = rest.endsWith('/') ? rest.slice(0, -1) : rest;
  if (!code || !/^\d+$/.test(code)) return null;
  return { kind: 'view', code };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Pull the optional `deviceLabel` out of the request body, accepting
 * both the HTML form's `application/x-www-form-urlencoded` and the
 * programmatic client's `application/json` — the only field either
 * confirm path carries. A malformed/empty body yields `undefined`,
 * which is fine: the pending pair's own `deviceLabel` then stands.
 */
async function readDeviceLabel(req: IncomingMessage): Promise<string | undefined> {
  const raw = await readRawBody(req).catch(() => '');
  if (!raw) return undefined;
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'deviceLabel' in parsed) {
        const label = (parsed as { deviceLabel?: unknown }).deviceLabel;
        return typeof label === 'string' ? label.trim() || undefined : undefined;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
  return new URLSearchParams(raw).get('deviceLabel')?.trim() || undefined;
}

/**
 * Programmatic clients (the extension's in-app pairing, A2) opt into a
 * JSON representation by asking for it explicitly. Browser navigations
 * and form POSTs send `Accept: text/html,…` without `application/json`,
 * so they keep getting the rendered page — content negotiation, default
 * HTML.
 */
function wantsJson(req: IncomingMessage): boolean {
  return (req.headers.accept ?? '').includes('application/json');
}

const PAGE_CSS = `
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f7f7f8; color: #1d1d1f; }
  @media (prefers-color-scheme: dark) { body { background: #1d1d1f; color: #f5f5f7; } .card { background: #2c2c2e !important; border-color: #3a3a3c !important; } code, pre { background: #1d1d1f !important; border-color: #3a3a3c !important; color: #f5f5f7 !important; } }
  .wrap { max-width: 480px; margin: 48px auto; padding: 0 24px; }
  .card { background: #ffffff; border: 1px solid #e6e6e8; border-radius: 12px; padding: 28px 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  h1 { font-size: 18px; margin: 0 0 12px; font-weight: 600; }
  p { font-size: 14px; line-height: 1.5; margin: 0 0 12px; }
  .label { font-size: 12px; color: #6e6e73; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 16px; }
  .device { font-size: 16px; font-weight: 500; margin-top: 4px; }
  button { font: inherit; font-weight: 500; padding: 10px 18px; border-radius: 8px; border: 0; background: #0a84ff; color: #fff; cursor: pointer; margin-top: 16px; }
  button.secondary { background: transparent; color: inherit; border: 1px solid #c7c7cc; margin-left: 8px; }
  button:hover { filter: brightness(0.95); }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #f2f2f7; border: 1px solid #e6e6e8; border-radius: 6px; padding: 10px; white-space: pre-wrap; word-break: break-all; }
  .muted { color: #6e6e73; font-size: 12px; }
  .err { color: #c44; }
`;

function pageShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body><div class="wrap"><div class="card">${body}</div></div></body>
</html>`;
}

function renderConfirmView(pair: PendingPair): string {
  const label = pair.deviceLabel?.trim();
  return pageShell(
    'Confirm pairing',
    `<h1>Confirm pairing with this device</h1>
<p>Your Open Headers desktop daemon is requesting to pair this browser.</p>
<form method="POST" action="/pair/${escapeHtml(pair.code)}/confirm">
  <div class="label">Device label</div>
  <input
    name="deviceLabel"
    value="${escapeHtml(label ?? '')}"
    placeholder="e.g. alice's phone"
    maxlength="64"
    style="width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid #c7c7cc; font: inherit; box-sizing: border-box; margin-top: 4px;"
  />
  <p class="muted" style="margin-top: 8px;">This name shows up in the daemon's access-tokens list so you can revoke just this device later.</p>
  <button type="submit">Confirm pairing</button>
</form>
<p class="muted" style="margin-top: 16px;">Code <code>${escapeHtml(pair.code)}</code> · expires in about ${Math.max(0, Math.round((pair.expiresAt - Date.now()) / 60000))} min</p>`,
  );
}

function renderSuccess(secret: string): string {
  return pageShell(
    'Paired',
    `<h1>Paired successfully</h1>
<p>Copy this token and paste it into the peer's Settings → Backend → Daemon auth token. The daemon stores only a hash; if you lose this value, revoke the entry and pair again.</p>
<div class="label">Access token</div>
<pre id="secret">${escapeHtml(secret)}</pre>
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('secret').textContent).then(() => this.textContent = 'Copied').catch(() => this.textContent = 'Copy failed')">Copy</button>
<p class="muted" style="margin-top: 16px;">This page is one-shot. Reloading or sharing the URL won't show the token again.</p>`,
  );
}

function renderState(headline: string, message: string, status: 'expired' | 'consumed' | 'unknown'): string {
  // Identical body shell for unknown/expired/consumed so a casual probe
  // can't enumerate codes by response shape — only the visible headline
  // changes, and that mirrors what the user typed.
  return pageShell(
    headline,
    `<h1 class="${status === 'unknown' ? 'err' : ''}">${escapeHtml(headline)}</h1><p>${escapeHtml(message)}</p>`,
  );
}

function htmlResponse(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Pairing surface is per-request and time-sensitive; never cache.
  res.setHeader('Cache-Control', 'no-store');
  // The pairing page contains a one-shot secret on success — make sure
  // it isn't picked up by browser sniffers / framed inside a different
  // origin / referenced from a privileged context.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(body);
}

type ConfirmJson =
  | { readonly ok: true; readonly secret: string; readonly tokenId: string }
  | { readonly ok: false; readonly reason: 'unknown' | 'expired' | 'consumed' };

function jsonResponse(res: ServerResponse, statusCode: number, payload: ConfirmJson): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Same no-store / no-sniff hardening as the HTML surface — a success
  // body carries the one-shot secret.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

export interface PairingHttpHandlerOptions {
  readonly pairing: DaemonPairingService;
}

/**
 * Returns `true` when the handler owns the response (either has
 * written it synchronously or has committed to writing it
 * asynchronously). Returns `false` when the request is outside the
 * pairing surface so the caller can apply its fallback (e.g. 400 for
 * non-upgrade requests against the ws-server).
 */
export type PairingHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

/**
 * Build the HTTP request handler routes the daemon's pairing surface
 * exposes. The returned function is intended to be attached to a
 * shared `http.Server` instance — see {@link startOracleWsServer}'s
 * `pairingService` option.
 */
export function createPairingHttpHandler(options: PairingHttpHandlerOptions): PairingHttpHandler {
  const { pairing } = options;
  return (req, res) => {
    const route = parseRoute(req.url);
    if (!route) return false;
    if (req.method === 'GET' && route.kind === 'view') {
      const pair = pairing.peek(route.code);
      if (!pair) {
        htmlResponse(
          res,
          404,
          renderState(
            'Pairing not found',
            'This code has expired or was never issued. Ask the daemon admin to generate a new code.',
            'unknown',
          ),
        );
        return true;
      }
      if (pair.status === 'pending') {
        htmlResponse(res, 200, renderConfirmView(pair));
        return true;
      }
      if (pair.status === 'expired') {
        htmlResponse(
          res,
          410,
          renderState(
            'Pairing expired',
            'The 5-minute pairing window has elapsed. Ask the daemon admin to generate a new code.',
            'expired',
          ),
        );
        return true;
      }
      // confirmed | consumed
      htmlResponse(
        res,
        410,
        renderState(
          'Already paired',
          'This code has already been used. Ask the daemon admin to generate a new code if you need to pair again.',
          'consumed',
        ),
      );
      return true;
    }
    if (req.method === 'POST' && route.kind === 'confirm') {
      const asJson = wantsJson(req);
      void (async () => {
        try {
          const deviceLabel = await readDeviceLabel(req);
          const result = await pairing.confirm(route.code, { deviceLabel });
          if (result.ok) {
            if (asJson) {
              jsonResponse(res, 200, { ok: true, secret: result.secret, tokenId: result.tokenId });
              return;
            }
            htmlResponse(res, 200, renderSuccess(result.secret));
            return;
          }
          if (result.reason === 'expired') {
            if (asJson) {
              jsonResponse(res, 410, { ok: false, reason: 'expired' });
              return;
            }
            htmlResponse(
              res,
              410,
              renderState(
                'Pairing expired',
                'The 5-minute pairing window has elapsed. Ask the daemon admin to generate a new code.',
                'expired',
              ),
            );
            return;
          }
          if (result.reason === 'consumed') {
            if (asJson) {
              jsonResponse(res, 410, { ok: false, reason: 'consumed' });
              return;
            }
            htmlResponse(
              res,
              410,
              renderState(
                'Already paired',
                'This code has already been used. Ask the daemon admin to generate a new code if you need to pair again.',
                'consumed',
              ),
            );
            return;
          }
          if (asJson) {
            jsonResponse(res, 404, { ok: false, reason: 'unknown' });
            return;
          }
          htmlResponse(
            res,
            404,
            renderState('Pairing not found', 'This code has expired or was never issued.', 'unknown'),
          );
        } catch (err) {
          logger.warn(SCOPE, 'confirm failed', err);
          if (asJson) {
            // A mint failure is a server fault, not a code-state fault;
            // surface it as `unknown` (the JSON contract has no 5xx
            // variant) with a 500 so the client retries rather than
            // treating the code as spent.
            jsonResponse(res, 500, { ok: false, reason: 'unknown' });
            return;
          }
          htmlResponse(
            res,
            500,
            renderState(
              'Pairing failed',
              'The daemon could not mint a token. Try again or check the daemon logs.',
              'unknown',
            ),
          );
        }
      })();
      return true;
    }
    if (req.method === 'GET' && route.kind === 'confirm') {
      // POST-only target — methods other than POST get a 405.
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end();
      return true;
    }
    return false;
  };
}
