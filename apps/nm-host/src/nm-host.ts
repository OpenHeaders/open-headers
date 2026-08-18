/**
 * `oh-nm-host` — the Open Headers native-messaging host
 * (the observability plan §4 + §8 Phase 7).
 *
 * The browser spawns this binary per its NM manifest. Four verbs, one
 * dispatch on the first framed message:
 *
 *   - `bootstrap` — the original one-shot token handoff
 *     (`chrome.runtime.sendNativeMessage`): dial the desktop daemon's
 *     loopback `/nm/bootstrap` route, relay the answer, exit. Token
 *     handoff only — the WS lifeline carries everything else, always
 *     (§9: NM is never bulk transport).
 *   - `watch` — the long-lived mode behind the extension's
 *     auto-connect sentinel (`chrome.runtime.connectNative`): poll the
 *     loopback port and post the up-signal the moment the verified
 *     desktop app appears; heartbeat frames keep the service worker
 *     alive across the wait. Ends when the port closes.
 *   - `launch` — explicit user gesture: open the desktop app this
 *     host shipped with (anchored by the binary's own install root,
 *     never by the wire), relay the verdict, exit.
 *   - `presence` — the extension's install probe: answer that this
 *     binary runs, plus whether a launch from here would anchor
 *     (dev layouts answer `anchored: false`), exit.
 *
 * Anything else answers one `bad-request` frame and exits.
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
import { type LaunchResponse, parseLaunchRequest, performLaunch } from './launch';
import { type PresenceResponse, parsePresenceRequest, performPresence } from './presence';
import { verifyDaemonListener } from './verify-daemon';
import { parseWatchRequest, startWatch } from './watch';
import { win32ImageNamePath } from './win32-image-name';

/** A stuck spawn (browser never writes, daemon hangs) must not leak hosts. */
const IDLE_EXIT_MS = 30_000;

function respondAndExit(response: BootstrapResponse | LaunchResponse | PresenceResponse): void {
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
  let watching = false;
  const decoder = createNmMessageDecoder({
    onMessage: (value) => {
      if (handled) return;
      handled = true;
      clearTimeout(idleTimer);
      const bootstrap = parseBootstrapRequest(value);
      if (bootstrap) {
        void performBootstrap(bootstrap, { verifyListener: listenerVerified }).then(respondAndExit);
        return;
      }
      const watch = parseWatchRequest(value);
      if (watch) {
        const session = startWatch(watch, {
          post: (message) => process.stdout.write(encodeNmMessage(message)),
          verifyListener: listenerVerified,
        });
        if (session === null) {
          respondAndExit({ ok: false, reason: 'bad-request' });
          return;
        }
        watching = true;
        return;
      }
      const launch = parseLaunchRequest(value);
      if (launch) {
        void performLaunch({ ownExecutablePath: process.execPath }).then(respondAndExit);
        return;
      }
      const presence = parsePresenceRequest(value);
      if (presence) {
        respondAndExit(performPresence({ ownExecutablePath: process.execPath }));
        return;
      }
      respondAndExit({ ok: false, reason: 'bad-request' });
    },
    onProtocolError: () => {
      clearTimeout(idleTimer);
      process.exit(1);
    },
  });
  process.stdin.on('data', (chunk: Buffer) => decoder.push(chunk));
  process.stdin.on('end', () => {
    if (!handled || watching) process.exit(0);
  });
  // A watch host whose port vanished mid-write (browser shut down)
  // must exit, not crash on EPIPE.
  process.stdout.on('error', () => {
    process.exit(0);
  });
}

main();
