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
 * resources; the source stays runtime-neutral Node APIs.
 */

import * as process from 'node:process';
import { type BootstrapResponse, parseBootstrapRequest, performBootstrap } from './bootstrap';
import { createNmMessageDecoder, encodeNmMessage } from './framing';

/** A stuck spawn (browser never writes, daemon hangs) must not leak hosts. */
const IDLE_EXIT_MS = 30_000;

function respondAndExit(response: BootstrapResponse): void {
  process.stdout.write(encodeNmMessage(response), () => {
    process.exit(0);
  });
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
      void performBootstrap(request).then(respondAndExit);
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
