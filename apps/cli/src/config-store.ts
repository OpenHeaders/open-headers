/**
 * CLI config file — the persisted half of `oh connect`. One JSON file
 * in the platform config dir (`$XDG_CONFIG_HOME`/`~/.config` on
 * POSIX, `%APPDATA%` on Windows → `openheaders/cli.json`), mode 0600
 * because it holds a daemon token (a no-op on Windows, where the
 * profile dir's ACL is the protection). Flags and env always override
 * it (see connection.ts); it only makes the zero-flag invocation work
 * after a one-time connect. `XDG_CONFIG_HOME` wins on every platform —
 * the explicit-relocation escape hatch, and the test seam.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export interface CliConfig {
  daemonUrl?: string;
  token?: string;
  /** Anonymous usage counting (`TELEMETRY_PLAN.md` §2) — absent = on; the `OH_TELEMETRY` env var overrides. */
  telemetry?: boolean;
  /** Set once the first-run telemetry notice has been printed; the notice never repeats. */
  telemetryNoticeShown?: boolean;
  /** Random resettable install id (plan §4, amended 2026-07-16). Deleted when the channel is off. */
  telemetryInstallId?: string;
  /** ms since epoch the install id was minted; feeds the coarse sinceInstall bucket. */
  telemetryInstalledAt?: number;
  /** Once-ever `first_run` sent-bit; survives identity wipes so toggle cycles never inflate install counts. */
  telemetryFirstRunSent?: boolean;
}

export function cliConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = os.homedir(),
  platform: NodeJS.Platform = process.platform,
): string {
  const configHome =
    env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME !== ''
      ? env.XDG_CONFIG_HOME
      : platform === 'win32' && env.APPDATA && env.APPDATA !== ''
        ? env.APPDATA
        : path.join(homedir, '.config');
  return path.join(configHome, 'openheaders', 'cli.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A missing file is a valid empty config; a malformed one is an error the user must see. */
export async function readCliConfig(filePath: string): Promise<CliConfig> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`config file ${filePath} is not valid JSON — fix or delete it, then run oh connect again`);
  }
  if (!isRecord(parsed)) {
    throw new Error(`config file ${filePath} is not a JSON object — fix or delete it, then run oh connect again`);
  }
  const config: CliConfig = {};
  if (typeof parsed.daemonUrl === 'string') config.daemonUrl = parsed.daemonUrl;
  if (typeof parsed.token === 'string') config.token = parsed.token;
  if (typeof parsed.telemetry === 'boolean') config.telemetry = parsed.telemetry;
  if (typeof parsed.telemetryNoticeShown === 'boolean') config.telemetryNoticeShown = parsed.telemetryNoticeShown;
  if (typeof parsed.telemetryInstallId === 'string') config.telemetryInstallId = parsed.telemetryInstallId;
  if (typeof parsed.telemetryInstalledAt === 'number') config.telemetryInstalledAt = parsed.telemetryInstalledAt;
  if (typeof parsed.telemetryFirstRunSent === 'boolean') config.telemetryFirstRunSent = parsed.telemetryFirstRunSent;
  return config;
}

export async function writeCliConfig(filePath: string, config: CliConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
