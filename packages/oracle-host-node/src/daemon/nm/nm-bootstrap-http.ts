/**
 * `POST /nm/bootstrap` — the NM identity handoff's daemon side
 * (the observability plan §4 + §8 Phase 7).
 *
 * The browser spawns the shipped NM host (stdio); the host dials this
 * loopback route; the daemon verifies WHO is dialing from OS truth
 * (socket owner → NM host binary → spawning browser's code signature,
 * see `process-identity.ts`) and only then mints a short-lived
 * `nmSession` token in the existing auth-token plane — same
 * revocation, same admin list, same HELLO validation as every other
 * mint. The host relays the secret to the extension in one NM message
 * and exits; the WS lifeline is unchanged after bootstrap.
 *
 * Refusals are coarse on the wire (`refused` / `unsupported`) with the
 * specific broken link kept to the daemon log, so a probing local
 * process cannot map the verification chain. Rides the composed bind
 * via handler composition like the pairing surface; admission gives
 * the route the native-process posture (any Origin ⇒ reject) and the
 * handler additionally refuses non-loopback peers outright — the NM
 * host only ever dials this machine.
 *
 * Re-mint hygiene: a bootstrap carrying the extension install's stable
 * id revokes that install's prior `nmSession` mints (and evicts their
 * live sockets) so per-profile tokens rotate instead of accumulating.
 * The id scopes the rotation and stamps a short suffix into the token
 * label so sibling profiles of one browser render as distinct ledger
 * rows; it proves nothing — identity is the OS chain above.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { listDaemonAuthTokens, mintDaemonAuthToken, revokeDaemonAuthToken } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { readRawBody } from '../../host-runtime/http-body';
import { type NmCallerVerification, type VerifyNmCallerOptions, verifyNmCaller } from './process-identity';

const SCOPE = 'NmBootstrapHttp';

export const NM_BOOTSTRAP_PATH = '/nm/bootstrap';

/**
 * nmSession lifetime. Long enough that a browser profile in daily use
 * never loses auth mid-stride (the SW re-bootstraps whenever the token
 * is missing or refused), short enough that a copied secret dies on
 * its own even if revocation never fires.
 */
export const NM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_INSTALL_ID_LENGTH = 128;

export interface NmBootstrapHttpOptions {
  /** Absolute path of the shipped NM host binary (the identity anchor). */
  readonly hostBinaryPath: string;
  /** Require a valid signature on the host binary (packaged builds). */
  readonly requireHostSignature: boolean;
  /** Evict a revoked predecessor token's live sockets. */
  readonly closePeersByTokenId: (tokenId: string) => void;
  /** Verification seam — defaults to the real OS chain. */
  readonly verify?: (options: VerifyNmCallerOptions) => Promise<NmCallerVerification>;
  /** Test seam — defaults to `Date.now()`. */
  readonly now?: () => number;
}

export type NmBootstrapHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

type NmBootstrapJson =
  | { readonly ok: true; readonly secret: string; readonly tokenId: string; readonly browser: string }
  | { readonly ok: false; readonly reason: 'refused' | 'unsupported' };

function jsonResponse(res: ServerResponse, statusCode: number, payload: NmBootstrapJson): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // A success body carries the one-shot secret — same no-store posture
  // as the pairing confirm.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

function isLoopbackAddress(address: string): boolean {
  const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  return plain === '::1' || plain.startsWith('127.');
}

/** Pull the optional `installId` out of the JSON body; malformed → undefined. */
function parseInstallId(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'installId' in parsed) {
      const installId = (parsed as { installId?: unknown }).installId;
      if (typeof installId === 'string') {
        const trimmed = installId.trim();
        return trimmed.length > 0 && trimmed.length <= MAX_INSTALL_ID_LENGTH ? trimmed : undefined;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Short display suffix from the install id — sibling profiles of one
 * browser each carry their own extension install, so the id is the only
 * per-profile fact available (the spawning browser process is shared
 * across profiles). Display-only, exactly like the id's rotation role.
 */
function installIdSuffix(installId: string): string | null {
  const core = installId.startsWith('ext-') ? installId.slice('ext-'.length) : installId;
  const compact = core.replace(/[^0-9A-Za-z]/g, '');
  return compact.length > 0 ? compact.slice(0, 4) : null;
}

/** Revoke the install's prior nmSession mints + evict their live sockets. */
async function revokePredecessors(installId: string, closePeersByTokenId: (tokenId: string) => void): Promise<void> {
  const tokens = await listDaemonAuthTokens();
  for (const token of tokens) {
    if (token.kind !== 'nmSession' || token.revokedAt !== null || token.nmInstallId !== installId) continue;
    await revokeDaemonAuthToken(token.id);
    closePeersByTokenId(token.id);
  }
}

export function createNmBootstrapHttpHandler(options: NmBootstrapHttpOptions): NmBootstrapHttpHandler {
  const verify = options.verify ?? verifyNmCaller;
  const now = options.now ?? Date.now;
  return (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (pathOnly !== NM_BOOTSTRAP_PATH) return false;
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end();
      return true;
    }
    const clientAddress = req.socket.remoteAddress;
    const clientPort = req.socket.remotePort;
    void (async () => {
      try {
        if (clientAddress === undefined || clientPort === undefined || !isLoopbackAddress(clientAddress)) {
          logger.warn(SCOPE, `bootstrap refused: non-loopback peer ${clientAddress ?? 'unknown'}`);
          jsonResponse(res, 403, { ok: false, reason: 'refused' });
          return;
        }
        // Body read first — verification must see the socket while the
        // request is still in flight either way, and the id is needed
        // before the mint.
        const rawBody = await readRawBody(req).catch(() => '');
        const installId = parseInstallId(rawBody);
        const verdict = await verify({
          clientAddress,
          clientPort,
          expectedHostPath: options.hostBinaryPath,
          requireHostSignature: options.requireHostSignature,
        });
        if (!verdict.ok) {
          logger.warn(SCOPE, `bootstrap refused (${verdict.reason}): ${verdict.detail}`);
          jsonResponse(res, verdict.reason === 'platform-unsupported' ? 501 : 403, {
            ok: false,
            reason: verdict.reason === 'platform-unsupported' ? 'unsupported' : 'refused',
          });
          return;
        }
        if (installId !== undefined) {
          await revokePredecessors(installId, options.closePeersByTokenId);
        }
        const suffix = installId !== undefined ? installIdSuffix(installId) : null;
        const mint = await mintDaemonAuthToken({
          label: suffix === null ? `NM: ${verdict.browser.name}` : `NM: ${verdict.browser.name} · ${suffix}`,
          kind: 'nmSession',
          expiresAt: now() + NM_SESSION_TTL_MS,
          ...(installId !== undefined ? { nmInstallId: installId } : {}),
        });
        logger.info(SCOPE, `nmSession minted for ${verdict.browser.name} (${verdict.browserPath})`);
        jsonResponse(res, 200, {
          ok: true,
          secret: mint.secret,
          tokenId: mint.record.id,
          browser: verdict.browser.name,
        });
      } catch (err) {
        logger.warn(SCOPE, 'bootstrap failed', err);
        jsonResponse(res, 500, { ok: false, reason: 'refused' });
      }
    })();
    return true;
  };
}
