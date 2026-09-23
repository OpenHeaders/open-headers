/**
 * Server sign-in bridge RPCs (the client sign-in plan §14.9) — a
 * surface's `serverSignIn` capability is a thin shim over these, and
 * the host's long-lived process answers them: the desktop's MAIN
 * process (the renderer is a file origin the server's admission matrix
 * refuses everywhere, and MAIN owns the system-browser hop and the
 * loopback callback) and the extension's service worker (which owns
 * the identity API's window and outlives a popup that closes when the
 * window takes focus). The HTTP of both grants runs in that process
 * through the one core client; the surface only starts, polls,
 * cancels and reads the gate meta. Same shapes as the capability
 * contract.
 */

import type {
  ServerSignInPollInput,
  ServerSignInPollResult,
  ServerSignInSignOutInput,
  ServerSignInStartInput,
  ServerSignInStartResult,
} from '../../capabilities/registry';

export interface ServerSignInRpc {
  /** The metadata read, then the grant the host runs — `redirect` (the browser is already open) or `device`. */
  'oh.serverSignIn.start': { req: ServerSignInStartInput; res: ServerSignInStartResult };
  /** One poll of the in-flight handle; `approved` carries the session secret once. */
  'oh.serverSignIn.poll': { req: ServerSignInPollInput; res: ServerSignInPollResult };
  /** Forget an in-flight handle — the step's Cancel. */
  'oh.serverSignIn.cancel': { req: ServerSignInPollInput; res: { ok: true } };
  /** RFC 7009 revocation of the presented credential. */
  'oh.serverSignIn.signOut': { req: ServerSignInSignOutInput; res: { ok: boolean } };
  /** A JSON-only GET of `path` on the back-end's HTTP origin — the gate resolver's seam. */
  'oh.serverSignIn.meta': { req: { url: string; path: string }; res: { payload: unknown | null } };
}
