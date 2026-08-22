/**
 * Shared config-flag plumbing for `ohd` commands — the flag table
 * every command accepts plus the resolve step that turns parsed values
 * into a {@link DaemonConfig}, and the install-only mapping that turns
 * explicitly-given flags into the `daemon.json` update `ohd install`
 * persists. Lives outside `cli.ts` so lazily-loaded command chunks
 * (`audit`) can parse the same flags without importing the entry module.
 */

import { type ConfigFileUpdate, type DaemonConfig, resolveDaemonConfig } from '../config';

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

/**
 * `ohd install` additions: the negations that clear a boolean persisted
 * in `daemon.json` by an earlier install. Only install takes them —
 * every other command reads config, it doesn't write it.
 */
export const INSTALL_OPTIONS = {
  ...CONFIG_OPTIONS,
  'no-trusted-proxy': { type: 'boolean' },
  'no-allow-insecure-lan': { type: 'boolean' },
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

export interface InstallFlagValues extends ConfigFlagValues {
  'no-trusted-proxy'?: boolean;
  'no-allow-insecure-lan'?: boolean;
}

export function resolveConfigFlags(values: ConfigFlagValues): DaemonConfig {
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
  return resolveDaemonConfig({ argv: configArgv, env: process.env });
}

function resolveBooleanPair(on: boolean | undefined, off: boolean | undefined, flag: string): boolean | undefined {
  if (on === true && off === true) throw new Error(`--${flag} and --no-${flag} are mutually exclusive`);
  if (on === true) return true;
  if (off === true) return false;
  return undefined;
}

/**
 * The `daemon.json` update an `ohd install` invocation means: exactly
 * the explicitly-given flags, nothing inferred — an omitted flag leaves
 * the file's current value standing, so a bare re-install (after an
 * upgrade, say) never silently reverts a configured daemon.
 */
export function configFileUpdateFromFlags(values: InstallFlagValues): ConfigFileUpdate {
  const update: ConfigFileUpdate = {};
  if (values['data-dir'] !== undefined) update.dataDir = values['data-dir'];
  if (values['bind-address'] !== undefined) update.bindAddress = values['bind-address'];
  if (values['bind-port'] !== undefined) update.bindPort = Number(values['bind-port']);
  if (values['log-level'] !== undefined) update.logLevel = values['log-level'];
  const trustedProxy = resolveBooleanPair(values['trusted-proxy'], values['no-trusted-proxy'], 'trusted-proxy');
  if (trustedProxy !== undefined) update.trustedProxy = trustedProxy;
  if (values['allowed-host'] !== undefined) update.allowedHosts = values['allowed-host'];
  const allowInsecureLan = resolveBooleanPair(
    values['allow-insecure-lan'],
    values['no-allow-insecure-lan'],
    'allow-insecure-lan',
  );
  if (allowInsecureLan !== undefined) update.allowInsecureLan = allowInsecureLan;
  if (values['web-root'] !== undefined) update.webRoot = values['web-root'];
  if (
    values['proxy-mode'] !== undefined ||
    values['proxy-url'] !== undefined ||
    values['proxy-credential-ref'] !== undefined ||
    values['proxy-bypass'] !== undefined
  ) {
    update.proxy = {
      ...(values['proxy-mode'] !== undefined ? { mode: values['proxy-mode'] } : {}),
      ...(values['proxy-url'] !== undefined ? { url: values['proxy-url'] } : {}),
      ...(values['proxy-credential-ref'] !== undefined ? { credentialRef: values['proxy-credential-ref'] } : {}),
      ...(values['proxy-bypass'] !== undefined ? { bypassList: values['proxy-bypass'] } : {}),
    };
  }
  return update;
}
