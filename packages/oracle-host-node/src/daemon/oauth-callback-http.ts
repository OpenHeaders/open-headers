/**
 * OAuth 2.0 loopback callback — `GET /oauth/callback` on the bound
 * port, the redirect target the authorization-code flow registers
 * with a provider on the node hosts (`http://127.0.0.1:<port>/oauth/callback`).
 *
 * One authorization at a time per `state`: the flow parks a waiter
 * under the state it minted, the system browser lands here after the
 * provider's login, the waiter resolves with the full redirect URL
 * (the flow parses code / error / state itself — this route never
 * interprets them), and the browser tab gets a short landing page.
 * A hit with no matching waiter answers 404 — a stale tab, or a probe.
 *
 * Loopback-only by construction: the redirect URI names 127.0.0.1, so
 * an off-device peer hitting the path is a scan, refused 403 like the
 * NM bootstrap route. Admission classifies the path as `oauth-callback`
 * (browser navigation carries no Origin; the Host is the loopback
 * literal) — see `admission-matrix.ts`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import { isLoopbackRemote } from '../host-runtime/ws-server/classify';

const SCOPE = 'OAuthCallback';

export const OAUTH_CALLBACK_PATH = '/oauth/callback';

/** How long the flow waits for the browser to come back before the
 *  authorize step fails — a provider login with MFA fits comfortably. */
export const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

export type OAuthCallbackHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface OAuthCallbackAwaitOptions {
  timeoutMs?: number;
}

export interface OAuthCallbackHandler {
  readonly handler: OAuthCallbackHttpHandler;
  /** Park a waiter for `state`; resolves with the redirect URL the
   *  browser landed on, rejects on timeout. A second wait for the same
   *  state supersedes the first (it rejects). */
  awaitRedirect(state: string, options?: OAuthCallbackAwaitOptions): Promise<string>;
  /** Waiters currently parked — observability + tests. */
  pendingCount(): number;
}

interface Waiter {
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

function landingPage(title: string, detail: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${title}</title>`,
    '<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#111;color:#eee}main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;opacity:.8}</style>',
    `</head><body><main><h1>${title}</h1><p>${detail}</p></main></body></html>`,
  ].join('');
}

const PAGE_DONE = landingPage('Authorization complete', 'You can close this tab and return to Open Headers.');
const PAGE_STALE = landingPage('No authorization in progress', 'Start the sign-in again from Open Headers.');

function respondHtml(res: ServerResponse, statusCode: number, html: string, head: boolean): void {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(head ? undefined : body);
}

export function createOAuthCallbackHandler(): OAuthCallbackHandler {
  const waiters = new Map<string, Waiter>();

  const settle = (state: string): Waiter | undefined => {
    const waiter = waiters.get(state);
    if (waiter === undefined) return undefined;
    waiters.delete(state);
    clearTimeout(waiter.timer);
    return waiter;
  };

  const handler: OAuthCallbackHttpHandler = (req, res) => {
    const rawUrl = req.url ?? '';
    const path = rawUrl.split('?', 1)[0];
    if (path !== OAUTH_CALLBACK_PATH) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      res.end();
      return true;
    }
    if (!isLoopbackRemote(req.socket.remoteAddress)) {
      logger.warn(SCOPE, `refused off-device callback hit (peer=${req.socket.remoteAddress ?? 'unknown'})`);
      res.statusCode = 403;
      res.end();
      return true;
    }
    const host = req.headers.host ?? '127.0.0.1';
    const url = new URL(rawUrl, `http://${host}`);
    const state = url.searchParams.get('state');
    const waiter = state !== null ? settle(state) : undefined;
    if (waiter === undefined) {
      respondHtml(res, 404, PAGE_STALE, req.method === 'HEAD');
      return true;
    }
    respondHtml(res, 200, PAGE_DONE, req.method === 'HEAD');
    waiter.resolve(url.toString());
    return true;
  };

  return {
    handler,
    awaitRedirect(state, options) {
      const timeoutMs = options?.timeoutMs ?? OAUTH_CALLBACK_TIMEOUT_MS;
      settle(state)?.reject(new Error('superseded by a newer authorization for the same state'));
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(state);
          reject(new Error(`no redirect arrived within ${Math.round(timeoutMs / 1000)}s`));
        }, timeoutMs);
        timer.unref?.();
        waiters.set(state, { resolve, reject, timer });
      });
    },
    pendingCount: () => waiters.size,
  };
}
