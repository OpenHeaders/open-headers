#!/usr/bin/env node
/**
 * Generated-reference emitter (the docs Reference tab): reads the
 * flagship CLI/daemon sources as text and writes the MDX pages under
 * docs-site/reference/. Structure (commands, flags, fields, env vars,
 * constants) is parsed from source; the short public-facing
 * descriptions for config fields and settings keys are curated HERE and
 * census-gated — when the source grows or drops an entry this script
 * throws, so a committed page can never silently drift from what ships.
 *
 * Run from anywhere: node docs-site/scripts/generate-reference.mjs
 * CI regenerates and diffs; a dirty diff fails the gate.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = path.join(ROOT, 'docs-site', 'reference');

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const daemonCli = read('apps/daemon/src/cli.ts');
const daemonConfig = read('apps/daemon/src/config.ts');
const daemonSettings = read('apps/daemon/src/cli/config-settings.ts');
const daemonFlags = read('apps/daemon/src/cli/config-flags.ts');
const daemonPassword = read('apps/daemon/src/cli/password-input.ts');
const daemonVault = read('apps/daemon/src/cli/vault.ts');
const ohCli = read('apps/cli/src/cli.ts');
const ohRead = read('apps/cli/src/read-commands.ts');
const ohWrite = read('apps/cli/src/write-commands.ts');
const ohExec = read('apps/cli/src/exec-commands.ts');
const ohRun = read('apps/cli/src/run-commands.ts');
const ohConnection = read('apps/cli/src/connection.ts');
const coreProtocol = read('packages/core/src/protocol/constants.ts');
const coreLicensing = read('packages/core/src/licensing/entitlements.ts');

const fail = (message) => {
  throw new Error(`generate-reference: ${message}`);
};

// ---------------------------------------------------------------- helpers

/** The template literal assigned right after `marker`, backticks stripped. */
function extractTemplate(src, marker, file) {
  const at = src.indexOf(marker);
  if (at === -1) fail(`cannot find ${marker} in ${file}`);
  const open = src.indexOf('`', at);
  const close = src.indexOf('`;', open + 1);
  if (open === -1 || close === -1) fail(`cannot bound the template after ${marker} in ${file}`);
  return src.slice(open + 1, close);
}

/** A single-quoted const value: extractConst(src, 'USER_PASSWORD_ENV'). */
function extractConst(src, name, file) {
  const m = new RegExp(`${name}\\s*=\\s*'([^']+)'`).exec(src);
  if (!m) fail(`cannot find const ${name} in ${file}`);
  return m[1];
}

/** A numeric const value: extractNumberConst(src, 'export const WS_PORT'). */
function extractNumberConst(src, name, file) {
  const m = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(src);
  if (!m) fail(`cannot find numeric const ${name} in ${file}`);
  return Number(m[1]);
}

/** Split usage text into sections keyed by their non-indented header lines. */
function splitSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    if (line.trim() !== '' && !line.startsWith(' ')) {
      current = line.trim();
      sections.set(current, []);
    } else if (current !== null) {
      sections.get(current).push(line);
    }
  }
  return sections;
}

/**
 * Parse a usage block of `  name  description` entries with wrapped
 * continuation lines. The description column is detected from the
 * continuation indent; a name that overflows the column keeps its
 * description entirely on the continuation lines.
 */
function parseEntries(lines, blockName) {
  const continuation = lines.find((l) => /^\s{10,}\S/.test(l) && !/^\s{2}\S/.test(l));
  const descCol = continuation ? continuation.length - continuation.trimStart().length : null;
  const entries = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (/^ {2}\S/.test(line)) {
      let name;
      let desc;
      if (descCol !== null && line.length > descCol && line[descCol - 1] === ' ' && line[descCol] !== ' ') {
        name = line.slice(2, descCol).trim();
        desc = line.slice(descCol).trim();
        if (name === '') {
          // Continuation indented exactly to a shallow column; treat as wrap.
          entries[entries.length - 1].desc += ` ${line.trim()}`;
          continue;
        }
      } else {
        const m = /^ {2}(\S.*?)(?:\s{2,}(\S.*))?$/.exec(line);
        name = m[1].trim();
        desc = (m[2] ?? '').trim();
      }
      entries.push({ name, desc });
    } else {
      if (entries.length === 0) fail(`continuation before first entry in ${blockName}`);
      entries[entries.length - 1].desc += ` ${line.trim()}`;
    }
  }
  if (entries.length === 0) fail(`no entries parsed from ${blockName}`);
  return entries.map((e) => ({ name: e.name, desc: e.desc.replace(/\s+/g, ' ').trim() }));
}

/** Top-level object literals of an array literal, by brace depth. */
function splitObjectLiterals(src, arrayMarker, file) {
  const at = src.indexOf(arrayMarker);
  if (at === -1) fail(`cannot find ${arrayMarker} in ${file}`);
  const open = src.indexOf('[', at + arrayMarker.length);
  let depth = 0;
  let objStart = -1;
  let objDepth = 0;
  const out = [];
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    } else if (ch === '{') {
      if (objStart === -1 && depth === 1) {
        objStart = i;
        objDepth = 0;
      }
      objDepth++;
    } else if (ch === '}') {
      objDepth--;
      if (objStart !== -1 && objDepth === 0) {
        out.push(src.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }
  if (out.length === 0) fail(`no object literals under ${arrayMarker} in ${file}`);
  return out;
}

function extractField(obj, field) {
  const m = new RegExp(`${field}:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`).exec(obj);
  return m ? m[2] : undefined;
}

/**
 * Escape a value for an MDX table cell: code-span angle/brace tokens
 * and flag names (smart typography would render a bare `--flag` as an
 * em-dash), escape pipes.
 */
function cell(text) {
  const spanned = text
    .replace(/\{\{[^}]*\}\}/g, (m) => `\`${m}\``)
    .replace(/<[^>\s][^<>]*>/g, (m) => (text.includes(`\`${m}`) ? m : `\`${m}\``))
    .replace(/(^|[\s(])(--[a-zA-Z][\w-]*)/g, '$1`$2`');
  return spanned.replace(/\|/g, '\\|');
}

const code = (text) => `\`${text.replace(/\|/g, '\\|')}\``;

function table(headers, rows) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

const BANNER =
  '{/* GENERATED by docs-site/scripts/generate-reference.mjs — do not edit by hand.\n' +
  '    Regenerate with: node docs-site/scripts/generate-reference.mjs */}';

// ---------------------------------------------------------------- constants

const WS_PORT = extractNumberConst(coreProtocol, 'export const WS_PORT', 'protocol/constants.ts');
const FREE_SEAT_LIMIT = extractNumberConst(coreLicensing, 'export const FREE_SEAT_LIMIT', 'entitlements.ts');
const AUDIT_RETENTION_DEFAULT_DAYS = extractNumberConst(
  daemonConfig,
  'export const AUDIT_RETENTION_DEFAULT_DAYS',
  'config.ts',
);

const USER_PASSWORD_ENV = extractConst(daemonPassword, 'export const USER_PASSWORD_ENV', 'password-input.ts');
const USER_PASSWORD_FILE_ENV = extractConst(daemonPassword, 'export const USER_PASSWORD_FILE_ENV', 'password-input.ts');
const DAEMON_URL_ENV = extractConst(ohConnection, 'export const DAEMON_URL_ENV', 'connection.ts');
const TOKEN_ENV = extractConst(ohConnection, 'export const TOKEN_ENV', 'connection.ts');
const DEFAULT_DAEMON_URL = `http://127.0.0.1:${WS_PORT}`;

const settingKeysMatch = /DAEMON_SETTING_KEYS = \[([^\]]+)\]/.exec(daemonSettings);
if (!settingKeysMatch) fail('cannot parse DAEMON_SETTING_KEYS from config-settings.ts');
const SETTING_KEYS = [...settingKeysMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (SETTING_KEYS.length === 0) fail('DAEMON_SETTING_KEYS parsed empty');

// ------------------------------------------------------------ ohd usage

const ohdUsage = extractTemplate(daemonCli, 'const USAGE =', 'daemon/cli.ts')
  .replace(/ v\$\{cliVersion\}/g, '') // docs are evergreen — no version pin
  .replace(/\$\{DAEMON_SETTING_KEYS\.join\(', '\)\}/g, SETTING_KEYS.join(', '))
  .replace(/\$\{USER_PASSWORD_ENV\}/g, USER_PASSWORD_ENV)
  .replace(/\$\{USER_PASSWORD_FILE_ENV\}/g, USER_PASSWORD_FILE_ENV);
if (ohdUsage.includes('${')) fail(`unsubstituted interpolation left in ohd usage: ${/\$\{[^}]*\}/.exec(ohdUsage)[0]}`);

const ohdSections = splitSections(ohdUsage);
const findSection = (sections, prefix) => {
  for (const [header, lines] of sections) if (header.startsWith(prefix)) return { header, lines };
  fail(`usage section starting with '${prefix}' not found`);
};

const ohdCommands = parseEntries(findSection(ohdSections, 'Commands:').lines, 'ohd Commands');
const ohdOptions = parseEntries(findSection(ohdSections, 'Options (install').lines, 'ohd Options');
const ohdAuditOptions = parseEntries(findSection(ohdSections, 'Options (audit').lines, 'ohd audit Options');

// Census: every install/config flag defined in code appears in the usage options.
const flagNames = [...daemonFlags.matchAll(/^ {2}'?([a-z][a-z-]*)'?: \{ type: /gm)].map((m) => m[1]);
if (flagNames.length === 0) fail('no flags parsed from config-flags.ts');
for (const flag of flagNames) {
  if (!ohdOptions.some((o) => o.name.startsWith(`--${flag}`))) {
    fail(`flag --${flag} (config-flags.ts) is missing from the ohd usage options — update cli.ts USAGE`);
  }
}

// ------------------------------------------------------------ oh usage

const ohUsage = extractTemplate(ohCli, 'return `oh v', 'cli/cli.ts')
  .replace(/\$\{DEFAULT_DAEMON_URL\}/g, DEFAULT_DAEMON_URL)
  .replace(/\$\{DAEMON_URL_ENV\}/g, DAEMON_URL_ENV)
  .replace(/\$\{TOKEN_ENV\}/g, TOKEN_ENV);

const ohLines = ohUsage.split('\n');
const cmdHeaderAt = ohLines.findIndex((l) => l.trim() === 'Commands:');
const firstInterp = ohLines.findIndex((l) => l.trim().startsWith('${'));
if (cmdHeaderAt === -1 || firstInterp === -1 || firstInterp < cmdHeaderAt) fail('oh usage Commands block not found');
const ohBuiltins = parseEntries(ohLines.slice(cmdHeaderAt + 1, firstInterp), 'oh built-ins');

const optHeaderAt = ohLines.findIndex((l) => l.trim() === 'Options:');
if (optHeaderAt === -1) fail('oh usage Options block not found');
const exitLineAt = ohLines.findIndex((l) => l.startsWith('Exit codes:'));
if (exitLineAt === -1) fail('oh usage exit-codes line not found');
const ohOptions = parseEntries(ohLines.slice(optHeaderAt + 1, exitLineAt), 'oh Options');
const ohExitCodes = ohLines[exitLineAt]
  .replace('Exit codes:', '')
  .split('·')
  .map((part) => {
    const m = /^\s*(\d)\s+(.*)$/.exec(part);
    if (!m) fail(`unparseable exit-code fragment '${part}'`);
    return { code: m[1], meaning: m[2].trim() };
  });
if (ohExitCodes.length !== 5) fail(`expected 5 exit codes, parsed ${ohExitCodes.length}`);

function parseSpecTable(src, marker, file) {
  return splitObjectLiterals(src, marker, file).map((obj) => {
    const group = extractField(obj, 'group');
    const verb = extractField(obj, 'verb');
    const summary = extractField(obj, 'summary');
    if (group === undefined || verb === undefined || summary === undefined) {
      fail(`object under ${marker} is missing group/verb/summary`);
    }
    const argsHelp = extractField(obj, 'argsHelp');
    const positional = /positional:\s*\{\s*name:\s*'([^']+)'[^}]*required:\s*(true|false)/.exec(obj);
    const limitOption = /limitOption:\s*true/.test(obj);
    return { group, verb, summary, argsHelp, positional, limitOption };
  });
}

const readSpecs = parseSpecTable(ohRead, 'READ_COMMANDS: readonly ReadCommandSpec[] =', 'read-commands.ts');
const writeSpecs = parseSpecTable(ohWrite, 'WRITE_COMMANDS: readonly CommandSpec[] =', 'write-commands.ts');
const execSpecs = parseSpecTable(ohExec, 'EXEC_COMMANDS: readonly CommandSpec[] =', 'exec-commands.ts');

// run-commands builds its rows from RUN_KINDS + a summary ternary; mirror it.
const runKindsMatch = /RUN_KINDS = \[([^\]]+)\]/.exec(ohRun);
if (!runKindsMatch) fail('cannot parse RUN_KINDS from run-commands.ts');
const runKinds = [...runKindsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const runSummaryMatch = /verb === 'workflow'\s*\?\s*'([^']+)'\s*:\s*`([^`]+)`/.exec(ohRun);
if (!runSummaryMatch) fail('cannot parse the run-command summary ternary from run-commands.ts');
const runArgsHelp = /argsHelp:\s*'([^']+)'/.exec(ohRun)?.[1];
if (runArgsHelp === undefined) fail('cannot parse argsHelp from run-commands.ts');
const runSpecs = runKinds.map((verb) => ({
  group: 'run',
  verb,
  summary: verb === 'workflow' ? runSummaryMatch[1] : runSummaryMatch[2].replace('${verb}', verb),
  argsHelp: runArgsHelp,
}));

const readName = (spec) => {
  const positional = spec.positional ? (spec.positional[2] === 'true' ? ` <${spec.positional[1]}>` : ` [${spec.positional[1]}]`) : '';
  return `oh ${spec.group}${spec.verb ? ` ${spec.verb}` : ''}${positional}`;
};
const specName = (spec) => `oh ${spec.group} ${spec.verb} ${spec.argsHelp}`;

// -------------------------------------------------- daemon.json reference

// Fields as the config-file parser accepts them.
const configFileMatch = /interface ConfigFile \{([^}]+)\}/.exec(daemonConfig);
if (!configFileMatch) fail('cannot parse interface ConfigFile from config.ts');
const CONFIG_FIELDS = [...configFileMatch[1].matchAll(/^\s*(\w+)\?:/gm)].map((m) => m[1]);
if (CONFIG_FIELDS.length === 0) fail('interface ConfigFile parsed empty');

const nestedFields = (fnName) => {
  const at = daemonConfig.indexOf(`function ${fnName}`);
  if (at === -1) fail(`cannot find function ${fnName} in config.ts`);
  const end = daemonConfig.indexOf('\nfunction ', at + 1);
  const body = daemonConfig.slice(at, end === -1 ? undefined : end);
  return [...new Set([...body.matchAll(/record\.(\w+)/g)].map((m) => m[1]))];
};
const OIDC_FIELDS = nestedFields('parseOidcConfig');
const AUDIT_FWD_FIELDS = nestedFields('parseAuditForwarding');
const proxyFieldsMatch = /for \(const field of \[([^\]]+)\] as const\)/.exec(daemonConfig);
if (!proxyFieldsMatch) fail('cannot parse the proxy field list from config.ts');
const PROXY_FIELDS = [...proxyFieldsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Every OH_* env var the daemon side reads.
const DAEMON_ENV_VARS = new Set();
for (const src of [daemonConfig, daemonCli, daemonPassword, daemonVault]) {
  // Wildcard hits are prose mentions in comments (OH_DAEMON_PROXY_*) — skip them.
  for (const m of src.matchAll(/\bOH_[A-Z0-9_]+\*?/g)) {
    if (!m[0].endsWith('*') && !m[0].endsWith('_')) DAEMON_ENV_VARS.add(m[0]);
  }
}

// Curated field rows — census-gated against CONFIG_FIELDS below.
// Env/flag cells are final markdown; the census below still verifies the
// env-var names against what the daemon actually reads.
const FIELD_ROWS = {
  dataDir: ['string', 'platform state dir', '`OH_DAEMON_DATA_DIR`', '`--data-dir`', 'Root of everything the daemon persists (`storage.json`, `oracle.db`, `blobs/`, `logs/`). Created if absent.'],
  bindAddress: ['string', `\`127.0.0.1\``, '`OH_DAEMON_BIND_ADDRESS`', '`--bind-address`', '`127.0.0.1` (loopback-only) or `0.0.0.0` (LAN). A LAN bind must also declare a protection posture — see the [LAN vs TLS decision](/server/lan-vs-tls).'],
  bindPort: ['number', `\`${WS_PORT}\``, '`OH_DAEMON_BIND_PORT`', '`--bind-port`', 'The sync/HTTP port. Unprivileged ports only (1024–65535).'],
  logLevel: ['string', '`info`', '`OH_DAEMON_LOG_LEVEL`', '`--log-level`', 'Minimum level the daemon logger emits: `error`, `warn`, `info`, or `debug`.'],
  trustedProxy: ['boolean', '`false`', '`OH_DAEMON_TRUSTED_PROXY`', '`--trusted-proxy`', 'A trusted reverse proxy fronts the daemon: peer identity for auth logs and rate limits comes from `X-Forwarded-For`. Never enable without a proxy — clients could spoof the header.'],
  allowedHosts: ['string[]', '`[]`', '`OH_DAEMON_ALLOWED_HOSTS` (comma-separated)', '`--allowed-host` (repeatable)', 'Hostnames the daemon answers as, beyond the always-allowed IP literals, `localhost`, and `*.local` — e.g. the reverse proxy\'s domain. Bare hostnames only. Anything else on browser-facing routes is refused (DNS-rebinding guard).'],
  allowInsecureLan: ['boolean', '`false`', '`OH_DAEMON_ALLOW_INSECURE_LAN`', '`--allow-insecure-lan`', 'Explicit acknowledgment that a `0.0.0.0` bind without a TLS proxy serves tokens and pairing secrets as cleartext. Without it (and without `trustedProxy`) a LAN bind refuses to boot.'],
  webRoot: ['string', 'the `web/` dir beside the daemon', '`OH_DAEMON_WEB_ROOT`', '`--web-root`', 'Directory holding the built web app the daemon serves at `/`. Headless-only when neither is present.'],
  oidc: ['object', 'not set (SSO off)', '`OH_DAEMON_OIDC_CLIENT_SECRET` (secret only)', '—', 'OpenID Connect login provider — see the fields below and [Users, seats & SSO](/server/users-sso). The client secret can ride the environment variable so it stays out of the file.'],
  auditRetentionDays: ['number', `\`${AUDIT_RETENTION_DEFAULT_DAYS}\``, '`OH_DAEMON_AUDIT_RETENTION_DAYS`', '—', 'Audit-log retention window in days. One number for every entry; uncapped upward for compliance deployments.'],
  auditForwarding: ['object', 'not set (no outbound)', '—', '—', 'Audit→SIEM streaming destination — audit rows POST to this collector as JSON batches behind a durable cursor. See the fields below and [Observability](/server/observability).'],
  licenseFile: ['string', '`<dataDir>/license.key`', '`OH_LICENSE_FILE`', '—', 'License key file location. The file holds the pasteable `oh-license.` artifact as plain text.'],
  licenseRefresh: ['boolean', '`true`', '`OH_LICENSE_REFRESH`', '—', 'Self-serve license renewal loop. `false` disables the refresh agent — the air-gapped/no-outbound posture; offline licenses stand it down on their own either way.'],
  personalSeats: ['boolean', '`true`', '`OH_PERSONAL_SEATS`', '—', 'Personal-seat redemption. `false` refuses user-held individual seat keys at the seat gate, keeping seat growth on the procurement path.'],
  proxy: ['object', 'not set (env mode applies)', '`OH_DAEMON_PROXY_*` (see below)', '`--proxy-*` (see the ohd options)', 'How the daemon\'s **own outbound requests** reach the network (distinct from `trustedProxy`, the inbound posture). See the fields below.'],
};
for (const field of CONFIG_FIELDS) {
  if (!(field in FIELD_ROWS)) fail(`daemon.json field '${field}' has no curated row — add it to FIELD_ROWS`);
}
for (const [field, row] of Object.entries(FIELD_ROWS)) {
  if (!CONFIG_FIELDS.includes(field)) fail(`curated row '${field}' no longer exists in interface ConfigFile — remove it`);
  for (const m of row[2].matchAll(/OH_[A-Z0-9_]+\*?/g)) {
    if (!m[0].endsWith('*') && !DAEMON_ENV_VARS.has(m[0])) {
      fail(`field '${field}' names env var ${m[0]} which the daemon does not read`);
    }
  }
}

const OIDC_ROWS = {
  issuer: ['string (required)', 'The provider\'s issuer URL (http(s), no trailing slash).'],
  clientId: ['string (required)', 'The OAuth client id registered with the provider.'],
  clientSecret: ['string', 'The client secret; prefer `OH_DAEMON_OIDC_CLIENT_SECRET` to keep it out of the file.'],
  scopes: ['string[]', 'Extra scopes to request beyond the defaults.'],
  autoProvision: ['boolean', 'Create a directory user on first successful SSO login.'],
  sessionTtlDays: ['number', 'Web session lifetime in days.'],
  redirectOrigin: ['string', 'Origin the provider redirects back to, when it differs from the request origin (e.g. behind a proxy).'],
  providerLabel: ['string', 'Label shown on the login button.'],
  claimMappings: ['object', 'Map an ID-token claim to workspace grants: `claimPath` plus `rules` of `{ value, workspaceId, role }` (role: `owner`, `editor`, or `viewer`).'],
};
const AUDIT_FWD_ROWS = {
  url: ['string (required)', 'The collector endpoint audit batches POST to.'],
  headers: ['object', 'Extra headers on every batch (e.g. an auth bearer).'],
  batchSize: ['number', 'Rows per POST.'],
  intervalMs: ['number', 'Flush interval in milliseconds.'],
};
const PROXY_ROWS = {
  mode: ['string', '`env` (default — honor `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`, curl precedence), `manual`, or `off`. PAC and system resolution are not available on this tier.'],
  url: ['string', 'Manual mode: the proxy to traverse (`host:port` implies `http://`).'],
  credentialRef: ['string', 'Manual mode: vault entry name holding `user:password` for the proxy — never the value itself.'],
  bypassList: ['string', 'Manual mode: `NO_PROXY`-syntax bypass list (host suffixes, `host:port`, IPv4 CIDR, `*`).'],
};
const censusNested = (parsed, curated, label) => {
  for (const f of parsed) if (!(f in curated)) fail(`${label} field '${f}' has no curated row`);
  for (const f of Object.keys(curated)) if (!parsed.includes(f)) fail(`${label} curated row '${f}' no longer exists`);
};
censusNested(OIDC_FIELDS, OIDC_ROWS, 'oidc');
censusNested(AUDIT_FWD_FIELDS, AUDIT_FWD_ROWS, 'auditForwarding');
censusNested(PROXY_FIELDS, PROXY_ROWS, 'proxy');

// Curated env-var rows — census-gated against every OH_* the daemon reads.
const ENV_ROWS = {
  OH_DAEMON_CONFIG: 'Path to `daemon.json` (same role as `--config`).',
  OH_DAEMON_DATA_DIR: 'Data directory override.',
  OH_DAEMON_BIND_ADDRESS: 'Bind address override.',
  OH_DAEMON_BIND_PORT: 'Bind port override.',
  OH_DAEMON_LOG_LEVEL: 'Log level override.',
  OH_DAEMON_TRUSTED_PROXY: '`1`/`0` — reverse-proxy posture override.',
  OH_DAEMON_ALLOWED_HOSTS: 'Comma-separated allowed hostnames.',
  OH_DAEMON_ALLOW_INSECURE_LAN: '`1`/`0` — cleartext-LAN acknowledgment override.',
  OH_DAEMON_WEB_ROOT: 'Web bundle directory override.',
  OH_DAEMON_OIDC_CLIENT_SECRET: 'OIDC client secret, layered onto the file\'s `oidc` block (refused without one).',
  OH_DAEMON_VAULT_PASSPHRASE: 'Vault cipher passphrase (value directly).',
  OH_DAEMON_VAULT_PASSPHRASE_FILE: 'Vault cipher passphrase from a secret file (systemd `LoadCredential=`, compose `secrets:`). Exactly one of the pair.',
  OH_DAEMON_VAULT_NEW_PASSPHRASE: '`ohd vault rotate` only: the passphrase being rotated to.',
  OH_DAEMON_VAULT_NEW_PASSPHRASE_FILE: '`ohd vault rotate` only: same, from a secret file.',
  OH_DAEMON_AUDIT_RETENTION_DAYS: 'Audit retention override.',
  OH_LICENSE_FILE: 'License key file location.',
  OH_LICENSE_REFRESH: '`1`/`0` — license renewal loop.',
  OH_PERSONAL_SEATS: '`1`/`0` — personal-seat redemption.',
  OH_DAEMON_PROXY_MODE: 'Egress proxy mode (`off`, `env`, `manual`).',
  OH_DAEMON_PROXY_URL: 'Egress proxy URL (manual mode).',
  OH_DAEMON_PROXY_CREDENTIAL_REF: 'Vault entry for the egress proxy credential (manual mode).',
  OH_DAEMON_PROXY_BYPASS: 'Egress proxy bypass list (manual mode).',
  OH_DAEMON_TOKEN: 'Paired token for `ohd status --verbose` (the token-gated `/metrics` route).',
  OH_DAEMON_USER_PASSWORD: '`ohd user set-password` non-interactive input (value directly).',
  OH_DAEMON_USER_PASSWORD_FILE: 'Same, from a secret file. Exactly one of the pair.',
};
for (const envVar of DAEMON_ENV_VARS) {
  if (!(envVar in ENV_ROWS)) fail(`env var ${envVar} read by the daemon has no curated row — add it to ENV_ROWS`);
}
for (const envVar of Object.keys(ENV_ROWS)) {
  if (!DAEMON_ENV_VARS.has(envVar)) fail(`curated env var ${envVar} is no longer read by the daemon — remove it`);
}

// Curated settings-key rows — census-gated against DAEMON_SETTING_KEYS.
const SETTING_ROWS = {
  'mcp.enabled': 'Serve the MCP surface at `/mcp` (everything below requires it).',
  'mcp.allowObserve': 'MCP read tools: list workspaces, rules, requests, variables, activity.',
  'mcp.allowWrite': 'MCP write tools: toggle rules, switch environments, set variables.',
  'mcp.allowExecute': 'MCP execute tools: send requests, run workflows (real network egress).',
  'mcp.allowSecrets': 'Let MCP tools read secret variable values instead of masked names.',
  'updates.autoUpdate': 'Unattended `ohd upgrade` when a newer release ships.',
};
censusNested(SETTING_KEYS, SETTING_ROWS, 'settings');

// ---------------------------------------------------------------- pages

const ohdPage = `---
title: "ohd command reference"
description: "Every ohd command, option, and settings key — generated from the daemon source."
---

${BANNER}

\`ohd\` is the Open Headers Server control binary: it writes the service
unit, drives the service manager, and runs the offline admin verbs
against the daemon's data directory. Configuration persists in
\`daemon.json\` — see the [configuration reference](/reference/daemon-json).
The client command line is [\`oh\`](/reference/oh).

## Commands

${table(['Command', 'What it does'], ohdCommands.map((c) => [code(`ohd ${c.name}`), c.desc === '' ? '—' : cell(c.desc)]))}

## Settings keys

\`ohd config set <key> <true|false>\` — booleans, default off. Bind and
network options are not settings; they persist through \`ohd install\`
flags instead.

${table(['Key', 'What it enables'], SETTING_KEYS.map((k) => [code(k), SETTING_ROWS[k]]))}

## Options

Accepted by \`install\`, \`status\`, \`show-token\`, and \`config\` (the
config flags are shared by every command that reads the data dir).

${table(['Option', 'What it does'], ohdOptions.map((o) => [code(o.name), cell(o.desc)]))}

## Audit filter options

Accepted by \`audit list\` and \`audit export\`.

${table(['Option', 'What it does'], ohdAuditOptions.map((o) => [code(o.name), cell(o.desc)]))}

## See also

- [Environment variables](/reference/daemon-json#environment-variables) — every \`OH_*\` variable the daemon side reads.
- [Install & service lifecycle](/server/install) — the commands in context.
- [Troubleshooting](/server/troubleshooting) — the error messages, verbatim.
`;

const ohPage = `---
title: "oh command reference"
description: "Every oh command, option, and exit code — generated from the CLI source."
---

${BANNER}

\`oh\` is the Open Headers command line: headless scripting and CI
integration against the same daemon the extension and desktop app use.
Every workspace-scoped command takes \`--workspace <id>\` and defaults to
the daemon's active workspace. The server-side control binary is
[\`ohd\`](/reference/ohd).

## Built-in commands

${table(['Command', 'What it does'], ohBuiltins.map((c) => [code(`oh ${c.name}`), cell(c.desc)]))}

## Read commands

${table(['Command', 'What it does'], readSpecs.map((s) => [code(readName(s)), cell(s.summary)]))}

## Write commands

${table(['Command', 'What it does'], writeSpecs.map((s) => [code(specName(s)), cell(s.summary)]))}

## Execute commands

Sends and runs are real network egress, gated behind the daemon's
\`mcp.allowExecute\` opt-in.

${table(['Command', 'What it does'], execSpecs.map((s) => [code(specName(s)), cell(s.summary)]))}

## CI runner

${table(['Command', 'What it does'], runSpecs.map((s) => [code(specName(s)), cell(s.summary)]))}

## Options

${table(['Option', 'What it does'], ohOptions.map((o) => [code(o.name), cell(o.desc)]))}

## Exit codes

${table(['Code', 'Meaning'], ohExitCodes.map((e) => [code(e.code), cell(e.meaning)]))}

## Environment

${table(['Variable', 'What it does'], [
  [code(DAEMON_URL_ENV), `Daemon URL (default \`${DEFAULT_DAEMON_URL}\`; \`oh connect\` persists one).`],
  [code(TOKEN_ENV), 'Paired daemon token.'],
])}
`;

const daemonJsonPage = `---
title: "daemon.json reference"
description: "Every configuration field and environment variable the Open Headers Server reads — generated from source."
---

${BANNER}

One \`daemon.json\` file configures the daemon and every \`ohd\` command.
Precedence, highest first: **command-line flags → environment variables
→ \`daemon.json\` → defaults**. \`ohd install <flags>\` persists the given
flags into the file (an omitted flag keeps its current value), and
\`ohd restart\` applies the result — see
[Install & service lifecycle](/server/install).

The file lives at \`--config\` → \`OH_DAEMON_CONFIG\` → \`daemon.json\`
inside the default data dir:

| Platform | Default data dir |
| --- | --- |
| macOS | \`~/Library/Application Support/openheaders-daemon\` |
| Linux | \`$XDG_STATE_HOME/openheaders-daemon\` (fallback \`~/.local/state/openheaders-daemon\`) |
| Windows | \`%LOCALAPPDATA%\\openheaders-daemon\` |

An invalid value refuses to boot with an actionable message rather than
being second-guessed; the exact messages are quoted in
[Troubleshooting](/server/troubleshooting).

## Fields

${table(['Field', 'Type', 'Default', 'What it does'], CONFIG_FIELDS.map((f) => {
  const [type, def, , , desc] = FIELD_ROWS[f];
  return [code(f), type, def, desc];
}))}

### Flag and environment overrides

Each field's command-line flag (persisted by \`ohd install\`) and
environment variable, where one exists.

${table(['Field', 'Install flag', 'Env override'], CONFIG_FIELDS.filter((f) => {
  const [, , env, flag] = FIELD_ROWS[f];
  return env !== '—' || flag !== '—';
}).map((f) => {
  const [, , env, flag] = FIELD_ROWS[f];
  return [code(f), flag, env];
}))}

### The \`oidc\` object

${table(['Field', 'Type', 'What it does'], OIDC_FIELDS.map((f) => [code(`oidc.${f}`), OIDC_ROWS[f][0], OIDC_ROWS[f][1]]))}

### The \`auditForwarding\` object

${table(['Field', 'Type', 'What it does'], AUDIT_FWD_FIELDS.map((f) => [code(`auditForwarding.${f}`), AUDIT_FWD_ROWS[f][0], AUDIT_FWD_ROWS[f][1]]))}

### The \`proxy\` object

${table(['Field', 'Type', 'What it does'], PROXY_FIELDS.map((f) => [code(`proxy.${f}`), PROXY_ROWS[f][0], PROXY_ROWS[f][1]]))}

## Environment variables

Every \`OH_*\` variable the daemon side reads. Secret material is
env-only by design — passphrases and passwords never ride flags or the
config file.

${table(['Variable', 'What it does'], Object.keys(ENV_ROWS).map((v) => [code(v), ENV_ROWS[v]]))}

## Constants

| Constant | Value |
| --- | --- |
| Default port | \`${WS_PORT}\` |
| Free-tier seat limit | ${FREE_SEAT_LIMIT} active users |
| Audit retention default | ${AUDIT_RETENTION_DEFAULT_DAYS} days |
`;

writeFileSync(path.join(OUT_DIR, 'ohd.mdx'), ohdPage);
writeFileSync(path.join(OUT_DIR, 'oh.mdx'), ohPage);
writeFileSync(path.join(OUT_DIR, 'daemon-json.mdx'), daemonJsonPage);
console.log(
  `generated reference/ohd.mdx (${ohdCommands.length} commands), ` +
    `reference/oh.mdx (${ohBuiltins.length + readSpecs.length + writeSpecs.length + execSpecs.length + runSpecs.length} commands), ` +
    `reference/daemon-json.mdx (${CONFIG_FIELDS.length} fields, ${Object.keys(ENV_ROWS).length} env vars)`,
);
