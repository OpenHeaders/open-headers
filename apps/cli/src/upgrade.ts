/**
 * `oh upgrade [--channel stable|beta]` — the explicit half of the
 * update pair (`DISTRIBUTION_PLAN.md` §5): resolve the channel's
 * manifest, download the release's own binary for this platform from
 * the feed's immutable `dl/<tag>/` path, verify it against
 * `SHA256SUMS.txt`, and atomically replace the running executable.
 * Never automatic — this verb is typed by a human, and it REFUSES when
 * a package manager owns the install (naming the manager) so the two
 * update mechanisms can never fight over one path.
 *
 * Ownership is detected from static facts of the running process, no
 * subprocess spawns: a non-compiled invocation (node/bun executing the
 * npm package's `dist/cli.js`) belongs to npm; a resolved binary path
 * inside a Homebrew cellar belongs to brew; a system prefix (`/usr`
 * outside `/usr/local`) belongs to the system package manager.
 *
 * Swap shape: POSIX is a same-directory `rename()` over the target —
 * atomic. Windows cannot overwrite or delete a running exe but CAN
 * rename it: current → `.old`, new → current, and the locked `.old`
 * is deleted lazily by the NEXT upgrade — no startup sweep, keeping
 * normal invocations free of the cost.
 */

import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { cliConfigPath, readCliConfig, type UpdateChannel, writeCliConfig } from './config-store';
import { OperationFailedError, UsageError } from './exit-codes';
import { UPDATE_CHECK_ENV } from './update-check';
import {
  type CliManifestEntry,
  compareCalVer,
  downloadBaseUrl,
  parseCliManifestEntry,
  versionsManifestUrl,
} from './update-feed';
import { CLI_VERSION } from './version';

export type InstallOwner = 'npm' | 'brew' | 'system';

const OWNER_REFUSALS: Record<InstallOwner, string> = {
  npm: 'this oh is installed by npm — upgrade with: npm install -g @openheaders/cli@latest',
  brew: 'this oh is installed by Homebrew — upgrade with: brew upgrade',
  system: 'this oh is installed by a system package manager (apt/yum) — upgrade through it',
};

/**
 * Which package manager owns the running install, from static path
 * facts: `execPath` as invoked, its symlink-resolved real path, and
 * the script path (the npm channel runs `dist/cli.js` under node).
 */
export function detectInstallOwner(execPath: string, realExecPath: string, scriptPath: string): InstallOwner | null {
  // Split on both separators — the judged path's flavor is the target
  // machine's, never the host's (path.basename would miss `\` on POSIX).
  const runtime = (execPath.split(/[\\/]/).pop() ?? '').toLowerCase();
  if (runtime === 'node' || runtime === 'node.exe' || runtime === 'bun' || runtime === 'bun.exe') return 'npm';
  if (scriptPath.includes('node_modules')) return 'npm';
  if (
    realExecPath.includes('/Cellar/') ||
    realExecPath.includes('/homebrew/') ||
    realExecPath.includes('/linuxbrew/')
  ) {
    return 'brew';
  }
  if (realExecPath.startsWith('/usr/') && !realExecPath.startsWith('/usr/local/')) return 'system';
  return null;
}

/** Platform → published binary leg, mirroring the install scripts' matrix. */
export function platformAssetLeg(platform: NodeJS.Platform, arch: string): string | null {
  if (platform === 'darwin' && arch === 'arm64') return 'mac-arm64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'win32' && arch === 'x64') return 'win-x64';
  return null;
}

/** Find the `oh-<version>-<leg>` line in a release's SHA256SUMS.txt. */
export function findAssetInSums(sums: string, leg: string): { sha256: string; asset: string } | null {
  const pattern = new RegExp(`^\\s*([0-9a-f]{64})\\s+(oh-[0-9]\\S*-${leg}(?:\\.exe)?)\\s*$`);
  for (const line of sums.split('\n')) {
    const match = pattern.exec(line);
    if (match) return { sha256: match[1], asset: match[2] };
  }
  return null;
}

export interface UpgradeDeps {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  cliVersion?: string;
  fetchFn?: typeof fetch;
  execPath?: string;
  scriptPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
  /** `--version` probe runner; production is a spawnSync of the new binary. */
  probeFn?: (binaryPath: string, env: NodeJS.ProcessEnv) => { status: number | null; stdout: string };
  /** Digest seam so tests can hand in a known hash without 60MB fixtures. */
  sha256Fn?: (bytes: Uint8Array) => Promise<string>;
}

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
    throw new OperationFailedError(`could not reach the update feed at ${url} — check your network and try again`);
  }
  if (!response.ok) {
    throw new OperationFailedError(`update feed answered ${response.status} for ${url}`);
  }
  return response;
}

async function resolveManifest(fetchFn: typeof fetch, channel: UpdateChannel): Promise<CliManifestEntry> {
  const response = await fetchOrFail(fetchFn, versionsManifestUrl(channel));
  const entry = parseCliManifestEntry(await response.json().catch(() => null));
  if (entry === null) {
    throw new OperationFailedError(`the ${channel} manifest has no readable cli entry — try again later`);
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
    throw new OperationFailedError(
      `cannot write ${dir} — re-run the install script with sufficient permissions or upgrade through the owning package manager`,
    );
  }
  const tmpPath = path.join(dir, `.oh-upgrade-${process.pid}.tmp`);
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
      throw new OperationFailedError(
        `could not install the new binary: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // Locked while this process runs; the next upgrade's unlink clears it.
    await unlink(oldPath).catch(() => undefined);
  } else {
    await rename(tmpPath, targetPath);
  }
}

export async function commandUpgrade(argv: readonly string[], deps: UpgradeDeps = {}): Promise<string[]> {
  let parsed: { values: { channel?: string; json?: boolean }; positionals: string[] };
  try {
    parsed = parseArgs({
      args: [...argv],
      options: { channel: { type: 'string' }, json: { type: 'boolean' } },
      allowPositionals: true,
    });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
  if (parsed.positionals.length > 0) throw new UsageError(`unexpected argument: ${parsed.positionals[0]}`);
  const channelFlag = parsed.values.channel;
  if (channelFlag !== undefined && channelFlag !== 'stable' && channelFlag !== 'beta') {
    throw new UsageError('usage: oh upgrade [--channel stable|beta]');
  }
  const json = parsed.values.json === true;

  const current = deps.cliVersion ?? CLI_VERSION;
  if (current === 'dev') {
    throw new OperationFailedError('this is a development build — oh upgrade only works on a released binary');
  }

  const configPath = deps.configPath ?? cliConfigPath();
  const existing = await readCliConfig(configPath);
  const channel: UpdateChannel = channelFlag ?? existing.channel ?? 'stable';
  // --channel persists like `oh channel` — merge over the existing file,
  // owning only its own key.
  if (channelFlag !== undefined && existing.channel !== channelFlag) {
    await writeCliConfig(configPath, { ...existing, channel: channelFlag });
  }

  const execPath = deps.execPath ?? process.execPath;
  const scriptPath = deps.scriptPath ?? process.argv[1] ?? '';
  const realExecPath = await realpath(execPath).catch(() => execPath);
  const owner = detectInstallOwner(execPath, realExecPath, scriptPath);
  if (owner !== null) throw new OperationFailedError(OWNER_REFUSALS[owner]);

  const fetchFn = deps.fetchFn ?? fetch;
  const entry = await resolveManifest(fetchFn, channel);
  if (compareCalVer(entry.latest, current) <= 0) {
    if (json) return [JSON.stringify({ status: 'up-to-date', version: current, channel }, null, 2)];
    return [`oh is up to date (${current}, ${channel} channel)`];
  }

  const platform = deps.platform ?? process.platform;
  const leg = platformAssetLeg(platform, deps.arch ?? process.arch);
  if (leg === null) {
    throw new OperationFailedError(
      'no published binary for this platform — use the Node channel instead: npm install -g @openheaders/cli',
    );
  }

  const baseUrl = downloadBaseUrl(entry.tag);
  const sums = await (await fetchOrFail(fetchFn, `${baseUrl}/SHA256SUMS.txt`)).text();
  const found = findAssetInSums(sums, leg);
  if (found === null) {
    throw new OperationFailedError(`release ${entry.tag} has no oh binary for ${leg}`);
  }

  const bytes = new Uint8Array(await (await fetchOrFail(fetchFn, `${baseUrl}/${found.asset}`)).arrayBuffer());
  const actual = await (deps.sha256Fn ?? webCryptoSha256)(bytes);
  if (actual !== found.sha256) {
    throw new OperationFailedError(
      `checksum mismatch for ${found.asset} — expected ${found.sha256}, got ${actual}; not installing`,
    );
  }

  await swapBinary(bytes, realExecPath, platform);

  // The proof the swap took: the binary now at our own path answers
  // with the manifest's version. The check itself is silenced so the
  // probe can never recurse into a notify fetch.
  const probeEnv = { ...(deps.env ?? process.env), [UPDATE_CHECK_ENV]: '1' };
  const probe = (deps.probeFn ?? defaultProbe)(realExecPath, probeEnv);
  if (probe.status !== 0 || probe.stdout.trim() !== entry.latest) {
    throw new OperationFailedError(
      `installed ${found.asset} but its --version probe answered '${probe.stdout.trim()}' (exit ${probe.status}) — reinstall via the install script if oh misbehaves`,
    );
  }

  if (json) {
    return [
      JSON.stringify(
        { status: 'upgraded', from: current, to: entry.latest, tag: entry.tag, asset: found.asset, channel },
        null,
        2,
      ),
    ];
  }
  const lines = [`upgraded oh ${current} → ${entry.latest} (${found.asset}, ${channel} channel)`];
  if (channelFlag !== undefined && existing.channel !== channelFlag) lines.push(`channel set to ${channelFlag}`);
  return lines;
}
