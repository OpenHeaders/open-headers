/**
 * The backend probe bridge RPC — a surface's `backendProbe` capability
 * is a thin shim over it, and the host's long-lived process answers:
 * the desktop's MAIN process, whose Node `WebSocket` is the one socket
 * the app may open toward a server (the renderer's CSP forbids a dial
 * and its file Origin is refused anyway — the sign-in grant's posture).
 * The extension's pages and the served tab probe over their own socket
 * and register nothing.
 */

import type { ProbeConnectionResult, ProbeOptions } from '../../identity/probe-connection';

export interface BackendProbeRpc {
  /** One HELLO → WELCOME probe of `url` with the plain options, answered as the probe's own result union. */
  'oh.backendProbe': { req: { url: string; opts: ProbeOptions }; res: ProbeConnectionResult };
}
