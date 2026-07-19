/**
 * CLI provisioning — the host side of the Settings "Command-line
 * access" flow (`oh.daemon.cli.*`). One explicit click mints an
 * `apiToken` labeled `CLI — <hostname>` through the same ledger path as
 * `tokens.mint` and merges `{daemonUrl, token}` into the machine's
 * `openheaders/cli.json` (`@openheaders/core/cli-config` — one path and
 * shape law with the CLI itself), dir 0700 / file 0600. The raw secret
 * goes straight to disk in this process and never crosses the RPC
 * contract.
 *
 * Rotate-don't-accumulate: `OH.cliProvision` remembers the last
 * provisioned tokenId; re-provisioning mints first, writes the file,
 * THEN revokes the remembered token (and evicts its live peers) — a
 * mid-flight failure never leaves the machine without a working
 * credential, and the devices ledger never fills with orphan CLI rows.
 *
 * Status is derived live on every call — the file's token is hashed
 * against the ledger (read-only, no `lastUsedAt` bump), never cached —
 * so a revoke from the tokens ledger reads as `stale` here immediately.
 * A malformed file is refused and reported, same law as `oh connect`;
 * a foreign `daemonUrl` with a token this ledger doesn't know reads as
 * `external` so the UI can warn before clobbering someone's remote
 * setup.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLI_CONFIG_DIR_MODE,
  CLI_CONFIG_FILE_MODE,
  type CliConfig,
  cliConfigPathSegments,
  mergeCliConnection,
  parseCliConfig,
  serializeCliConfig,
} from '@openheaders/core/cli-config';
import { mintDaemonAuthToken, peekDaemonAuthToken, revokeDaemonAuthToken } from '@openheaders/core/identity';
import { hostStorage, OH } from '@openheaders/core/storage';

export interface CliProvisionStatus {
  configPath: string;
  state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed';
  tokenId?: string;
  label?: string;
  daemonUrl?: string;
  error?: string;
}

export type CliProvisionResult = { ok: true; configPath: string; tokenId: string } | { ok: false; error: string };

export interface CliProvisionService {
  status(): Promise<CliProvisionStatus>;
  provision(): Promise<CliProvisionResult>;
}

export interface CliProvisionDeps {
  /** The port the WS server is actually bound on right now. */
  getBoundPort(): number;
  /** Live-peer eviction on rotate — same posture as `tokens.revoke`. */
  closePeersByTokenId(tokenId: string): void;
  /** Test seams — default to the real process/host values. */
  env?: Readonly<Record<string, string | undefined>>;
  homedir?: string;
  platform?: string;
  hostname?: string;
  now?: () => number;
}

/** The loopback URL this daemon would write — and recognizes as "us". */
function localDaemonUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/**
 * Does the file's `daemonUrl` point at THIS daemon? Any loopback
 * hostname on our bound port counts — `oh connect` may have written
 * `localhost` where provisioning writes `127.0.0.1`.
 */
function pointsAtThisDaemon(daemonUrl: string, port: number): boolean {
  let parsed: URL;
  try {
    parsed = new URL(daemonUrl);
  } catch {
    return false;
  }
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1';
  return loopback && parsed.port === String(port);
}

export function createCliProvisionService(deps: CliProvisionDeps): CliProvisionService {
  const env = deps.env ?? process.env;
  const homedir = deps.homedir ?? os.homedir();
  const platform = deps.platform ?? process.platform;
  const hostname = deps.hostname ?? os.hostname();
  const now = deps.now ?? Date.now;
  const configPath = (): string => path.join(...cliConfigPathSegments(env, homedir, platform));

  /** ENOENT reads as an empty config; malformed content throws (refuse-and-report). */
  async function readConfig(filePath: string): Promise<CliConfig> {
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw err;
    }
    return parseCliConfig(raw, filePath);
  }

  async function status(): Promise<CliProvisionStatus> {
    const filePath = configPath();
    let config: CliConfig;
    try {
      config = await readConfig(filePath);
    } catch (err) {
      return { configPath: filePath, state: 'malformed', error: (err as Error).message };
    }
    const daemonUrl = config.daemonUrl !== undefined ? { daemonUrl: config.daemonUrl } : {};
    if (config.token === undefined || config.token === '') {
      return { configPath: filePath, state: 'unconfigured', ...daemonUrl };
    }
    const peeked = await peekDaemonAuthToken(config.token, now);
    if (peeked.ok) {
      return {
        configPath: filePath,
        state: 'configured',
        tokenId: peeked.tokenId,
        ...(peeked.label !== undefined ? { label: peeked.label } : {}),
        ...daemonUrl,
      };
    }
    // A token this ledger has never seen, stored next to a foreign
    // daemonUrl, is someone's working `oh connect` against another
    // daemon — not a broken local setup. Revoked/expired tokens were
    // ours regardless of the URL text: stale.
    const external =
      peeked.reason === 'unknown' &&
      config.daemonUrl !== undefined &&
      !pointsAtThisDaemon(config.daemonUrl, deps.getBoundPort());
    return { configPath: filePath, state: external ? 'external' : 'stale', ...daemonUrl };
  }

  async function provision(): Promise<CliProvisionResult> {
    const filePath = configPath();
    let existing: CliConfig;
    try {
      existing = await readConfig(filePath);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    const prior = await hostStorage.get(OH.cliProvision);
    // Mint-first: the file write can still fail, and the previous
    // credential must survive until the new one is on disk.
    const minted = await mintDaemonAuthToken({ label: `CLI — ${hostname}`, now });
    try {
      await mkdir(path.dirname(filePath), { recursive: true, mode: CLI_CONFIG_DIR_MODE });
      await writeFile(
        filePath,
        serializeCliConfig(mergeCliConnection(existing, localDaemonUrl(deps.getBoundPort()), minted.secret)),
        {
          mode: CLI_CONFIG_FILE_MODE,
        },
      );
    } catch (err) {
      // The file never got the secret — revoke the orphan mint so the
      // ledger doesn't keep a credential nothing holds.
      await revokeDaemonAuthToken(minted.record.id, now);
      return { ok: false, error: (err as Error).message };
    }
    await hostStorage.set(OH.cliProvision, { tokenId: minted.record.id, provisionedAt: now() });
    if (prior !== undefined && prior.tokenId !== minted.record.id) {
      // Rotate: the old CLI token dies only after the new secret is on
      // disk. Persist-before-evict, same as `tokens.revoke`.
      await revokeDaemonAuthToken(prior.tokenId, now);
      deps.closePeersByTokenId(prior.tokenId);
    }
    return { ok: true, configPath: filePath, tokenId: minted.record.id };
  }

  return { status, provision };
}
