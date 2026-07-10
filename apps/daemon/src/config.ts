/**
 * Daemon configuration — one `daemon.json` file plus env/argv overrides
 * (DAEMON_PLAN.md §6). Precedence, highest first: argv → env → config
 * file → defaults. Carries the bind, data dir, log level, the Phase-3
 * reverse-proxy posture (`trustedProxy`, `allowedHosts`), and the
 * Phase-4a web bundle root (`webRoot`); native TLS certs stay optional
 * and later.
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
import { isValidLogLevel, type LogLevel, validatePort } from '@openheaders/core/utils';
import type { DaemonOidcConfig } from '@openheaders/oracle-host-node/daemon';

/**
 * §9.1 default retention. Redeclared here rather than imported from the
 * spine: a value import of `@openheaders/oracle-host-node/daemon` would
 * pull better-sqlite3 into the sqlite-free `cli.js` bundle via this
 * shared config module.
 */
export const AUDIT_RETENTION_DEFAULT_DAYS = 90;

export type BindAddress = '127.0.0.1' | '0.0.0.0';

export interface DaemonConfig {
  /** Root of everything the daemon persists. Created if absent. */
  dataDir: string;
  /** `127.0.0.1` (loopback-only) or `0.0.0.0` (LAN). Same contract as the settings key. */
  bindAddress: BindAddress;
  bindPort: number;
  /** Minimum level the daemon logger emits. */
  logLevel: LogLevel;
  /**
   * A trusted reverse proxy fronts this daemon (Phase 3 TLS posture) —
   * peer identity for auth logs and brute-force limits comes from the
   * last `X-Forwarded-For` entry instead of the socket address. Never
   * enable without a proxy: clients could spoof the header.
   */
  trustedProxy: boolean;
  /**
   * Hostnames the daemon may be addressed as, beyond the always-allowed
   * IP literals / `localhost` / `*.local` — e.g. the reverse proxy's
   * domain. Anything else on the browser-facing routes is refused
   * (DNS-rebinding guard).
   */
  allowedHosts: string[];
  /**
   * Directory holding the built Workbench web bundle the daemon serves
   * on its bind (Phase 4a). `null` = not explicitly configured; the
   * entry point then falls back to the `web/` dir shipped beside the
   * daemon bundle, or serves nothing when that is absent too.
   */
  webRoot: string | null;
  /**
   * OIDC/SSO login provider (Phase 5 team tier). `null` = SSO off; the
   * token/pairing login paths work either way. Configured via the
   * `oidc` object in `daemon.json`; the client secret may instead ride
   * `OH_DAEMON_OIDC_CLIENT_SECRET` so deployments can keep it out of
   * the config file.
   */
  oidc: DaemonOidcConfig | null;
  /**
   * Audit-log retention window in days (UNIFIED_ORACLE_MODEL.md §9.1).
   * One number for every entry regardless of actor type; default 90,
   * uncapped upward for compliance deployments.
   */
  auditRetentionDays: number;
  /** The `daemon.json` path that was consulted (whether or not it existed). */
  configPath: string;
}

/** The `daemon.json` shape — every field optional; absent = next source down. */
interface ConfigFile {
  dataDir?: string;
  bindAddress?: string;
  bindPort?: number;
  logLevel?: string;
  trustedProxy?: boolean;
  allowedHosts?: string[];
  webRoot?: string;
  oidc?: DaemonOidcConfig;
  auditRetentionDays?: number;
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

function parseLogLevel(raw: string, source: string): LogLevel {
  if (isValidLogLevel(raw)) return raw;
  throw new Error(`${source}: log level must be one of error, warn, info, debug — got '${raw}'`);
}

function parseBooleanEnv(raw: string, source: string): boolean {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  throw new Error(`${source}: expected 1/0/true/false, got '${raw}'`);
}

/**
 * One allowed host = a bare hostname — no scheme, port, path, or
 * wildcard. Refuse anything URL-shaped so `https://oh.example.com`
 * pasted into the config fails loudly instead of never matching.
 */
function parseAllowedHost(raw: string, source: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || /[/:@#?*\s]/.test(trimmed)) {
    throw new Error(`${source}: allowed host must be a bare hostname (e.g. oh.example.com), got '${raw}'`);
  }
  return trimmed;
}

function parseHttpUrl(raw: unknown, source: string, field: string): string {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`${source}: oidc.${field} must be a URL string`);
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`${source}: oidc.${field} '${raw}' is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${source}: oidc.${field} must be http(s), got '${parsed.protocol}'`);
  }
  return raw.trim().replace(/\/$/, '');
}

/**
 * The `oidc` object — issuer + clientId are mandatory; everything else
 * refuses loudly on a wrong shape so a misconfigured SSO block never
 * boots into a silently broken login.
 */
function parseOidcConfig(raw: unknown, source: string): DaemonOidcConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: oidc must be a JSON object`);
  }
  const record = raw as Record<string, unknown>;
  const out: DaemonOidcConfig = {
    issuer: parseHttpUrl(record.issuer, source, 'issuer'),
    clientId: '',
  };
  if (typeof record.clientId !== 'string' || !record.clientId.trim()) {
    throw new Error(`${source}: oidc.clientId must be a non-empty string`);
  }
  out.clientId = record.clientId.trim();
  if (record.clientSecret !== undefined) {
    if (typeof record.clientSecret !== 'string') throw new Error(`${source}: oidc.clientSecret must be a string`);
    out.clientSecret = record.clientSecret;
  }
  if (record.scopes !== undefined) {
    if (!Array.isArray(record.scopes) || record.scopes.some((s) => typeof s !== 'string')) {
      throw new Error(`${source}: oidc.scopes must be an array of strings`);
    }
    out.scopes = record.scopes.filter((s): s is string => typeof s === 'string');
  }
  if (record.autoProvision !== undefined) {
    if (typeof record.autoProvision !== 'boolean') throw new Error(`${source}: oidc.autoProvision must be a boolean`);
    out.autoProvision = record.autoProvision;
  }
  if (record.sessionTtlDays !== undefined) {
    if (
      typeof record.sessionTtlDays !== 'number' ||
      !Number.isFinite(record.sessionTtlDays) ||
      record.sessionTtlDays <= 0
    ) {
      throw new Error(`${source}: oidc.sessionTtlDays must be a positive number`);
    }
    out.sessionTtlDays = record.sessionTtlDays;
  }
  if (record.redirectOrigin !== undefined) {
    out.redirectOrigin = parseHttpUrl(record.redirectOrigin, source, 'redirectOrigin');
  }
  if (record.providerLabel !== undefined) {
    if (typeof record.providerLabel !== 'string') throw new Error(`${source}: oidc.providerLabel must be a string`);
    out.providerLabel = record.providerLabel;
  }
  return out;
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
  if (record.logLevel !== undefined) {
    if (typeof record.logLevel !== 'string') throw new Error(`${configPath}: logLevel must be a string`);
    out.logLevel = record.logLevel;
  }
  if (record.trustedProxy !== undefined) {
    if (typeof record.trustedProxy !== 'boolean') throw new Error(`${configPath}: trustedProxy must be a boolean`);
    out.trustedProxy = record.trustedProxy;
  }
  if (record.allowedHosts !== undefined) {
    if (!Array.isArray(record.allowedHosts) || record.allowedHosts.some((h) => typeof h !== 'string')) {
      throw new Error(`${configPath}: allowedHosts must be an array of strings`);
    }
    out.allowedHosts = record.allowedHosts.filter((h): h is string => typeof h === 'string');
  }
  if (record.webRoot !== undefined) {
    if (typeof record.webRoot !== 'string') throw new Error(`${configPath}: webRoot must be a string`);
    out.webRoot = record.webRoot;
  }
  if (record.oidc !== undefined) {
    out.oidc = parseOidcConfig(record.oidc, configPath);
  }
  if (record.auditRetentionDays !== undefined) {
    if (typeof record.auditRetentionDays !== 'number') {
      throw new Error(`${configPath}: auditRetentionDays must be a number`);
    }
    out.auditRetentionDays = record.auditRetentionDays;
  }
  return out;
}

function parseAuditRetentionDays(raw: number, source: string): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`${source}: audit retention days must be a positive number, got '${raw}'`);
  }
  return raw;
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
      'log-level': { type: 'string' },
      'trusted-proxy': { type: 'boolean' },
      'allowed-host': { type: 'string', multiple: true },
      'web-root': { type: 'string' },
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

  const rawLevel = values['log-level'] ?? input.env.OH_DAEMON_LOG_LEVEL ?? file.logLevel;
  const logLevel = rawLevel === undefined ? 'info' : parseLogLevel(rawLevel, 'log level');

  const envTrustedProxy = input.env.OH_DAEMON_TRUSTED_PROXY;
  const trustedProxy =
    values['trusted-proxy'] ??
    (envTrustedProxy !== undefined ? parseBooleanEnv(envTrustedProxy, 'trusted proxy') : undefined) ??
    file.trustedProxy ??
    false;

  const envAllowedHosts = input.env.OH_DAEMON_ALLOWED_HOSTS;
  const rawAllowedHosts =
    values['allowed-host'] ??
    (envAllowedHosts !== undefined ? envAllowedHosts.split(',').filter((h) => h.trim() !== '') : undefined) ??
    file.allowedHosts ??
    [];
  const allowedHosts = rawAllowedHosts.map((h) => parseAllowedHost(h, 'allowed host'));

  const rawWebRoot = values['web-root'] ?? input.env.OH_DAEMON_WEB_ROOT ?? file.webRoot;
  const webRoot = rawWebRoot === undefined ? null : path.resolve(rawWebRoot);

  // The secret env override rides ON TOP of the file's oidc block —
  // deployments keep issuer/clientId in daemon.json and the secret in
  // the service unit's environment. The env var without an oidc block
  // is refused: half a provider config is a misconfiguration.
  const envClientSecret = input.env.OH_DAEMON_OIDC_CLIENT_SECRET;
  let oidc: DaemonOidcConfig | null = file.oidc ?? null;
  if (envClientSecret !== undefined) {
    if (!oidc) {
      throw new Error('OH_DAEMON_OIDC_CLIENT_SECRET is set but daemon.json has no oidc block');
    }
    oidc = { ...oidc, clientSecret: envClientSecret };
  }

  const envRetention = input.env.OH_DAEMON_AUDIT_RETENTION_DAYS;
  const rawRetention = envRetention !== undefined ? Number(envRetention) : file.auditRetentionDays;
  const auditRetentionDays =
    rawRetention === undefined
      ? AUDIT_RETENTION_DEFAULT_DAYS
      : parseAuditRetentionDays(rawRetention, 'audit retention days');

  return {
    dataDir,
    bindAddress,
    bindPort,
    logLevel,
    trustedProxy,
    allowedHosts,
    webRoot,
    oidc,
    auditRetentionDays,
    configPath,
  };
}
