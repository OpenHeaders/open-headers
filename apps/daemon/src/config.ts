/**
 * Daemon configuration — one `daemon.json` file plus env/argv overrides
 * (DAEMON_PLAN.md §6). Precedence, highest first: argv → env → config
 * file → defaults. Phase 1 carries the bind + data dir; TLS and log
 * level join in later phases.
 *
 * The data dir defaults to the platform state dir and holds everything
 * the daemon persists (`storage.json`, `oracle.db`, `blobs/`). The
 * config file defaults to `daemon.json` inside that dir, so a bare
 * `oh-daemon` run is fully self-contained; pointing `--config` elsewhere
 * suits packaged deployments (`/etc/openheaders/daemon.json`).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { WS_PORT } from '@openheaders/core/protocol';
import { validatePort } from '@openheaders/core/utils';

export type BindAddress = '127.0.0.1' | '0.0.0.0';

export interface DaemonConfig {
  /** Root of everything the daemon persists. Created if absent. */
  dataDir: string;
  /** `127.0.0.1` (loopback-only) or `0.0.0.0` (LAN). Same contract as the settings key. */
  bindAddress: BindAddress;
  bindPort: number;
  /** The `daemon.json` path that was consulted (whether or not it existed). */
  configPath: string;
}

/** The `daemon.json` shape — every field optional; absent = next source down. */
interface ConfigFile {
  dataDir?: string;
  bindAddress?: string;
  bindPort?: number;
}

export interface ResolveConfigInput {
  /** `process.argv.slice(2)`. */
  argv: readonly string[];
  /** `process.env`. */
  env: Record<string, string | undefined>;
  /** Platform + home overrides for tests; default to the real host. */
  platform?: NodeJS.Platform;
  homedir?: string;
}

/** Platform state dir — where a GUI-less service keeps its data. */
export function defaultDataDir(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  homedir: string,
): string {
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Application Support', 'openheaders-daemon');
  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA ?? path.join(homedir, 'AppData', 'Local'), 'openheaders-daemon');
  }
  return path.join(env.XDG_STATE_HOME ?? path.join(homedir, '.local', 'state'), 'openheaders-daemon');
}

function parseBindAddress(raw: string, source: string): BindAddress {
  if (raw === '127.0.0.1' || raw === '0.0.0.0') return raw;
  throw new Error(`${source}: bind address must be '127.0.0.1' (loopback) or '0.0.0.0' (LAN), got '${raw}'`);
}

function parseBindPort(raw: number, source: string): number {
  if (!Number.isInteger(raw) || validatePort(raw).level === 'reject') {
    throw new Error(`${source}: port ${raw} is not bindable (privileged or out of range)`);
  }
  return raw;
}

function readConfigFile(configPath: string): ConfigFile {
  let text: string;
  try {
    text = fs.readFileSync(configPath, 'utf8');
  } catch {
    return {}; // absent file = defaults; a malformed one below is an error
  }
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${configPath}: expected a JSON object`);
  }
  const record = parsed as Record<string, unknown>;
  const out: ConfigFile = {};
  if (record.dataDir !== undefined) {
    if (typeof record.dataDir !== 'string') throw new Error(`${configPath}: dataDir must be a string`);
    out.dataDir = record.dataDir;
  }
  if (record.bindAddress !== undefined) {
    if (typeof record.bindAddress !== 'string') throw new Error(`${configPath}: bindAddress must be a string`);
    out.bindAddress = record.bindAddress;
  }
  if (record.bindPort !== undefined) {
    if (typeof record.bindPort !== 'number') throw new Error(`${configPath}: bindPort must be a number`);
    out.bindPort = record.bindPort;
  }
  return out;
}

/**
 * Resolve the effective config from argv → env → `daemon.json` →
 * defaults. Throws with an actionable message on any invalid value —
 * the daemon refuses to boot on a config it would have to second-guess.
 */
export function resolveDaemonConfig(input: ResolveConfigInput): DaemonConfig {
  const platform = input.platform ?? process.platform;
  const homedir = input.homedir ?? os.homedir();
  const { values } = parseArgs({
    args: [...input.argv],
    options: {
      config: { type: 'string' },
      'data-dir': { type: 'string' },
      'bind-address': { type: 'string' },
      'bind-port': { type: 'string' },
    },
  });

  // The config file location itself resolves argv → env → default
  // (inside the default data dir), then the file's own `dataDir` may
  // move the data — but not the file.
  const fallbackDataDir = defaultDataDir(platform, input.env, homedir);
  const configPath = path.resolve(
    values.config ?? input.env.OH_DAEMON_CONFIG ?? path.join(fallbackDataDir, 'daemon.json'),
  );
  const file = readConfigFile(configPath);

  const dataDir = path.resolve(values['data-dir'] ?? input.env.OH_DAEMON_DATA_DIR ?? file.dataDir ?? fallbackDataDir);

  const rawAddress = values['bind-address'] ?? input.env.OH_DAEMON_BIND_ADDRESS ?? file.bindAddress;
  const bindAddress = rawAddress === undefined ? '127.0.0.1' : parseBindAddress(rawAddress, 'bind address');

  const argvPort = values['bind-port'] ?? input.env.OH_DAEMON_BIND_PORT;
  const rawPort = argvPort !== undefined ? Number(argvPort) : file.bindPort;
  const bindPort = rawPort === undefined ? WS_PORT : parseBindPort(rawPort, 'bind port');

  return { dataDir, bindAddress, bindPort, configPath };
}
