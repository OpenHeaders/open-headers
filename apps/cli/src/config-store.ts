/**
 * CLI config file — the persisted half of `oh connect`. The path law,
 * shape, and parse/serialize live in `@openheaders/core/cli-config`
 * (shared with the daemon host's CLI-provisioning RPC, so the two
 * writers can never disagree); this module is the CLI's fs glue: read
 * (missing file = empty config), write with dir 0700 / file 0600.
 * Flags and env always override the file (see connection.ts); it only
 * makes the zero-flag invocation work after a one-time connect.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLI_CONFIG_DIR_MODE,
  CLI_CONFIG_FILE_MODE,
  type CliConfig,
  cliConfigPathSegments,
  parseCliConfig,
  serializeCliConfig,
} from '@openheaders/core/cli-config';

export type { CliConfig, UpdateChannel } from '@openheaders/core/cli-config';

export function cliConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = os.homedir(),
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(...cliConfigPathSegments(env, homedir, platform));
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
  return parseCliConfig(raw, filePath);
}

export async function writeCliConfig(filePath: string, config: CliConfig): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: CLI_CONFIG_DIR_MODE });
  await writeFile(filePath, serializeCliConfig(config), { mode: CLI_CONFIG_FILE_MODE });
}
