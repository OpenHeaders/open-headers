/**
 * A throwaway GnuPG home for one signing job, shared by the apt and rpm
 * stagers. gpg autostarts daemons on the home it works in (gpg-agent,
 * scdaemon, keyboxd) and every one of them outlives the gpg call that
 * started it, holding sockets and lock files in the home and writing
 * there again on its own exit — so the home is never just removed: the
 * daemons are stopped first, through gpgconf, which waits for them.
 *
 * The teardown also rides the process `exit` event, because the
 * stagers leave through `fail()` (`process.exit`) which skips every
 * `finally` — the road that left agents running on removed homes.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

/**
 * Stop every daemon gpg started on `home`. A no-op when none runs.
 */
export function stopGpgDaemons(home) {
  try {
    execFileSync('gpgconf', ['--kill', 'all'], { env: { ...process.env, GNUPGHOME: home }, stdio: 'ignore' });
  } catch {
    // nothing running on that home, or no gpgconf — nothing to stop
  }
}

/**
 * Run `fn(gpg)` against a fresh home under the OS temp dir; `gpg(args,
 * options)` is `gpg --batch ...` scoped to it. The home and its daemons
 * are gone when `fn` returns, throws, or the process exits inside it.
 */
export function withThrowawayGpgHome(prefix, fn) {
  const home = mkdtempSync(path.join(tmpdir(), prefix));
  const env = { ...process.env, GNUPGHOME: home };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopGpgDaemons(home);
    rmSync(home, { recursive: true, force: true });
  };
  process.once('exit', dispose);
  try {
    return fn((args, options = {}) => execFileSync('gpg', ['--batch', ...args], { env, ...options }));
  } finally {
    dispose();
    process.off('exit', dispose);
  }
}
