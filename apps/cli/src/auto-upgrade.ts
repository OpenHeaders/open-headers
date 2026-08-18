/**
 * Background self-update (the distribution plan §5) — the automatic
 * half that makes the NEXT invocation launch the new version. When the
 * daily notify cache shows a newer release and this is a self-managed
 * binary install, a detached `oh upgrade` is spawned and this process
 * exits normally: the child downloads, verifies, and atomically swaps
 * the binary behind the running command (the swap machinery in
 * `upgrade.ts` handles a live executable on every platform).
 *
 * The cache is only the trigger — the child re-resolves the live
 * manifest and re-checks ownership, versions, and checksums itself, so
 * a stale cache can never install anything the feed no longer offers.
 *
 * Gates, all silent: `autoUpdate` config off, dev builds, CI,
 * `OH_NO_UPDATE_CHECK`, package-manager-owned installs (npm/brew/system
 * update through their manager, same refusal law as `oh upgrade`), and
 * the `upgrade`/`autoupdate` verbs themselves. One spawn per offered
 * version per day (`upgrade-attempt.json`), so a persistently failing
 * feed never turns invocations into a retry storm.
 */

import { spawn } from 'node:child_process';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { cliConfigPath, readCliConfig } from './config-store';
import { readUpdateCheckCache, UPDATE_CHECK_ENV, updateCheckCachePath } from './update-check';
import { compareCalVer } from './update-feed';
import { detectInstallOwner } from './upgrade';
import { CLI_VERSION } from './version';

const ATTEMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function autoUpgradeAttemptPath(configPath: string): string {
  return path.join(path.dirname(configPath), 'upgrade-attempt.json');
}

interface AttemptStamp {
  version: string;
  attemptedAt: number;
}

function parseAttempt(raw: unknown): AttemptStamp | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { version, attemptedAt } = raw as Record<string, unknown>;
  if (typeof version !== 'string' || typeof attemptedAt !== 'number') return null;
  return { version, attemptedAt };
}

export interface AutoUpgradeDeps {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  cliVersion?: string;
  execPath?: string;
  scriptPath?: string;
  now?: () => number;
  /** Detached-spawn seam; production launches `<binary> upgrade` unref'd. */
  spawnFn?: (binaryPath: string, args: string[], env: NodeJS.ProcessEnv) => void;
}

function defaultSpawn(binaryPath: string, args: string[], env: NodeJS.ProcessEnv): void {
  const child = spawn(binaryPath, args, { detached: true, stdio: 'ignore', env, windowsHide: true });
  child.unref();
}

/**
 * Decide, stamp, and spawn. Returns the stderr line owed when a
 * background upgrade was kicked off (the caller prints it under the
 * notify line's visibility gates), null otherwise. Every failure path
 * is silent — auto-update can never change a command's outcome.
 */
export async function maybeSpawnAutoUpgrade(
  argv: readonly string[],
  deps: AutoUpgradeDeps = {},
): Promise<string | null> {
  try {
    const env = deps.env ?? process.env;
    const cliVersion = deps.cliVersion ?? CLI_VERSION;
    if (cliVersion === 'dev') return null;
    if ((env[UPDATE_CHECK_ENV] ?? '') !== '') return null;
    if ((env.CI ?? '') !== '') return null;
    // `upgrade` IS the action; `autoupdate` may be turning it off.
    if (argv[0] === 'upgrade' || argv[0] === 'autoupdate') return null;

    const configPath = deps.configPath ?? cliConfigPath();
    let config: Awaited<ReturnType<typeof readCliConfig>>;
    try {
      config = await readCliConfig(configPath);
    } catch {
      // A malformed config raises its loud error on the command's own
      // read; the background path just stands down.
      return null;
    }
    if (config.autoUpdate === false) return null;

    const execPath = deps.execPath ?? process.execPath;
    const scriptPath = deps.scriptPath ?? process.argv[1] ?? '';
    const realExecPath = await realpath(execPath).catch(() => execPath);
    if (detectInstallOwner(execPath, realExecPath, scriptPath) !== null) return null;

    const cache = await readUpdateCheckCache(updateCheckCachePath(configPath));
    if (cache === null) return null;
    if (cache.channel !== (config.channel ?? 'stable')) return null;
    if (compareCalVer(cache.latest, cliVersion) <= 0) return null;

    const now = (deps.now ?? Date.now)();
    const attemptPath = autoUpgradeAttemptPath(configPath);
    const attempt = await readFile(attemptPath, 'utf8')
      .then((raw) => parseAttempt(JSON.parse(raw)))
      .catch(() => null);
    if (attempt !== null && attempt.version === cache.latest && now - attempt.attemptedAt < ATTEMPT_INTERVAL_MS) {
      return null;
    }
    // Stamp before spawning — parallel invocations racing here at worst
    // spawn twice, and the swap itself is checksum-verified + atomic.
    const stamp: AttemptStamp = { version: cache.latest, attemptedAt: now };
    await writeFile(attemptPath, `${JSON.stringify(stamp, null, 2)}\n`);

    // The child re-runs every check against the live manifest; the env
    // silences its own notify path so nothing recurses.
    (deps.spawnFn ?? defaultSpawn)(realExecPath, ['upgrade'], { ...env, [UPDATE_CHECK_ENV]: '1' });
    return `updating oh to ${cache.latest} in the background — the next run launches the new version`;
  } catch {
    return null;
  }
}
