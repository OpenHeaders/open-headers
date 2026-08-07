/**
 * The `launch` verb — open the desktop app on an explicit user gesture
 * (the extension's "Open the desktop app" affordances). The launched
 * binary is anchored by the manifest-installed reality: this host ships
 * inside the desktop app's resources, so the app it launches is derived
 * from the host binary's OWN location (`appInstallRoot`, the same
 * derivation listener verification trusts) — never from anything on
 * the wire, which carries no fields at all. A host running from the
 * dev layout has no install root and refuses (`unanchored`); the
 * degraded path stays what it is today — the user opens the app
 * themselves.
 *
 * Platform shapes: macOS hands the bundle to `open` (fronts an already
 * running app instead of double-launching); Windows and Linux spawn
 * the app binary at its packaged location under the install root,
 * detached so the app outlives this short-lived host process.
 */

import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import * as path from 'node:path';
import { appInstallRoot } from './verify-daemon';

export interface LaunchRequest {
  readonly kind: 'launch';
}

/** Validate the inbound NM message shape; null = not a launch request. */
export function parseLaunchRequest(raw: unknown): LaunchRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { kind?: unknown };
  if (record.kind !== 'launch') return null;
  return { kind: 'launch' };
}

export type LaunchResponse =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unanchored' | 'launch-failed' };

/** Fire one detached process; resolves false when the spawn errors. */
export type DetachedSpawner = (file: string, args: readonly string[]) => Promise<boolean>;

export const defaultDetachedSpawner: DetachedSpawner = (file, args) =>
  new Promise((resolve) => {
    try {
      const child = spawn(file, [...args], { detached: true, stdio: 'ignore' });
      child.once('error', () => resolve(false));
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });

/** The app binary's packaged name under the install root (electron-builder). */
const WINDOWS_APP_BINARY = 'OpenHeaders.exe';
const LINUX_APP_BINARY = 'open-headers';

/** Separator-correct path flavor for the platform under launch. */
function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/** The platform launch command for an anchored install root; null = unsupported platform. */
export function launchCommand(
  installRoot: string,
  platform: NodeJS.Platform,
): { file: string; args: readonly string[] } | null {
  if (platform === 'darwin') return { file: 'open', args: [installRoot] };
  if (platform === 'win32') return { file: pathFor(platform).join(installRoot, WINDOWS_APP_BINARY), args: [] };
  if (platform === 'linux') return { file: pathFor(platform).join(installRoot, LINUX_APP_BINARY), args: [] };
  return null;
}

export interface PerformLaunchDeps {
  /** This host binary's own path (`process.execPath` in the binary). */
  readonly ownExecutablePath: string;
  /** Platform seam — defaults to `process.platform`. */
  readonly platform?: NodeJS.Platform;
  /** Spawn seam — defaults to a real detached spawn. */
  readonly spawnDetached?: DetachedSpawner;
  /** Existence seam for the direct-binary platforms. */
  readonly fileExists?: (target: string) => boolean;
}

function safeRealpath(candidate: string): string {
  try {
    return realpathSync(candidate);
  } catch {
    return candidate;
  }
}

/**
 * Launch the desktop app this host shipped with. Never throws — every
 * failure is a typed refusal relayed as the framed answer.
 */
export async function performLaunch(deps: PerformLaunchDeps): Promise<LaunchResponse> {
  const platform = deps.platform ?? process.platform;
  const installRoot = appInstallRoot(safeRealpath(deps.ownExecutablePath), platform);
  if (installRoot === null) return { ok: false, reason: 'unanchored' };
  const command = launchCommand(installRoot, platform);
  if (command === null) return { ok: false, reason: 'unanchored' };
  if (platform !== 'darwin') {
    const exists = deps.fileExists ?? existsSync;
    // The anchored binary must actually be there — a moved/broken
    // install answers honestly instead of spawning into an error.
    if (!exists(command.file)) return { ok: false, reason: 'unanchored' };
  }
  const spawnDetached = deps.spawnDetached ?? defaultDetachedSpawner;
  const launched = await spawnDetached(command.file, command.args);
  return launched ? { ok: true } : { ok: false, reason: 'launch-failed' };
}
