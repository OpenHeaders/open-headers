/**
 * Shared config-flag plumbing for `ohd` commands — the flag table
 * every command accepts plus the resolve step that turns parsed values
 * into a {@link DaemonConfig} and the argv to bake into service units.
 * Lives outside `cli.ts` so lazily-loaded command chunks (`audit`) can
 * parse the same flags without importing the entry module.
 */

import { parseArgs } from 'node:util';
import { type DaemonConfig, resolveDaemonConfig } from '../config';

export const CONFIG_OPTIONS = {
  config: { type: 'string' },
  'data-dir': { type: 'string' },
  'bind-address': { type: 'string' },
  'bind-port': { type: 'string' },
  'log-level': { type: 'string' },
  'trusted-proxy': { type: 'boolean' },
  'allowed-host': { type: 'string', multiple: true },
  'allow-insecure-lan': { type: 'boolean' },
  'web-root': { type: 'string' },
  'proxy-mode': { type: 'string' },
  'proxy-url': { type: 'string' },
  'proxy-credential-ref': { type: 'string' },
  'proxy-bypass': { type: 'string' },
} as const;

export interface ConfigFlagValues {
  config?: string;
  'data-dir'?: string;
  'bind-address'?: string;
  'bind-port'?: string;
  'log-level'?: string;
  'trusted-proxy'?: boolean;
  'allowed-host'?: string[];
  'allow-insecure-lan'?: boolean;
  'web-root'?: string;
  'proxy-mode'?: string;
  'proxy-url'?: string;
  'proxy-credential-ref'?: string;
  'proxy-bypass'?: string;
}

export interface ParsedConfigCommand {
  config: DaemonConfig;
  /** The explicitly-given config flags, resolved — baked into service units. */
  unitArgs: string[];
}

export function resolveConfigFlags(values: ConfigFlagValues): ParsedConfigCommand {
  // Re-issue only the config flags — `resolveDaemonConfig` parses
  // strictly and must not see command-specific ones like --label.
  const configArgv: string[] = [];
  for (const flag of [
    'config',
    'data-dir',
    'bind-address',
    'bind-port',
    'log-level',
    'web-root',
    'proxy-mode',
    'proxy-url',
    'proxy-credential-ref',
    'proxy-bypass',
  ] as const) {
    const value = values[flag];
    if (typeof value === 'string') configArgv.push(`--${flag}`, value);
  }
  if (values['trusted-proxy']) configArgv.push('--trusted-proxy');
  for (const host of values['allowed-host'] ?? []) configArgv.push('--allowed-host', host);
  if (values['allow-insecure-lan']) configArgv.push('--allow-insecure-lan');
  const config = resolveDaemonConfig({ argv: configArgv, env: process.env });
  const unitArgs: string[] = [];
  if (values.config !== undefined) unitArgs.push('--config', config.configPath);
  if (values['data-dir'] !== undefined) unitArgs.push('--data-dir', config.dataDir);
  if (values['bind-address'] !== undefined) unitArgs.push('--bind-address', config.bindAddress);
  if (values['bind-port'] !== undefined) unitArgs.push('--bind-port', String(config.bindPort));
  if (values['log-level'] !== undefined) unitArgs.push('--log-level', config.logLevel);
  if (values['trusted-proxy'] !== undefined && config.trustedProxy) unitArgs.push('--trusted-proxy');
  if (values['allowed-host'] !== undefined) {
    for (const host of config.allowedHosts) unitArgs.push('--allowed-host', host);
  }
  if (values['allow-insecure-lan'] !== undefined && config.allowInsecureLan) unitArgs.push('--allow-insecure-lan');
  if (values['web-root'] !== undefined && config.webRoot !== null) unitArgs.push('--web-root', config.webRoot);
  const egress = config.environmentProxy;
  if (egress !== null) {
    if (values['proxy-mode'] !== undefined) unitArgs.push('--proxy-mode', egress.mode);
    if (values['proxy-url'] !== undefined && egress.manualProxyUrl !== undefined) {
      unitArgs.push('--proxy-url', egress.manualProxyUrl);
    }
    if (values['proxy-credential-ref'] !== undefined && egress.manualCredentialRef !== undefined) {
      unitArgs.push('--proxy-credential-ref', egress.manualCredentialRef);
    }
    if (values['proxy-bypass'] !== undefined && egress.manualBypassList !== undefined) {
      unitArgs.push('--proxy-bypass', egress.manualBypassList);
    }
  }
  return { config, unitArgs };
}

export function parseConfigCommand(argv: readonly string[]): ParsedConfigCommand {
  const { values } = parseArgs({ args: [...argv], options: CONFIG_OPTIONS });
  return resolveConfigFlags(values);
}
