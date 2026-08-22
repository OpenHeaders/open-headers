/**
 * `ohd upgrade [--channel stable|beta] [--no-restart]` — the daemon's
 * "Update & Restart" verb (the distribution plan §5): resolve the
 * channel's manifest, download the release's `ohd` binary for this
 * platform from the immutable `dl/<tag>/` path, verify it against
 * `SHA256SUMS.txt`, atomically replace the executable, and — because
 * ohd owns its service manager — finish with a supervised restart
 * so the serving process restarts into the new version. The restart
 * only happens when the daemon is actually running under the installed
 * unit; a foreground `ohd run` or a stopped daemon just gets the swap
 * and a note.
 *
 * Ownership refusals, same law as the client CLI: the plain-Node
 * distribution belongs to its own delivery channel, and a container
 * image is immutable — updating either through a binary swap would
 * fight the real owner. Only the self-managed SEA binary upgrades
 * itself.
 *
 * Swap shape mirrors the client CLI: POSIX is a same-directory
 * `rename()` over the target — atomic, and safe under a running daemon
 * (the live process keeps its inode). Windows renames the running exe
 * aside to `.old`, cleaned lazily by the next upgrade.
 */

import { spawnSync } from 'node:child_process';
import { constants, existsSync } from 'node:fs';
import { access, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { isSea } from 'node:sea';
import { parseArgs } from 'node:util';
import { getBuildInfo, resolveAppVersion } from '../build-info';
import type { DaemonConfig } from '../config';
import { CONFIG_OPTIONS, resolveConfigFlags } from './config-flags';
import { probeHealthz } from './healthz-probe';
import { restartService, serviceUnitPath } from './service-manager';
import {
  compareCalVer,
  type DaemonManifestEntry,
  downloadBaseUrl,
  parseDaemonManifestEntry,
  type UpdateChannel,
  versionsManifestUrl,
} from './update-feed';

/** Who owns the running install — only 'binary' may self-upgrade. */
export type DaemonInstallKind = 'binary' | 'node' | 'container';

const KIND_REFUSALS: Record<Exclude<DaemonInstallKind, 'binary'>, string> = {
  node:
    'this ohd runs from the Node distribution — upgrade by replacing its dist/ from the new release, ' +
    'then restart the service',
  container: 'this ohd runs inside a container image — pull the new image and recreate the container',
};

export function detectInstallKind(isSeaBinary: boolean, inContainer: boolean): DaemonInstallKind {
  if (inContainer) return 'container';
  return isSeaBinary ? 'binary' : 'node';
}

/** Platform → published binary leg, mirroring the release matrix. */
export function platformAssetLeg(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === 'darwin' && arch === 'arm64') return 'mac-arm64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'win32' && arch === 'x64') return 'win-x64';
  return null;
}

/** Find the `ohd-<version>-<leg>` line in a release's SHA256SUMS.txt. */
export function findAssetInSums(sums: string, leg: string): { sha256: string; asset: string } | null {
  const pattern = new RegExp(`^\\s*([0-9a-f]{64})\\s+(ohd-[0-9]\\S*-${leg}(?:\\.exe)?)\\s*$`);
  for (const line of sums.split('\n')) {
    const match = pattern.exec(line);
    if (match) return { sha256: match[1], asset: match[2] };
  }
  return null;
}

export interface StageUpgradeDeps {
  env?: NodeJS.ProcessEnv;
  currentVersion?: string;
  channel: UpdateChannel;
  fetchFn?: typeof fetch;
  execPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  installKind?: DaemonInstallKind;
  /** `--version` probe runner; production is a spawnSync of the new binary. */
  probeFn?: (binaryPath: string, env: NodeJS.ProcessEnv) => { status: number | null; stdout: string };
  /** Digest seam so tests can hand in a known hash without 60MB fixtures. */
  sha256Fn?: (bytes: Uint8Array) => Promise<string>;
}

export type StageOutcome =
  | { status: 'up-to-date'; version: string }
  | { status: 'staged'; from: string; to: string; tag: string; asset: string };

async function webCryptoSha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function defaultProbe(binaryPath: string, env: NodeJS.ProcessEnv): { status: number | null; stdout: string } {
  const result = spawnSync(binaryPath, ['--version'], { encoding: 'utf-8', env });
  return { status: result.status, stdout: result.stdout ?? '' };
}

async function fetchOrFail(fetchFn: typeof fetch, url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, { redirect: 'follow' });
  } catch {
    throw new Error(`could not reach the update feed at ${url} — check your network and try again`);
  }
  if (!response.ok) {
    throw new Error(`update feed answered ${response.status} for ${url}`);
  }
  return response;
}

async function resolveManifest(fetchFn: typeof fetch, channel: UpdateChannel): Promise<DaemonManifestEntry> {
  const response = await fetchOrFail(fetchFn, versionsManifestUrl(channel));
  const entry = parseDaemonManifestEntry(await response.json().catch(() => null));
  if (entry === null) {
    throw new Error(`the ${channel} manifest has no readable daemon entry — try again later`);
  }
  return entry;
}

/**
 * The swap: write the verified bytes next to the target, then rename
 * into place — atomic on POSIX; on Windows the running exe is first
 * renamed aside to `.old` (locked leftovers are cleaned by the next
 * upgrade, never at startup).
 */
async function swapBinary(bytes: Uint8Array, targetPath: string, platform: NodeJS.Platform): Promise<void> {
  const dir = path.dirname(targetPath);
  try {
    await access(dir, constants.W_OK);
  } catch {
    throw new Error(`cannot write ${dir} — re-run the install with sufficient permissions`);
  }
  const tmpPath = path.join(dir, `.ohd-upgrade-${process.pid}.tmp`);
  await writeFile(tmpPath, bytes, { mode: 0o755 });
  if (platform === 'win32') {
    const oldPath = `${targetPath}.old`;
    await unlink(oldPath).catch(() => undefined);
    await rename(targetPath, oldPath);
    try {
      await rename(tmpPath, targetPath);
    } catch (err) {
      await rename(oldPath, targetPath).catch(() => undefined);
      await unlink(tmpPath).catch(() => undefined);
      throw new Error(`could not install the new binary: ${err instanceof Error ? err.message : String(err)}`);
    }
    await unlink(oldPath).catch(() => undefined);
  } else {
    await rename(tmpPath, targetPath);
  }
}

/**
 * Resolve → download → verify → swap → probe. No printing and no
 * restart — shared by the `ohd upgrade` verb and the in-daemon
 * auto-updater, which each own their own restart story.
 */
export async function stageUpgrade(deps: StageUpgradeDeps): Promise<StageOutcome> {
  const current = deps.currentVersion ?? resolveAppVersion();
  const kind = deps.installKind ?? detectInstallKind(isSea(), existsSync('/.dockerenv'));
  if (kind !== 'binary') throw new Error(KIND_REFUSALS[kind]);

  const fetchFn = deps.fetchFn ?? fetch;
  const entry = await resolveManifest(fetchFn, deps.channel);
  if (compareCalVer(entry.latest, current) <= 0) {
    return { status: 'up-to-date', version: current };
  }

  const platform = deps.platform ?? process.platform;
  const leg = platformAssetLeg(platform, deps.arch ?? process.arch);
  if (leg === null) throw new Error('no published ohd binary for this platform');

  const baseUrl = downloadBaseUrl(entry.tag);
  const sums = await (await fetchOrFail(fetchFn, `${baseUrl}/SHA256SUMS.txt`)).text();
  const found = findAssetInSums(sums, leg);
  if (found === null) throw new Error(`release ${entry.tag} has no ohd binary for ${leg}`);

  const bytes = new Uint8Array(await (await fetchOrFail(fetchFn, `${baseUrl}/${found.asset}`)).arrayBuffer());
  const actual = await (deps.sha256Fn ?? webCryptoSha256)(bytes);
  if (actual !== found.sha256) {
    throw new Error(`checksum mismatch for ${found.asset} — expected ${found.sha256}, got ${actual}; not installing`);
  }

  const execPath = deps.execPath ?? process.execPath;
  const targetPath = await realpath(execPath).catch(() => execPath);
  await swapBinary(bytes, targetPath, platform);

  // The proof the swap took: the binary now at our own path answers
  // with the manifest's version (the build stamp may follow it).
  const probe = (deps.probeFn ?? defaultProbe)(targetPath, deps.env ?? process.env);
  if (probe.status !== 0 || probe.stdout.trim().split(' ')[0] !== entry.latest) {
    throw new Error(
      `installed ${found.asset} but its --version probe answered '${probe.stdout.trim()}' (exit ${probe.status}) — ` +
        'reinstall from the release page if ohd misbehaves',
    );
  }

  return { status: 'staged', from: current, to: entry.latest, tag: entry.tag, asset: found.asset };
}

export interface UpgradeCommandDeps extends Partial<StageUpgradeDeps> {
  /** Healthz probe seam — is the daemon currently serving? */
  isRunningFn?: (config: DaemonConfig) => Promise<boolean>;
  /** Whether an installed service unit exists for this host. */
  unitExistsFn?: () => boolean;
  /** Supervised restart; production drives the service manager. */
  restartFn?: () => Promise<void>;
  log?: (line: string) => void;
}

export async function commandUpgrade(argv: readonly string[], deps: UpgradeCommandDeps = {}): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    options: { ...CONFIG_OPTIONS, channel: { type: 'string' }, 'no-restart': { type: 'boolean' } },
  });
  const channelFlag = values.channel;
  if (channelFlag !== undefined && channelFlag !== 'stable' && channelFlag !== 'beta') {
    throw new Error('usage: ohd upgrade [--channel stable|beta] [--no-restart]');
  }
  const log = deps.log ?? console.log;

  // The build's own channel is the default line to follow; a dev or
  // unbundled run has no build metadata and nothing meaningful to swap.
  const info = getBuildInfo();
  const buildChannel = deps.channel ?? info?.channel;
  if (buildChannel === undefined) {
    throw new Error('this is a development build — ohd upgrade only works on a released binary');
  }

  const outcome = await stageUpgrade({ ...deps, channel: channelFlag ?? buildChannel });
  if (outcome.status === 'up-to-date') {
    log(`ohd is up to date (${outcome.version}, ${channelFlag ?? buildChannel} channel)`);
    return;
  }
  log(`upgraded ohd ${outcome.from} → ${outcome.to} (${outcome.asset})`);

  const config = resolveConfigFlags(values);
  const running = await (deps.isRunningFn ?? ((c: DaemonConfig) => probeHealthz(c.bindPort)))(config);
  if (!running) {
    log('the daemon is not running — the new version applies on the next start');
    return;
  }
  if (values['no-restart'] === true) {
    log('the running daemon still serves the old version — restart to apply: ohd stop, then ohd start');
    return;
  }
  const host = { platform: process.platform, homedir: os.homedir(), uid: process.getuid?.() ?? 0 };
  const unitExists = deps.unitExistsFn ?? (() => existsSync(serviceUnitPath(host)));
  if (!unitExists()) {
    log('the daemon runs outside the installed service — restart it yourself to apply the new version');
    return;
  }
  const restart = deps.restartFn ?? (() => restartService(host));
  await restart();
  log(`restarted the daemon into ${outcome.to}`);
}
