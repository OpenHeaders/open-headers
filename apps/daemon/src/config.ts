/**
 * Daemon configuration — one `daemon.json` file plus env/argv overrides
 * (the daemon plan §6). Precedence, highest first: argv → env → config
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
 *
 * `daemon.json` is also the durable truth `ohd install` writes: the
 * flags given at install persist here through
 * {@link updateDaemonConfigFile}, so every ohd command — status,
 * show-token, the daemon boot itself — resolves the same answer instead
 * of each reading a different source.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { WS_PORT } from '@openheaders/core/protocol';
import {
  MAX_SYSTEM_PROXY_BYPASS_LENGTH,
  MAX_SYSTEM_PROXY_VALUE_LENGTH,
  NODE_SYSTEM_PROXY_MODES,
} from '@openheaders/core/schemas';
import type { NodeSystemProxyMode, SystemProxySettings } from '@openheaders/core/types';
import { isValidLogLevel, type LogLevel, validatePort } from '@openheaders/core/utils';
import type {
  DaemonAuditForwardingConfig,
  DaemonOidcConfig,
  OidcClaimMappingRule,
  OidcClaimMappings,
} from '@openheaders/oracle-host-node/daemon';

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
   * Explicit acknowledgment that a `0.0.0.0` bind without a
   * TLS-terminating proxy serves everything — WS HELLO tokens, the
   * pairing secret page, `/mcp` and `/metrics` bearers — as cleartext
   * to the network. Without it (and without `trustedProxy`) a LAN bind
   * refuses to boot rather than exposing credentials by accident.
   */
  allowInsecureLan: boolean;
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
   * Vault cipher passphrase (enterprise Phase 6) — unlocks the
   * sensitive slots (vault/oauth) in `storage.json` through a
   * scrypt-derived AES-256-GCM key. `null` = no cipher configured; the
   * standing posture holds and sensitive slots refuse rather than
   * downgrade to plaintext. Secret material never lands in
   * `daemon.json`: env-only, `OH_DAEMON_VAULT_PASSPHRASE` or a file
   * named by `OH_DAEMON_VAULT_PASSPHRASE_FILE` (systemd
   * `LoadCredential=`, compose `secrets:`).
   */
  vaultPassphrase: string | null;
  /**
   * Audit-log retention window in days (the unified-oracle model §9.1).
   * One number for every entry regardless of actor type; default 90,
   * uncapped upward for compliance deployments.
   */
  auditRetentionDays: number;
  /**
   * License file location (the licensing plan §3.3). `null` = the
   * spine's default, `<dataDir>/license.key`; packaged deployments
   * point elsewhere (`OH_LICENSE_FILE`, systemd `LoadCredential=`,
   * compose `secrets:`). The file holds the pasteable `oh-license.`
   * artifact as plain text.
   */
  licenseFile: string | null;
  /**
   * Self-serve license renewal loop (the licensing plan §3.2). `false`
   * disables the refresh agent — the air-gapped/no-outbound posture by
   * config; `offline: true` licenses stand it down on their own either
   * way. Default true. `licenseRefresh` in `daemon.json` or
   * `OH_LICENSE_REFRESH=0`.
   */
  licenseRefresh: boolean;
  /**
   * Personal-seat redemption (procurement control): `false` refuses
   * user-held personal licenses at the seat gate, so org admins keep
   * seat growth on the procurement path. Default true. `personalSeats`
   * in `daemon.json` or `OH_PERSONAL_SEATS=0`.
   */
  personalSeats: boolean;
  /**
   * Audit→SIEM streaming destination (enterprise Phase 4d). `null` =
   * the daemon's zero-outbound posture holds; configured = audit rows
   * stream to this collector as JSON POST batches behind a durable
   * cursor. Configured via the `auditForwarding` object in
   * `daemon.json` — a deliberate outbound plane wants config-as-code,
   * not a runtime toggle.
   */
  auditForwarding: DaemonAuditForwardingConfig | null;
  /**
   * System-plane egress proxy — how THIS daemon's own sends reach
   * the network (the request-engine proxy design; distinct from
   * `trustedProxy`, the inbound reverse-proxy posture). `null` = no
   * explicit config; the stored per-device slot (or the tier default,
   * Env — honor HTTP_PROXY / HTTPS_PROXY / NO_PROXY with curl
   * precedence) applies. Configured via the `proxy` object in
   * `daemon.json`, `OH_DAEMON_PROXY_*`, or `--proxy-*` flags; an
   * explicit answer seeds the per-device slot at boot. PAC is not
   * available on this tier (no sandboxed evaluator) — it refuses with
   * a config error naming Env/Manual.
   */
  systemProxy: SystemProxySettings | null;
  /** The `daemon.json` path that was consulted (whether or not it existed). */
  configPath: string;
}

/** The `proxy` object in `daemon.json` — the daemon's own egress
 *  (system plane), not the inbound reverse-proxy posture. */
export interface ProxyConfigFile {
  mode?: string;
  url?: string;
  credentialRef?: string;
  bypassList?: string;
}

/** The `daemon.json` shape — every field optional; absent = next source down. */
interface ConfigFile {
  dataDir?: string;
  bindAddress?: string;
  bindPort?: number;
  logLevel?: string;
  trustedProxy?: boolean;
  allowedHosts?: string[];
  allowInsecureLan?: boolean;
  webRoot?: string;
  oidc?: DaemonOidcConfig;
  auditRetentionDays?: number;
  auditForwarding?: DaemonAuditForwardingConfig;
  licenseFile?: string;
  licenseRefresh?: boolean;
  personalSeats?: boolean;
  proxy?: ProxyConfigFile;
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

/**
 * Where `daemon.json` lives: explicit `--config` → `OH_DAEMON_CONFIG` →
 * the default data dir. The file's own `dataDir` may later move the
 * data — but never the file itself.
 */
export function resolveConfigPath(
  explicit: string | undefined,
  env: Record<string, string | undefined>,
  platform?: NodeJS.Platform,
  homedir?: string,
): string {
  const fallbackDataDir = defaultDataDir(platform ?? process.platform, env, homedir ?? os.homedir());
  return path.resolve(explicit ?? env.OH_DAEMON_CONFIG ?? path.join(fallbackDataDir, 'daemon.json'));
}

function parseBindAddress(raw: string, source: string): BindAddress {
  if (raw === '127.0.0.1' || raw === '0.0.0.0') return raw;
  throw new Error(`${source}: bind address must be '127.0.0.1' (loopback) or '0.0.0.0' (LAN), got '${raw}'`);
}

/**
 * The daemon has no native TLS: a network bind serves tokens, the
 * pairing secret page, and bearer-gated routes as cleartext HTTP/WS.
 * Refuse that combination unless the deployment terminates TLS in
 * front (`trustedProxy`) or explicitly accepts cleartext on a
 * trusted network (`allowInsecureLan`). Enforced both at resolution
 * (boot) and before {@link updateDaemonConfigFile} persists anything,
 * so a config that would refuse to boot never reaches disk.
 */
function assertSecureBindPosture(bindAddress: BindAddress, trustedProxy: boolean, allowInsecureLan: boolean): void {
  if (bindAddress === '0.0.0.0' && !trustedProxy && !allowInsecureLan) {
    throw new Error(
      'bind address 0.0.0.0 without TLS would expose auth tokens and pairing secrets as cleartext on the network — ' +
        'front the daemon with a TLS-terminating reverse proxy and set --trusted-proxy, ' +
        'or accept cleartext on a trusted network with --allow-insecure-lan',
    );
  }
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
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`${source}: ${field} must be a URL string`);
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`${source}: ${field} '${raw}' is not a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${source}: ${field} must be http(s), got '${parsed.protocol}'`);
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
    issuer: parseHttpUrl(record.issuer, source, 'oidc.issuer'),
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
    out.redirectOrigin = parseHttpUrl(record.redirectOrigin, source, 'oidc.redirectOrigin');
  }
  if (record.providerLabel !== undefined) {
    if (typeof record.providerLabel !== 'string') throw new Error(`${source}: oidc.providerLabel must be a string`);
    out.providerLabel = record.providerLabel;
  }
  if (record.claimMappings !== undefined) {
    out.claimMappings = parseClaimMappings(record.claimMappings, source);
  }
  return out;
}

function parseClaimMappings(raw: unknown, source: string): OidcClaimMappings {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: oidc.claimMappings must be a JSON object`);
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.claimPath !== 'string' || !record.claimPath.trim()) {
    throw new Error(`${source}: oidc.claimMappings.claimPath must be a non-empty string`);
  }
  if (!Array.isArray(record.rules) || record.rules.length === 0) {
    throw new Error(`${source}: oidc.claimMappings.rules must be a non-empty array`);
  }
  const rules = record.rules.map((entry, i): OidcClaimMappingRule => {
    const at = `oidc.claimMappings.rules[${i}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${source}: ${at} must be a JSON object`);
    }
    const rule = entry as Record<string, unknown>;
    if (typeof rule.value !== 'string' || !rule.value.trim()) {
      throw new Error(`${source}: ${at}.value must be a non-empty string`);
    }
    if (typeof rule.workspaceId !== 'string' || !rule.workspaceId.trim()) {
      throw new Error(`${source}: ${at}.workspaceId must be a non-empty string`);
    }
    const role = rule.role;
    if (role === 'owner' || role === 'editor' || role === 'viewer') {
      return { value: rule.value.trim(), workspaceId: rule.workspaceId.trim(), role };
    }
    throw new Error(`${source}: ${at}.role must be owner, editor or viewer`);
  });
  return { claimPath: record.claimPath.trim(), rules };
}

/**
 * The `auditForwarding` object — `url` is mandatory; everything else
 * refuses loudly on a wrong shape so a misconfigured collector never
 * boots into silently-dropped audit delivery.
 */
function parseAuditForwarding(raw: unknown, source: string): DaemonAuditForwardingConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: auditForwarding must be a JSON object`);
  }
  const record = raw as Record<string, unknown>;
  const out: DaemonAuditForwardingConfig = {
    url: parseHttpUrl(record.url, source, 'auditForwarding.url'),
  };
  if (record.headers !== undefined) {
    if (record.headers === null || typeof record.headers !== 'object' || Array.isArray(record.headers)) {
      throw new Error(`${source}: auditForwarding.headers must be a JSON object of string values`);
    }
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(record.headers)) {
      if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || typeof value !== 'string') {
        throw new Error(`${source}: auditForwarding.headers['${name}'] must map a valid header name to a string`);
      }
      headers[name] = value;
    }
    out.headers = headers;
  }
  if (record.batchSize !== undefined) {
    if (typeof record.batchSize !== 'number' || !Number.isInteger(record.batchSize) || record.batchSize <= 0) {
      throw new Error(`${source}: auditForwarding.batchSize must be a positive integer`);
    }
    out.batchSize = record.batchSize;
  }
  if (record.intervalMs !== undefined) {
    if (typeof record.intervalMs !== 'number' || !Number.isFinite(record.intervalMs) || record.intervalMs <= 0) {
      throw new Error(`${source}: auditForwarding.intervalMs must be a positive number`);
    }
    out.intervalMs = record.intervalMs;
  }
  return out;
}

/** The `proxy` object — string fields only; the combined answer is
 *  validated in {@link resolveSystemProxy} after env/argv overlay. */
function parseProxyConfigFile(raw: unknown, source: string): ProxyConfigFile {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: proxy must be a JSON object`);
  }
  const record = raw as Record<string, unknown>;
  const out: ProxyConfigFile = {};
  for (const field of ['mode', 'url', 'credentialRef', 'bypassList'] as const) {
    const value = record[field];
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new Error(`${source}: proxy.${field} must be a string`);
    out[field] = value;
  }
  return out;
}

/**
 * The egress system-proxy answer from argv → env → file, or `null`
 * when nothing is configured (the stored slot / tier default applies).
 * PAC and the desktop's system mode refuse with the honest error — this
 * tier has no sandboxed evaluator, and a silent direct would lie.
 */
function resolveSystemProxy(
  mode: string | undefined,
  url: string | undefined,
  credentialRef: string | undefined,
  bypassList: string | undefined,
): SystemProxySettings | null {
  if (mode === undefined && url === undefined && credentialRef === undefined && bypassList === undefined) return null;
  if (mode === undefined) {
    throw new Error(
      "proxy: a proxy URL/credential/bypass needs an explicit mode — set proxy mode 'manual' " +
        '(--proxy-mode, OH_DAEMON_PROXY_MODE, or proxy.mode in daemon.json)',
    );
  }
  if (mode === 'pac' || mode === 'system') {
    throw new Error(
      `proxy mode '${mode}' is not available on this tier — PAC and system resolution need the sandboxed ` +
        `Chromium resolver only the desktop app ships; use 'env' (HTTP_PROXY / HTTPS_PROXY / NO_PROXY) or 'manual'`,
    );
  }
  if (!(NODE_SYSTEM_PROXY_MODES as readonly string[]).includes(mode)) {
    throw new Error(`proxy mode must be one of off, env, manual — got '${mode}'`);
  }
  const nodeMode = mode as NodeSystemProxyMode;
  if (nodeMode !== 'manual') {
    if (url !== undefined) throw new Error(`proxy URL only applies to mode 'manual' (mode is '${nodeMode}')`);
    if (credentialRef !== undefined) {
      throw new Error(`proxy credential ref only applies to mode 'manual' (mode is '${nodeMode}')`);
    }
    if (bypassList !== undefined) {
      throw new Error(`proxy bypass list only applies to mode 'manual' (mode is '${nodeMode}')`);
    }
    return { version: 1, mode: nodeMode };
  }
  if (url === undefined || url.trim() === '') {
    throw new Error(
      "proxy mode 'manual' needs a proxy URL (--proxy-url, OH_DAEMON_PROXY_URL, or proxy.url in daemon.json)",
    );
  }
  if (url.length > MAX_SYSTEM_PROXY_VALUE_LENGTH) {
    throw new Error(`proxy URL exceeds ${MAX_SYSTEM_PROXY_VALUE_LENGTH} characters`);
  }
  if (credentialRef !== undefined && (credentialRef.trim() === '' || credentialRef.length > 256)) {
    throw new Error('proxy credential ref must be a non-empty vault entry name of at most 256 characters');
  }
  if (bypassList !== undefined && bypassList.length > MAX_SYSTEM_PROXY_BYPASS_LENGTH) {
    throw new Error(`proxy bypass list exceeds ${MAX_SYSTEM_PROXY_BYPASS_LENGTH} characters`);
  }
  return {
    version: 1,
    mode: nodeMode,
    manualProxyUrl: url.trim(),
    ...(credentialRef !== undefined ? { manualCredentialRef: credentialRef.trim() } : {}),
    ...(bypassList !== undefined ? { manualBypassList: bypassList } : {}),
  };
}

/**
 * The raw `daemon.json` record with every field kept, known or not —
 * the read half shared by resolution (which types it through
 * {@link parseConfigRecord}) and {@link updateDaemonConfigFile} (which
 * must write unknown fields back untouched).
 */
function readRawConfigRecord(configPath: string): Record<string, unknown> {
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
  return parsed as Record<string, unknown>;
}

function readConfigFile(configPath: string): ConfigFile {
  return parseConfigRecord(readRawConfigRecord(configPath), configPath);
}

function parseConfigRecord(record: Record<string, unknown>, configPath: string): ConfigFile {
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
  if (record.allowInsecureLan !== undefined) {
    if (typeof record.allowInsecureLan !== 'boolean') {
      throw new Error(`${configPath}: allowInsecureLan must be a boolean`);
    }
    out.allowInsecureLan = record.allowInsecureLan;
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
  if (record.auditForwarding !== undefined) {
    out.auditForwarding = parseAuditForwarding(record.auditForwarding, configPath);
  }
  if (record.licenseFile !== undefined) {
    if (typeof record.licenseFile !== 'string') throw new Error(`${configPath}: licenseFile must be a string`);
    out.licenseFile = record.licenseFile;
  }
  if (record.licenseRefresh !== undefined) {
    if (typeof record.licenseRefresh !== 'boolean') throw new Error(`${configPath}: licenseRefresh must be a boolean`);
    out.licenseRefresh = record.licenseRefresh;
  }
  if (record.personalSeats !== undefined) {
    if (typeof record.personalSeats !== 'boolean') throw new Error(`${configPath}: personalSeats must be a boolean`);
    out.personalSeats = record.personalSeats;
  }
  if (record.proxy !== undefined) {
    out.proxy = parseProxyConfigFile(record.proxy, configPath);
  }
  return out;
}

/**
 * The config-flag fields `ohd install` persists into `daemon.json` —
 * exactly the explicitly-given flags, raw as typed. Absent field =
 * leave the file's current value alone; the file's non-flag fields
 * (oidc, auditForwarding, …) are never touched.
 */
export interface ConfigFileUpdate {
  dataDir?: string;
  bindAddress?: string;
  bindPort?: number;
  logLevel?: string;
  trustedProxy?: boolean;
  allowedHosts?: string[];
  allowInsecureLan?: boolean;
  webRoot?: string;
  /** Replaces the whole `proxy` object — partial merges could strand a stale URL under a changed mode. */
  proxy?: ProxyConfigFile;
}

/**
 * The value checks a standalone `daemon.json` must pass to boot the
 * daemon with an empty argv/env — the exact posture of a service unit,
 * which carries only `--config`. Field parsers plus the cleartext-LAN
 * invariant; shape errors are {@link parseConfigRecord}'s job.
 */
function validateConfigFileValues(file: ConfigFile, source: string): void {
  const bindAddress = file.bindAddress === undefined ? '127.0.0.1' : parseBindAddress(file.bindAddress, source);
  if (file.bindPort !== undefined) parseBindPort(file.bindPort, source);
  if (file.logLevel !== undefined) parseLogLevel(file.logLevel, source);
  for (const host of file.allowedHosts ?? []) parseAllowedHost(host, source);
  assertSecureBindPosture(bindAddress, file.trustedProxy ?? false, file.allowInsecureLan ?? false);
  if (file.proxy !== undefined) {
    resolveSystemProxy(file.proxy.mode, file.proxy.url, file.proxy.credentialRef, file.proxy.bypassList);
  }
}

/**
 * Persist explicitly-given config flags into `daemon.json` — the write
 * half of the config chain, used by `ohd install`. Reads the current
 * file (unknown fields survive untouched), overlays the update, and
 * refuses invalid values or an insecure bind posture BEFORE writing, so
 * the file on disk always describes a bootable daemon. The write is a
 * same-directory rename, atomic on POSIX; the file is created 0600 (it
 * may carry an OIDC client secret) inside a 0700 dir.
 */
export function updateDaemonConfigFile(configPath: string, update: ConfigFileUpdate): void {
  const merged = { ...readRawConfigRecord(configPath) };
  if (update.dataDir !== undefined) merged.dataDir = path.resolve(update.dataDir);
  if (update.bindAddress !== undefined) merged.bindAddress = update.bindAddress;
  if (update.bindPort !== undefined) merged.bindPort = update.bindPort;
  if (update.logLevel !== undefined) merged.logLevel = update.logLevel;
  if (update.trustedProxy !== undefined) merged.trustedProxy = update.trustedProxy;
  if (update.allowedHosts !== undefined) {
    merged.allowedHosts = update.allowedHosts.map((host) => parseAllowedHost(host, 'allowed host'));
  }
  if (update.allowInsecureLan !== undefined) merged.allowInsecureLan = update.allowInsecureLan;
  if (update.webRoot !== undefined) merged.webRoot = path.resolve(update.webRoot);
  if (update.proxy !== undefined) merged.proxy = update.proxy;
  validateConfigFileValues(parseConfigRecord(merged, configPath), configPath);
  fs.mkdirSync(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const tmpPath = path.join(path.dirname(configPath), `.daemon.json.${process.pid}.tmp`);
  fs.writeFileSync(tmpPath, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmpPath, configPath);
}

/**
 * A passphrase from the environment — the value itself in `envVar`, or
 * a secret file named by `fileEnvVar` (trailing newlines stripped: both
 * `echo`-created files and compose/systemd-mounted secrets commonly end
 * in one). Exactly one source: both set is a misconfiguration, and so
 * is an empty passphrase — refuse loudly rather than deriving a key
 * from a value the operator never chose. Shared with the CLI's
 * `vault rotate`, which resolves the NEW passphrase pair through the
 * same rules.
 */
export function resolvePassphraseEnv(
  env: Record<string, string | undefined>,
  envVar: string,
  fileEnvVar: string,
): string | null {
  const direct = env[envVar];
  const filePath = env[fileEnvVar];
  if (direct !== undefined && filePath !== undefined) {
    throw new Error(`${envVar} and ${fileEnvVar} are both set — configure exactly one passphrase source`);
  }
  if (direct !== undefined) {
    if (direct.trim() === '') throw new Error(`${envVar} is set but empty`);
    return direct;
  }
  if (filePath === undefined) return null;
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`${fileEnvVar}: cannot read passphrase file '${filePath}'`);
  }
  const passphrase = raw.replace(/\r?\n+$/, '');
  if (passphrase.trim() === '') throw new Error(`${fileEnvVar}: passphrase file '${filePath}' is empty`);
  return passphrase;
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
      'allow-insecure-lan': { type: 'boolean' },
      'web-root': { type: 'string' },
      'license-file': { type: 'string' },
      'proxy-mode': { type: 'string' },
      'proxy-url': { type: 'string' },
      'proxy-credential-ref': { type: 'string' },
      'proxy-bypass': { type: 'string' },
    },
  });

  const fallbackDataDir = defaultDataDir(platform, input.env, homedir);
  const configPath = resolveConfigPath(values.config, input.env, platform, homedir);
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

  const envAllowInsecureLan = input.env.OH_DAEMON_ALLOW_INSECURE_LAN;
  const allowInsecureLan =
    values['allow-insecure-lan'] ??
    (envAllowInsecureLan !== undefined ? parseBooleanEnv(envAllowInsecureLan, 'allow insecure lan') : undefined) ??
    file.allowInsecureLan ??
    false;

  assertSecureBindPosture(bindAddress, trustedProxy, allowInsecureLan);

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

  const vaultPassphrase = resolvePassphraseEnv(
    input.env,
    'OH_DAEMON_VAULT_PASSPHRASE',
    'OH_DAEMON_VAULT_PASSPHRASE_FILE',
  );

  const envRetention = input.env.OH_DAEMON_AUDIT_RETENTION_DAYS;
  const rawRetention = envRetention !== undefined ? Number(envRetention) : file.auditRetentionDays;
  const auditRetentionDays =
    rawRetention === undefined
      ? AUDIT_RETENTION_DEFAULT_DAYS
      : parseAuditRetentionDays(rawRetention, 'audit retention days');

  const rawLicenseFile = values['license-file'] ?? input.env.OH_LICENSE_FILE ?? file.licenseFile;
  const licenseFile = rawLicenseFile === undefined ? null : path.resolve(rawLicenseFile);

  const envLicenseRefresh = input.env.OH_LICENSE_REFRESH;
  const licenseRefresh =
    (envLicenseRefresh !== undefined ? parseBooleanEnv(envLicenseRefresh, 'license refresh') : undefined) ??
    file.licenseRefresh ??
    true;

  const envPersonalSeats = input.env.OH_PERSONAL_SEATS;
  const personalSeats =
    (envPersonalSeats !== undefined ? parseBooleanEnv(envPersonalSeats, 'personal seats') : undefined) ??
    file.personalSeats ??
    true;

  const systemProxy = resolveSystemProxy(
    values['proxy-mode'] ?? input.env.OH_DAEMON_PROXY_MODE ?? file.proxy?.mode,
    values['proxy-url'] ?? input.env.OH_DAEMON_PROXY_URL ?? file.proxy?.url,
    values['proxy-credential-ref'] ?? input.env.OH_DAEMON_PROXY_CREDENTIAL_REF ?? file.proxy?.credentialRef,
    values['proxy-bypass'] ?? input.env.OH_DAEMON_PROXY_BYPASS ?? file.proxy?.bypassList,
  );

  return {
    dataDir,
    bindAddress,
    bindPort,
    logLevel,
    trustedProxy,
    allowedHosts,
    allowInsecureLan,
    webRoot,
    oidc,
    vaultPassphrase,
    auditRetentionDays,
    auditForwarding: file.auditForwarding ?? null,
    licenseFile,
    licenseRefresh,
    personalSeats,
    systemProxy,
    configPath,
  };
}
