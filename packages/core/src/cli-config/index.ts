/**
 * CLI config file — the shared shape + path law for
 * `openheaders/cli.json`, the persisted half of `oh connect`. The CLI
 * reads and writes it; the daemon host's CLI-provisioning RPC writes it
 * too. Both go through this module so they can never disagree on where
 * the file lives or what it holds.
 *
 * Platform-neutral by construction: callers pass `env` / `homedir` /
 * `platform` and join the returned segments themselves; parse and
 * serialize work on strings. File I/O (and the 0700/0600 modes below)
 * stays in the node hosts.
 */

/** Release line for version checks and the future `oh upgrade` (`DISTRIBUTION_PLAN.md` §4). */
export type UpdateChannel = 'stable' | 'beta';

export interface CliConfig {
  daemonUrl?: string;
  token?: string;
  /** Update channel — absent = `stable`; `oh channel` reads/writes it. */
  channel?: UpdateChannel;
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

/** The config dir is 0700 and the file 0600 — it holds a daemon token
 *  (a no-op on Windows, where the profile dir's ACL is the protection). */
export const CLI_CONFIG_DIR_MODE = 0o700;
export const CLI_CONFIG_FILE_MODE = 0o600;

/**
 * Path segments of the config file, base directory included — join with
 * the host's `path.join(...)`. `$XDG_CONFIG_HOME` wins on every
 * platform (the explicit-relocation escape hatch, and the test seam),
 * then `%APPDATA%` on Windows, then `~/.config`.
 */
export function cliConfigPathSegments(
  env: Readonly<Record<string, string | undefined>>,
  homedir: string,
  platform: string,
): readonly string[] {
  if (env.XDG_CONFIG_HOME !== undefined && env.XDG_CONFIG_HOME !== '') {
    return [env.XDG_CONFIG_HOME, 'openheaders', 'cli.json'];
  }
  if (platform === 'win32' && env.APPDATA !== undefined && env.APPDATA !== '') {
    return [env.APPDATA, 'openheaders', 'cli.json'];
  }
  return [homedir, '.config', 'openheaders', 'cli.json'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parse file content into a config. Malformed content is an error the
 * user must see (naming the path); unknown and mistyped keys are
 * dropped. A missing file is the caller's concern (read as `{}`).
 */
export function parseCliConfig(raw: string, filePath: string): CliConfig {
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
  if (parsed.channel === 'stable' || parsed.channel === 'beta') config.channel = parsed.channel;
  if (typeof parsed.telemetry === 'boolean') config.telemetry = parsed.telemetry;
  if (typeof parsed.telemetryNoticeShown === 'boolean') config.telemetryNoticeShown = parsed.telemetryNoticeShown;
  if (typeof parsed.telemetryInstallId === 'string') config.telemetryInstallId = parsed.telemetryInstallId;
  if (typeof parsed.telemetryInstalledAt === 'number') config.telemetryInstalledAt = parsed.telemetryInstalledAt;
  if (typeof parsed.telemetryFirstRunSent === 'boolean') config.telemetryFirstRunSent = parsed.telemetryFirstRunSent;
  return config;
}

export function serializeCliConfig(config: CliConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * The `oh connect` ownership law as a function: a connection write owns
 * ONLY the `{daemonUrl, token}` pair — every other key (telemetry,
 * channel) rides over from the existing file untouched.
 */
export function mergeCliConnection(existing: CliConfig, daemonUrl: string, token: string): CliConfig {
  return { ...existing, daemonUrl, token };
}
