/**
 * Server sign-in bridge RPCs (the client sign-in plan §7, F0-b) — the
 * desktop renderer's `serverSignIn` capability is a thin shim over
 * these: the renderer is a file origin the server's admission matrix
 * refuses everywhere, so every HTTP call of the device flow runs in the
 * MAIN process over Node's fetch (no Origin), which also fronts the app
 * when the poll lands. Same shapes as the capability contract; the
 * extension never uses these (it fetches page-side).
 */

import type {
  ServerSignInPollInput,
  ServerSignInPollResult,
  ServerSignInStartInput,
  ServerSignInStartResult,
} from '../../capabilities/registry';

export interface ServerSignInRpc {
  /** `POST /pair` as the desktop client — the code, the poll handle, the approve URL. */
  'oh.serverSignIn.start': { req: ServerSignInStartInput; res: ServerSignInStartResult };
  /** `GET /pair/poll` on the handle; an `approved` answer also fronts the app. */
  'oh.serverSignIn.poll': { req: ServerSignInPollInput; res: ServerSignInPollResult };
  /** A JSON-only GET of `path` on the back-end's HTTP origin — the gate resolver's seam. */
  'oh.serverSignIn.meta': { req: { url: string; path: string }; res: { payload: unknown | null } };
}
