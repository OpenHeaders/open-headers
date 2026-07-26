/**
 * Peer-facing companion-reveal plane — answers the `companionReveal`
 * WS channel a browser surface sends to bring THIS app forward
 * (front the window, then reveal a desktop-only tool window or the
 * MCP settings category).
 *
 * Gating: authenticated admission plus a same-device check — popping a
 * window is UI control of a personal machine, so an off-device
 * (LAN/WAN) peer gets an honest refusal instead of remotely steering
 * someone's desktop. No capability tier and no audit row: nothing is
 * read or written on the peer's behalf (the status-probe posture) —
 * accepted reveals land one observability log line instead. A short
 * coalescing window absorbs repeat frames (double-clicks, a hostile
 * peer spamming focus-steal): within it the earlier reveal already
 * fronted the window, so the answer stays `ok` without re-revealing.
 * The target is validated against the protocol vocabulary; the
 * Electron leg is injected so the plane tests without a shell.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import { type CompanionRevealTarget, isCompanionRevealTarget } from '@openheaders/core/protocol';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '@openheaders/oracle-host-node/host-runtime/ws-server';

const SCOPE = 'CompanionReveal';

/** Repeat frames inside this window coalesce into the reveal that
 *  already ran — the anti-focus-steal-spam bound. */
const REVEAL_COALESCE_MS = 1_000;

export interface CompanionRevealPlaneOptions {
  reveal: (target: CompanionRevealTarget) => void;
  /** Injectable clock for tests; defaults to `Date.now`. */
  now?: () => number;
}

export function createCompanionRevealPeerRpc(options: CompanionRevealPlaneOptions): WsPeerRpcHooks {
  const now = options.now ?? Date.now;
  let lastRevealAt = Number.NEGATIVE_INFINITY;
  return {
    owns(type: string): boolean {
      return type === 'companionReveal';
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      if (peer.isLoopback !== true) {
        logger.warn(SCOPE, `refused off-device reveal request (user=${peer.userId})`);
        return { ok: false, reason: 'Only a browser on this machine can bring the desktop app forward.' };
      }
      if (!isCompanionRevealTarget(message.target)) {
        return { ok: false, reason: 'Unknown reveal target.' };
      }
      if (now() - lastRevealAt < REVEAL_COALESCE_MS) {
        return { ok: true };
      }
      lastRevealAt = now();
      logger.info(SCOPE, `revealing '${message.target}' for a connected browser surface (user=${peer.userId})`);
      options.reveal(message.target);
      return { ok: true };
    },
  };
}
