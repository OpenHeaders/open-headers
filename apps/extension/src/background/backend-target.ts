/**
 * Backend-target classification — derived purely from settings, with no
 * connection-module side effects (kept separate from `websocket.ts` so
 * the inbound mutation receiver can consult it without dragging the WS
 * layer's import-time wiring into its unit surface).
 */

import { get as getSetting } from '@openheaders/ui/workbench/settings/store';

/**
 * Is the configured backend reachable over the loopback interface — i.e.
 * the desktop app on this same machine? Drives the active-workspace
 * mirroring gate: a loopback desktop's active-workspace changes mirror
 * down to this browser's extension, but a LAN/WAN peer's never do (the
 * active pointer is a per-device operative-view preference, not synced
 * identity state). Derived from `backend.url` — the URL the extension
 * itself dialed, so the network edge is known with certainty.
 *
 * `in-browser` mode has no wire at all; treated as loopback (the SW is
 * the backend, on this machine) though no inbound frames ever arrive.
 */
export function isLoopbackBackend(): boolean {
  if (getSetting('backend.mode') === 'in-browser') return true;
  const raw = getSetting('backend.url');
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '::1' || /^127\./.test(host);
  } catch {
    return false;
  }
}
