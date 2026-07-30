/**
 * Desktop environment-plane bootstrap (docs/REQUEST_ENGINE_PROXY_DESIGN.md):
 * the Chromium `resolveProxy` adapter that makes node-dialed sends
 * follow this machine's proxy reality — Windows WinINET/GPO settings,
 * macOS System Settings, PAC files, WPAD discovery, per-URL PAC
 * answers — with zero evaluator code of ours. "Works exactly like
 * Chrome on this machine" is the corporate promise, verbatim.
 *
 * Resolution rides a DEDICATED in-memory session partition, never the
 * UI session: PAC JS executes inside Chromium's sandboxed network
 * service (the static-bundling law — we never evaluate remote code in
 * our process), and the P3 explicit-PAC mode points this same
 * session's `setProxy({ pacScript })` at a user-chosen PAC without
 * touching what the windows browse with. System mode is the default
 * (FORK A); the Off / Manual / PAC mode radio lands with the P3
 * settings UI.
 *
 * The adapter answers `null` on any resolution failure — Chromium
 * itself treats an unresolvable answer as DIRECT, and the plane's job
 * is seamlessness, never a new way for a send to fail.
 */

import type { EnvironmentProxyResolver } from '@openheaders/oracle-host-node/live/environment-proxy';
import {
  parsePacProxyList,
  registerEnvironmentProxyResolver,
} from '@openheaders/oracle-host-node/live/environment-proxy';
import { session } from 'electron';

/** The Chromium-backed resolver over an injected `resolveProxy` — the
 *  Electron session stays behind this seam so the mapping is
 *  unit-testable without a browser. */
export function chromiumEnvironmentProxyResolver(
  resolveProxy: (url: string) => Promise<string>,
): EnvironmentProxyResolver {
  return {
    async resolve(url: string) {
      try {
        const entries = parsePacProxyList(await resolveProxy(url));
        return entries.length === 0 ? null : { entries, source: 'system' as const };
      } catch {
        return null;
      }
    },
  };
}

/** Register the desktop's environment-plane resolver. Called once from
 *  the engine bootstrap, after `app` is ready (sessions need it). */
export function installEnvironmentProxyResolver(): void {
  const resolverSession = session.fromPartition('environment-proxy-resolver');
  registerEnvironmentProxyResolver(chromiumEnvironmentProxyResolver((url) => resolverSession.resolveProxy(url)));
}
