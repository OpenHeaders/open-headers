/**
 * `oh-nm-host` — the Open Headers native-messaging bootstrap host
 * (OBSERVABILITY_PLAN.md §4 + §8 Phase 7).
 *
 * The browser spawns this binary per its NM manifest; the extension
 * sends ONE bootstrap request (`chrome.runtime.sendNativeMessage`);
 * the host dials the desktop daemon's loopback `/nm/bootstrap` route,
 * relays the answer as one framed message, and exits. Token handoff
 * only — the WS lifeline carries everything else, always (§9: NM is
 * never bulk transport).
 *
 * Compiled with `bun build --compile` (see `scripts/pack-bun.mjs`) so
 * one signable, self-contained binary ships inside the desktop app's
 * resources; the source stays runtime-neutral Node APIs except the
 * win32 image-name probe, which needs an in-process syscall
 * (`bun:ffi`) that only the compiled binary's runtime provides.
 */

import * as process from 'node:process';
import { type BootstrapResponse, parseBootstrapRequest, performBootstrap } from './bootstrap';
import { createNmMessageDecoder, encodeNmMessage } from './framing';
import { verifyDaemonListener } from './verify-daemon';
import { win32ImageNamePath } from './win32-image-name';

/** A stuck spawn (browser never writes, daemon hangs) must not leak hosts. */
const IDLE_EXIT_MS = 30_000;

function respondAndExit(response: BootstrapResponse): void {
  process.stdout.write(encodeNmMessage(response), () => {
    process.exit(0);
  });
}

/** The listener must be the desktop app this binary shipped with —
 *  refusal detail goes to stderr (the browser's extension log). */
async function listenerVerified(port: number): Promise<boolean> {
  const verification = await verifyDaemonListener({
    port,
    ownExecutablePath: process.execPath,
    ...(process.platform === 'win32' ? { readImageName: win32ImageNamePath } : {}),
  });
  if (!verification.ok) process.stderr.write(`listener verification refused: ${verification.detail}\n`);
  return verification.ok;
}

function main(): void {
  const idleTimer = setTimeout(() => {
    process.exit(1);
  }, IDLE_EXIT_MS);
  let handled = false;
  const decoder = createNmMessageDecoder({
    onMessage: (value) => {
      if (handled) return;
      handled = true;
      clearTimeout(idleTimer);
      const request = parseBootstrapRequest(value);
      if (!request) {
        respondAndExit({ ok: false, reason: 'bad-request' });
        return;
      }
      void performBootstrap(request, { verifyListener: listenerVerified }).then(respondAndExit);
    },
    onProtocolError: () => {
      clearTimeout(idleTimer);
      process.exit(1);
    },
  });
  process.stdin.on('data', (chunk: Buffer) => decoder.push(chunk));
  process.stdin.on('end', () => {
    if (!handled) process.exit(0);
  });
}

main();
