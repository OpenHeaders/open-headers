/**
 * `oh` — the Open Headers command line. This distribution carries the
 * daemon lifecycle group (DAEMON_PLAN.md §6): `oh daemon install /
 * start / stop / status / show-token`. The top-level command space
 * stays open for the client CLI (`CLI_PLAN.md` — `oh` as a client of
 * the `/mcp` surface); the daemon group is namespaced from day one so
 * the two merge without a rename.
 *
 * Deliberately sqlite-free: the engine lives behind `dist/main.js`;
 * this binary only writes unit files, drives the service manager,
 * probes `/healthz`, and runs the offline first-boot token mint. It
 * must load instantly on any Node, including hosts where the native
 * module failed to build.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { isSea } from 'node:sea';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { formatBuildStamp, getBuildInfo, resolveAppVersion } from './build-info';
import { CONFIG_OPTIONS, parseConfigCommand, resolveConfigFlags } from './cli/config-flags';
import {
  DAEMON_SETTING_KEYS,
  parseDaemonSettingKey,
  parseDaemonSettingValue,
  readDaemonSettings,
  setDaemonSetting,
} from './cli/config-settings';
import { assertDaemonStopped, offlineWriteConsequence } from './cli/daemon-stopped';
import { probeHealthz } from './cli/healthz-probe';
import {
  formatLicenseSnapshot,
  licenseInstall,
  licenseRemove,
  licenseStatus,
  resolveLicenseFilePath,
} from './cli/license';
import { fetchMetrics, formatMetrics } from './cli/metrics-probe';
import { resolvePasswordInput, USER_PASSWORD_ENV, USER_PASSWORD_FILE_ENV } from './cli/password-input';
import { installServiceUnit, type ServiceHost, startService, stopService } from './cli/service-manager';
import { mintBootstrapToken } from './cli/show-token';
import {
  addUser,
  deactivateUser,
  grantUserRole,
  isWorkspaceRole,
  listUserGrants,
  listUsers,
  resolveTokenUserBinding,
  revokeUserGrant,
  setUserPassword,
} from './cli/users';
import { commandVault } from './cli/vault';
import type { DaemonConfig } from './config';

const cliVersion: string = resolveAppVersion();

const USAGE = `oh v${cliVersion} — Open Headers command line

Usage: oh daemon <command> [options]

Commands:
  install       Write the user service unit (launchd/systemd) for the daemon
  start         Start the installed service
  stop          Stop the installed service
  run           Run the daemon in the foreground (what the service unit
                execs; Ctrl-C / SIGTERM shuts it down cleanly)
  status        Probe the daemon's /healthz; --verbose reads /metrics
                (peers, throughput, audit counts — needs a paired token
                via --token or OH_DAEMON_TOKEN)
  show-token    Mint a client auth token against the daemon's data dir
                (first-boot bootstrap; requires the daemon to be stopped)
  config set <key> <true|false>
                Set a daemon setting offline (requires the daemon to be stopped)
  config get <key>
  config list   Read daemon settings
  user add <name> [--email <address>]
                Admit a user to the daemon's directory (requires the daemon
                to be stopped; the daemon must have booted once)
  user list     Read the user directory (grants included)
  user deactivate <id-or-email>
                Deactivate a user + revoke their tokens (daemon stopped)
  user grant <id-or-email> <workspaceId> <owner|editor|viewer>
                Grant a workspace role (daemon stopped; editors write,
                viewers read, no grant = no access)
  user revoke-grant <id-or-email> <workspaceId>
                Drop a user's grant on one workspace (daemon stopped)
  user set-password <id-or-email> [--clear]
                Set a user's password for the local password login
                (daemon stopped; echo-off prompt on a terminal, or
                ${USER_PASSWORD_ENV} / ${USER_PASSWORD_FILE_ENV}
                for scripts — never a flag); --clear removes it
  license status
                Show the installed license (licensee, seats, expiry, grace)
  license install <file>
                Verify + install a license key file; a running daemon
                picks it up live — no restart
  license remove
                Remove the installed license (revert to the free tier;
                existing users and data are unaffected)
  vault rotate  Re-encrypt the vault under a new passphrase (daemon
                stopped; current passphrase from OH_DAEMON_VAULT_PASSPHRASE
                or OH_DAEMON_VAULT_PASSPHRASE_FILE, new one from
                OH_DAEMON_VAULT_NEW_PASSPHRASE or
                OH_DAEMON_VAULT_NEW_PASSPHRASE_FILE — env/file only,
                never a flag)
  audit list    Read the audit log, newest first (works while the daemon
                runs; default --limit 50)
  audit export  Emit matching audit rows as JSONL, oldest first
  backup [dest] Snapshot the data dir's state (storage.json, oracle.db,
                blobs/) into a fresh directory with a checksummed
                manifest (daemon stopped; dest defaults to
                ./openheaders-daemon-backup-<timestamp>)
  restore <dir> Verify a backup's checksums and replace the data dir's
                state with it (daemon stopped; refuses over existing
                state without --force)

Settable keys (booleans, default off):
  ${DAEMON_SETTING_KEYS.join(', ')}

Options (install / status / show-token / config):
  --config <path>          daemon.json location
  --data-dir <path>        Data directory (storage.json, oracle.db, blobs/)
  --bind-address <addr>    127.0.0.1 (loopback) or 0.0.0.0 (LAN)
  --bind-port <port>       Sync/HTTP port (default 8137)
  --log-level <level>      error | warn | info | debug (default info)
  --trusted-proxy          A reverse proxy fronts the daemon; take the peer
                           address from X-Forwarded-For (never set without one)
  --allowed-host <name>    Hostname the daemon answers as (repeatable) — e.g.
                           the reverse proxy's domain; IPs/localhost always work
  --allow-insecure-lan     Accept serving cleartext HTTP/WS on 0.0.0.0 without
                           a TLS proxy (tokens ride unencrypted; trusted LANs only)
  --web-root <path>        Directory with the built web app to serve at /
                           (default: the web/ dir shipped beside the daemon)
  --verbose                status only: read the token-gated /metrics route
  --token <secret>         status only: paired token for /metrics (or set
                           the OH_DAEMON_TOKEN environment variable)
  --label <text>           show-token only: label for the minted token
  --user <id-or-email>     show-token only: bind the token to a directory user
                           (omit for a token that acts as the daemon operator)
  --email <address>        user add only: contact identity for the new user
  --clear                  user set-password only: remove the password
  --force                  restore only: replace existing state files in the
                           data dir

Options (audit list / export):
  --actor <id-or-email>    Only rows for one directory user
  --capability <name>      e.g. workspace.write, daemon.admin
  --decision <allow|deny>  Only allows or only denies
  --workspace <id>         Only rows scoped to one workspace
  --since <when>           ISO date/time or relative (30m, 24h, 7d)
  --until <when>           Upper bound, same forms (exclusive)
  --limit <n>              Row cap (list defaults to 50; export unbounded)
`;

function serviceHost(): ServiceHost {
  return { platform: process.platform, homedir: os.homedir(), uid: process.getuid?.() ?? 0 };
}

/**
 * The unit's exec line. The plain-Node distribution execs the daemon
 * entry beside this bundle; the SEA binary has no separate entry file
 * — the executable IS the daemon, entered through `oh daemon run`.
 */
function daemonExecCommand(): string[] {
  if (isSea()) return [process.execPath, 'daemon', 'run'];
  return [process.execPath, path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js')];
}

async function commandInstall(argv: readonly string[]): Promise<void> {
  const { config, unitArgs } = parseConfigCommand(argv);
  const command = daemonExecCommand();
  const { unitPath, notes } = await installServiceUnit(serviceHost(), {
    command,
    args: unitArgs,
    logFile: path.join(config.dataDir, 'logs', 'daemon.log'),
  });
  console.log(`Installed ${unitPath}`);
  console.log(`  exec: ${command.join(' ')}${unitArgs.length ? ` ${unitArgs.join(' ')}` : ''}`);
  console.log(`  bind: ${config.bindAddress}:${config.bindPort}, data dir: ${config.dataDir}`);
  for (const note of notes) {
    console.log(`  ${note}`);
  }
  console.log('');
  console.log('Next: mint the first client token, then start the service:');
  console.log('  oh daemon show-token');
  console.log('  oh daemon start');
}

async function commandStatus(argv: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    options: { ...CONFIG_OPTIONS, verbose: { type: 'boolean' }, token: { type: 'string' } },
  });
  const { config } = resolveConfigFlags(values);
  const up = await probeHealthz(config.bindPort);
  if (!up) {
    console.log(`not running — no /healthz on 127.0.0.1:${config.bindPort}`);
    process.exitCode = 1;
    return;
  }
  console.log(`running — /healthz OK on 127.0.0.1:${config.bindPort} (configured bind ${config.bindAddress})`);
  if (values.verbose !== true) return;
  const token = values.token ?? process.env.OH_DAEMON_TOKEN;
  if (token === undefined || token === '') {
    throw new Error('--verbose reads the token-gated /metrics route — pass --token or set OH_DAEMON_TOKEN');
  }
  const metrics = await fetchMetrics(config.bindPort, token);
  for (const metricsLine of formatMetrics(metrics)) {
    console.log(`  ${metricsLine}`);
  }
}

/**
 * `storage.json` is single-writer — the running daemon holds the whole
 * envelope in memory and its next flush would clobber an offline write
 * invisibly. Every offline-mutation command guards through here.
 */
async function assertOfflineWrite(config: DaemonConfig, wouldBeLost: string, instead: string): Promise<void> {
  await assertDaemonStopped(config, offlineWriteConsequence(wouldBeLost, instead));
}

async function commandShowToken(argv: readonly string[]): Promise<void> {
  const { values } = parseArgs({
    args: [...argv],
    options: { ...CONFIG_OPTIONS, label: { type: 'string' }, user: { type: 'string' } },
  });
  const { config } = resolveConfigFlags(values);
  const label = values.label;
  await assertOfflineWrite(config, 'a mint', 'mint');
  const boundUser = values.user !== undefined ? await resolveTokenUserBinding(config, values.user) : undefined;
  const minted = await mintBootstrapToken(config, label, boundUser?.user.id);
  const bindingNote = boundUser ? `, user "${boundUser.user.displayName}"` : '';
  console.log(`Token minted (id ${minted.tokenId}${label ? `, label "${label}"` : ''}${bindingNote}).`);
  console.log('');
  console.log(`  ${minted.secret}`);
  console.log('');
  console.log('This secret is shown once — the daemon stores only its hash.');
  console.log('Add a backend in a client (Settings → Backends) with the token and one of:');
  for (const join of minted.joinUrls) {
    console.log(`  ${join.url}${join.iface ? `   (${join.iface})` : ''}`);
  }
  if (config.bindAddress !== '0.0.0.0') {
    console.log('The daemon is loopback-only; set bind-address 0.0.0.0 to make it LAN-reachable');
    console.log('(behind a TLS proxy with --trusted-proxy, or cleartext with --allow-insecure-lan).');
  }
}

function formatSettingValue(value: boolean | undefined): string {
  return value === undefined ? 'false (default)' : String(value);
}

async function commandConfig(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { values, positionals } = parseArgs({ args: [...rest], options: CONFIG_OPTIONS, allowPositionals: true });
  const { config } = resolveConfigFlags(values);
  if (sub === 'set') {
    const [rawKey, rawValue] = positionals;
    if (rawKey === undefined || rawValue === undefined) {
      throw new Error('usage: oh daemon config set <key> <true|false>');
    }
    const key = parseDaemonSettingKey(rawKey);
    const value = parseDaemonSettingValue(key, rawValue);
    await assertOfflineWrite(config, 'a setting written', 'change settings');
    await setDaemonSetting(config, key, value);
    console.log(`${key} = ${value}`);
    console.log('Applies when the daemon starts (oh daemon start).');
    return;
  }
  if (sub === 'get') {
    const [rawKey] = positionals;
    if (rawKey === undefined) throw new Error('usage: oh daemon config get <key>');
    const key = parseDaemonSettingKey(rawKey);
    const settings = await readDaemonSettings(config);
    console.log(`${key} = ${formatSettingValue(settings[key])}`);
    return;
  }
  if (sub === 'list') {
    const settings = await readDaemonSettings(config);
    for (const key of DAEMON_SETTING_KEYS) {
      console.log(`${key} = ${formatSettingValue(settings[key])}`);
    }
    return;
  }
  throw new Error('usage: oh daemon config <set|get|list>');
}

function formatUserLine(record: {
  user: { id: string; displayName: string };
  userIdentity: { kind: string; value: string | null };
  deactivatedAt: number | null;
}): string {
  const email = record.userIdentity.kind === 'email' ? record.userIdentity.value : null;
  const state = record.deactivatedAt !== null ? '  [deactivated]' : '';
  return `${record.user.id}  ${record.user.displayName}${email ? `  <${email}>` : ''}${state}`;
}

async function commandUser(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { values, positionals } = parseArgs({
    args: [...rest],
    options: { ...CONFIG_OPTIONS, email: { type: 'string' }, clear: { type: 'boolean' } },
    allowPositionals: true,
  });
  const { config } = resolveConfigFlags(values);
  if (sub === 'add') {
    const [displayName] = positionals;
    if (displayName === undefined) throw new Error('usage: oh daemon user add <name> [--email <address>]');
    await assertOfflineWrite(config, 'a user admitted', 'manage users');
    const record = await addUser(config, { displayName, ...(values.email ? { email: values.email } : {}) });
    console.log('User added:');
    console.log(`  ${formatUserLine(record)}`);
    console.log('');
    console.log('Bind a token to them before starting the daemon:');
    console.log(`  oh daemon show-token --user ${values.email ?? record.user.id}`);
    return;
  }
  if (sub === 'list') {
    const users = await listUsers(config);
    if (users.length === 0) {
      console.log('No directory users — every paired token acts as the daemon operator.');
      return;
    }
    for (const record of users) {
      console.log(formatUserLine(record));
      for (const grant of await listUserGrants(record)) {
        console.log(
          `    ${grant.role.padEnd(6)}  ${grant.workspaceId}${grant.origin === 'idp' ? '  (idp-mapped)' : ''}`,
        );
      }
    }
    return;
  }
  if (sub === 'deactivate') {
    const [idOrEmail] = positionals;
    if (idOrEmail === undefined) throw new Error('usage: oh daemon user deactivate <id-or-email>');
    await assertOfflineWrite(config, 'a deactivation', 'manage users');
    const { revokedTokenIds } = await deactivateUser(config, idOrEmail);
    console.log(`User deactivated; ${revokedTokenIds.length} token(s) revoked.`);
    console.log("Applies from the daemon's next start; their next HELLO/MCP call is refused.");
    return;
  }
  if (sub === 'grant') {
    const [idOrEmail, workspaceId, role] = positionals;
    if (idOrEmail === undefined || workspaceId === undefined || role === undefined || !isWorkspaceRole(role)) {
      throw new Error('usage: oh daemon user grant <id-or-email> <workspaceId> <owner|editor|viewer>');
    }
    await assertOfflineWrite(config, 'a grant', 'manage grants');
    const { record, updated } = await grantUserRole(config, idOrEmail, workspaceId, role);
    console.log(`${updated ? 'Grant updated' : 'Granted'}: ${record.user.displayName} is ${role} on ${workspaceId}.`);
    console.log('Workspace ids are not verifiable offline — a grant on an id that never');
    console.log('materializes is dropped by the reconcile on the next start.');
    return;
  }
  if (sub === 'revoke-grant') {
    const [idOrEmail, workspaceId] = positionals;
    if (idOrEmail === undefined || workspaceId === undefined) {
      throw new Error('usage: oh daemon user revoke-grant <id-or-email> <workspaceId>');
    }
    await assertOfflineWrite(config, 'a grant revocation', 'manage grants');
    const record = await revokeUserGrant(config, idOrEmail, workspaceId);
    console.log(`Grant revoked: ${record.user.displayName} on ${workspaceId}.`);
    return;
  }
  if (sub === 'set-password') {
    const [idOrEmail] = positionals;
    if (idOrEmail === undefined) throw new Error('usage: oh daemon user set-password <id-or-email> [--clear]');
    await assertOfflineWrite(config, 'a password change', 'manage passwords');
    if (values.clear === true) {
      const record = await setUserPassword(config, idOrEmail, null);
      console.log(`Password cleared for ${record.user.displayName}.`);
      console.log('Live sessions stand until revoked; only a new password login is refused.');
      return;
    }
    const password = await resolvePasswordInput(process.env);
    const record = await setUserPassword(config, idOrEmail, password);
    console.log(`Password set for ${record.user.displayName}.`);
    console.log("Applies from the daemon's next start. The password login form is served");
    console.log('only when no oidc block is configured (one credential story per deployment).');
    return;
  }
  throw new Error('usage: oh daemon user <add|list|deactivate|grant|revoke-grant|set-password>');
}

async function commandLicense(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { values, positionals } = parseArgs({ args: [...rest], options: CONFIG_OPTIONS, allowPositionals: true });
  const { config } = resolveConfigFlags(values);
  const filePath = resolveLicenseFilePath(config);
  if (sub === 'status') {
    const snapshot = await licenseStatus(config);
    for (const statusLine of formatLicenseSnapshot(snapshot, filePath)) {
      console.log(statusLine);
    }
    if (snapshot.status === 'invalid' || snapshot.status === 'expired') process.exitCode = 1;
    return;
  }
  if (sub === 'install') {
    const [sourcePath] = positionals;
    if (sourcePath === undefined) throw new Error('usage: oh daemon license install <file>');
    const snapshot = await licenseInstall(config, sourcePath);
    console.log('License installed:');
    for (const statusLine of formatLicenseSnapshot(snapshot, filePath)) {
      console.log(`  ${statusLine.trim()}`);
    }
    console.log('A running daemon picks this up live; no restart needed.');
    return;
  }
  if (sub === 'remove') {
    const hadLicense = await licenseRemove(config);
    console.log(
      hadLicense ? 'License removed — back on the free tier (up to 10 active users).' : 'No license was installed.',
    );
    return;
  }
  throw new Error('usage: oh daemon license <status|install|remove>');
}

async function main(): Promise<void> {
  const [group, command, ...rest] = process.argv.slice(2);
  if (group === '--version' || group === '-v') {
    console.log(`${cliVersion}${formatBuildStamp(getBuildInfo())}`);
    return;
  }
  if (group !== 'daemon' || command === undefined || command === 'help') {
    console.log(USAGE);
    if (group !== undefined && group !== 'daemon' && group !== 'help' && group !== '--help' && group !== '-h') {
      process.exitCode = 1;
    }
    return;
  }
  switch (command) {
    case 'install':
      return commandInstall(rest);
    case 'start':
      return startService(serviceHost()).then(() => console.log('started'));
    case 'stop':
      return stopService(serviceHost()).then(() => console.log('stopped'));
    case 'run':
      // Lazy like audit/backup: the spine reaches better-sqlite3, and
      // the entry bundle must keep loading on hosts where the native
      // binding failed to build.
      return (await import('./daemon-run')).runDaemon(rest);
    case 'status':
      return commandStatus(rest);
    case 'show-token':
      return commandShowToken(rest);
    case 'config':
      return commandConfig(rest);
    case 'user':
      return commandUser(rest);
    case 'license':
      return commandLicense(rest);
    case 'vault':
      return commandVault(rest);
    case 'audit':
      // Loaded lazily: the audit reader is the one CLI path that
      // reaches better-sqlite3, and the entry bundle must keep loading
      // on hosts where the native binding failed to build.
      return (await import('./cli/audit')).commandAudit(rest);
    case 'backup':
      // Lazy for the same reason as audit: the snapshot helper opens
      // oracle.db through better-sqlite3.
      return (await import('./cli/backup')).commandBackup(rest);
    case 'restore':
      // Restore itself is sqlite-free (a verified copy-back), but it
      // rides the same chunk as its inverse.
      return (await import('./cli/backup')).commandRestore(rest);
    default:
      console.log(USAGE);
      process.exitCode = 1;
      return;
  }
}

main().catch((err: unknown) => {
  console.error(`oh: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
