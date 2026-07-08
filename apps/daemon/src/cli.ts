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

import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { probeHealthz } from './cli/healthz-probe';
import { installServiceUnit, type ServiceHost, startService, stopService } from './cli/service-manager';
import { mintBootstrapToken } from './cli/show-token';
import { type DaemonConfig, resolveDaemonConfig } from './config';

const cliVersion: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version;

const CONFIG_OPTIONS = {
  config: { type: 'string' },
  'data-dir': { type: 'string' },
  'bind-address': { type: 'string' },
  'bind-port': { type: 'string' },
  'log-level': { type: 'string' },
} as const;

const USAGE = `oh v${cliVersion} — Open Headers command line

Usage: oh daemon <command> [options]

Commands:
  install       Write the user service unit (launchd/systemd) for the daemon
  start         Start the installed service
  stop          Stop the installed service
  status        Probe the daemon's /healthz
  show-token    Mint a client auth token against the daemon's data dir
                (first-boot bootstrap; requires the daemon to be stopped)

Options (install / status / show-token):
  --config <path>          daemon.json location
  --data-dir <path>        Data directory (storage.json, oracle.db, blobs/)
  --bind-address <addr>    127.0.0.1 (loopback) or 0.0.0.0 (LAN)
  --bind-port <port>       Sync/HTTP port (default 8137)
  --log-level <level>      error | warn | info | debug (default info)
  --label <text>           show-token only: label for the minted token
`;

function serviceHost(): ServiceHost {
  return { platform: process.platform, homedir: os.homedir(), uid: process.getuid?.() ?? 0 };
}

interface ConfigFlagValues {
  config?: string;
  'data-dir'?: string;
  'bind-address'?: string;
  'bind-port'?: string;
  'log-level'?: string;
}

interface ParsedConfigCommand {
  config: DaemonConfig;
  /** The explicitly-given config flags, resolved — baked into service units. */
  unitArgs: string[];
}

function resolveConfigFlags(values: ConfigFlagValues): ParsedConfigCommand {
  // Re-issue only the config flags — `resolveDaemonConfig` parses
  // strictly and must not see command-specific ones like --label.
  const configArgv: string[] = [];
  for (const flag of ['config', 'data-dir', 'bind-address', 'bind-port', 'log-level'] as const) {
    const value = values[flag];
    if (typeof value === 'string') configArgv.push(`--${flag}`, value);
  }
  const config = resolveDaemonConfig({ argv: configArgv, env: process.env });
  const unitArgs: string[] = [];
  if (values.config !== undefined) unitArgs.push('--config', config.configPath);
  if (values['data-dir'] !== undefined) unitArgs.push('--data-dir', config.dataDir);
  if (values['bind-address'] !== undefined) unitArgs.push('--bind-address', config.bindAddress);
  if (values['bind-port'] !== undefined) unitArgs.push('--bind-port', String(config.bindPort));
  if (values['log-level'] !== undefined) unitArgs.push('--log-level', config.logLevel);
  return { config, unitArgs };
}

function parseConfigCommand(argv: readonly string[]): ParsedConfigCommand {
  const { values } = parseArgs({ args: [...argv], options: CONFIG_OPTIONS });
  return resolveConfigFlags(values);
}

async function commandInstall(argv: readonly string[]): Promise<void> {
  const { config, unitArgs } = parseConfigCommand(argv);
  const mainJs = path.join(path.dirname(fileURLToPath(import.meta.url)), 'main.js');
  const unitPath = await installServiceUnit(serviceHost(), {
    nodeBin: process.execPath,
    mainJs,
    args: unitArgs,
    logFile: path.join(config.dataDir, 'logs', 'daemon.log'),
  });
  console.log(`Installed ${unitPath}`);
  console.log(`  exec: ${process.execPath} ${mainJs}${unitArgs.length ? ` ${unitArgs.join(' ')}` : ''}`);
  console.log(`  bind: ${config.bindAddress}:${config.bindPort}, data dir: ${config.dataDir}`);
  console.log('');
  console.log('Next: mint the first client token, then start the service:');
  console.log('  oh daemon show-token');
  console.log('  oh daemon start');
}

async function commandStatus(argv: readonly string[]): Promise<void> {
  const { config } = parseConfigCommand(argv);
  const up = await probeHealthz(config.bindPort);
  if (up) {
    console.log(`running — /healthz OK on 127.0.0.1:${config.bindPort} (configured bind ${config.bindAddress})`);
  } else {
    console.log(`not running — no /healthz on 127.0.0.1:${config.bindPort}`);
    process.exitCode = 1;
  }
}

async function commandShowToken(argv: readonly string[]): Promise<void> {
  const { values } = parseArgs({ args: [...argv], options: { ...CONFIG_OPTIONS, label: { type: 'string' } } });
  const { config } = resolveConfigFlags(values);
  const label = values.label;
  if (await probeHealthz(config.bindPort)) {
    throw new Error(
      `the daemon is running on port ${config.bindPort} — stop it first (oh daemon stop). ` +
        'storage.json is single-writer; a mint under a live daemon would be lost. ' +
        'While it runs, mint from a connected admin surface instead.',
    );
  }
  const minted = await mintBootstrapToken(config, label);
  console.log(`Token minted (id ${minted.tokenId}${label ? `, label "${label}"` : ''}).`);
  console.log('');
  console.log(`  ${minted.secret}`);
  console.log('');
  console.log('This secret is shown once — the daemon stores only its hash.');
  console.log('Add a backend in a client (Settings → Backends) with the token and one of:');
  for (const join of minted.joinUrls) {
    console.log(`  ${join.url}${join.iface ? `   (${join.iface})` : ''}`);
  }
  if (config.bindAddress !== '0.0.0.0') {
    console.log('The daemon is loopback-only; set bind-address 0.0.0.0 to make it LAN-reachable.');
  }
}

async function main(): Promise<void> {
  const [group, command, ...rest] = process.argv.slice(2);
  if (group === '--version' || group === '-v') {
    console.log(cliVersion);
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
    case 'status':
      return commandStatus(rest);
    case 'show-token':
      return commandShowToken(rest);
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
