/**
 * Windows user-PATH refresh. Installers append to the user PATH in the
 * registry (`HKCU\Environment`), but an already-running process never
 * receives that change — its env is a snapshot from launch, and every
 * child it spawns inherits the stale copy. Real terminal emulators
 * read the registry at session start; this module gives the pty host
 * and the CLI binary probe the same power, so a tool installed while
 * the app runs works in the next terminal tab without an app restart.
 *
 * POSIX needs none of this — terminal tabs run login shells whose
 * profiles rebuild PATH on every spawn.
 */

import { execFile } from 'node:child_process';

/** Case-insensitive env lookup — Windows env names have no canonical case. */
function lookupEnv(env: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  const upper = name.toUpperCase();
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === upper) return env[key];
  }
  return undefined;
}

/**
 * Expand `%VAR%` references (REG_EXPAND_SZ values) against the given
 * env. Unknown references stay literal — matching how Windows leaves
 * unresolvable expansions in place.
 */
export function expandEnvRefs(value: string, env: Readonly<Record<string, string | undefined>>): string {
  return value.replace(/%([^%]+)%/g, (whole, name: string) => lookupEnv(env, name) ?? whole);
}

/**
 * Pull the `Path` value out of `reg query HKCU\Environment /v Path`
 * output. Returns null when the value is absent (a machine where no
 * installer ever touched the user PATH has no `Path` value at all).
 */
export function parseRegQueryPath(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.+)$/i.exec(line);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Merge registry user-PATH entries into a live PATH value: entries the
 * process already has keep their position; registry-only entries
 * append. Case-insensitive comparison, trailing-separator tolerant.
 */
export function mergeWindowsPath(processPath: string, userPath: string): string {
  const normalize = (entry: string): string => entry.replace(/[\\/]+$/, '').toUpperCase();
  const present = new Set(
    processPath
      .split(';')
      .filter((entry) => entry !== '')
      .map(normalize),
  );
  const additions = userPath.split(';').filter((entry) => entry !== '' && !present.has(normalize(entry)));
  if (additions.length === 0) return processPath;
  return [processPath, ...additions].join(';');
}

/**
 * The registry user PATH, `%VAR%`-expanded — or null when the value is
 * missing or `reg.exe` fails (non-Windows, hardened hosts). Callers
 * treat null as "nothing beyond the process env".
 */
export function readWindowsUserPath(env: Readonly<Record<string, string | undefined>>): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      'reg.exe',
      ['query', 'HKCU\\Environment', '/v', 'Path'],
      { timeout: 3000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const raw = parseRegQueryPath(stdout);
        resolve(raw === null ? null : expandEnvRefs(raw, env));
      },
    );
  });
}

/**
 * The given env's PATH with current registry user-PATH entries merged
 * in — or null when the registry adds nothing (callers keep their env
 * untouched).
 */
export async function refreshedWindowsPath(env: Readonly<Record<string, string | undefined>>): Promise<string | null> {
  const userPath = await readWindowsUserPath(env);
  if (userPath === null) return null;
  const processPath = lookupEnv(env, 'PATH') ?? '';
  const merged = mergeWindowsPath(processPath, userPath);
  return merged === processPath ? null : merged;
}
