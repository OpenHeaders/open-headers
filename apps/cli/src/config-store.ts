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
  return config;
}

export async function writeCliConfig(filePath: string, config: CliConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
