/**
 * Node-tier environment-plane install (docs/REQUEST_ENGINE_PROXY_DESIGN.md
 * P4) — the daemon/CLI/TUI half of the mode-driven service the desktop
 * ships in its shell. Same per-device slot (`OH.environmentProxy`),
 * same resolvers; the tier's modes are Off / Env / Manual with Env the
 * default (FORK A — the ecosystem norm for headless tools: the
 * HTTP_PROXY-family variables with curl precedence).
 *
 * PAC never lands here: running fetched PAC JS in-process is exactly
 * what the static-bundling law forbids, and this tier has no Chromium
 * to sandbox it — a `pac` (or desktop-only `system`) mode is an honest
 * config error naming the modes that DO work, never a silent direct.
 *
 * Config precedence: an answer resolved from the daemon's own config
 * surface (argv → env → daemon.json) seeds the slot — the config file
 * is the headless tier's UI, the slot is the storage contract a future
 * admin surface edits. Without one, the stored slot applies; a
 * malformed slot reads as the tier default. Manual credentials resolve
 * per RESOLVE against this host's vault by entry name (the vault
 * posture — a dangling ref sends unauthenticated and the proxy's 407
 * is the honest surface).
 */

import { EnvironmentProxySettingsSchema, NODE_ENVIRONMENT_PROXY_MODES, parseEntity } from '@openheaders/core/schemas';
import type { StorageKey } from '@openheaders/core/storage';
import { OH } from '@openheaders/core/storage';
import type { EnvironmentProxySettings } from '@openheaders/core/types';
import { getVault } from '@openheaders/oracle/entity/environment-store';
import { createEnvProxyResolver } from '../live/environment-proxy/env-proxy-resolver';
import { createManualProxyResolver } from '../live/environment-proxy/manual-resolver';
import { registerEnvironmentProxyResolver } from '../live/environment-proxy/registry';

/** The node tier default: Env ON (FORK A) — a machine with no
 *  HTTP_PROXY-family variables resolves DIRECT and behaves as before. */
export const DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS: EnvironmentProxySettings = { version: 1, mode: 'env' };

/** The slice of `HostStorage` the install rides — narrow so unit rigs
 *  hand in a plain map-backed store. */
export interface NodeEnvironmentProxyStore {
  get<T>(spec: StorageKey<T>): Promise<T | undefined>;
  set<T>(spec: StorageKey<T>, value: T): Promise<void>;
}

export interface InstallNodeEnvironmentProxyOptions {
  hostStorage: NodeEnvironmentProxyStore;
  /** The daemon config surface's answer (argv → env → daemon.json),
   *  already validated to this tier's modes; seeds the slot. Absent =
   *  the stored slot (or the tier default) applies. */
  configured?: EnvironmentProxySettings;
}

function isNodeMode(mode: EnvironmentProxySettings['mode']): boolean {
  return (NODE_ENVIRONMENT_PROXY_MODES as readonly string[]).includes(mode);
}

/**
 * Hydrate the per-device settings, register the mode's resolver, and
 * return the effective settings for the boot log. Throws the honest
 * config error on a slot carrying a mode this tier cannot honor —
 * refuse to boot rather than second-guess an explicit configuration.
 */
export async function installNodeEnvironmentProxy(
  options: InstallNodeEnvironmentProxyOptions,
): Promise<EnvironmentProxySettings> {
  let settings = DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS;
  if (options.configured !== undefined) {
    settings = options.configured;
    await options.hostStorage.set(OH.environmentProxy, settings);
  } else {
    // A malformed slot reads as the tier default — never a boot failure.
    const stored = await options.hostStorage.get(OH.environmentProxy);
    if (stored !== undefined) {
      settings = parseEntity(EnvironmentProxySettingsSchema, stored) ?? DEFAULT_NODE_ENVIRONMENT_PROXY_SETTINGS;
    }
  }
  if (!isNodeMode(settings.mode)) {
    throw new Error(
      `environment proxy mode '${settings.mode}' is not available on this tier — ` +
        `PAC and system resolution need the sandboxed Chromium resolver only the desktop app ships; ` +
        `use 'env' (HTTP_PROXY / HTTPS_PROXY / NO_PROXY) or 'manual'`,
    );
  }
  switch (settings.mode) {
    case 'off':
      registerEnvironmentProxyResolver(null);
      break;
    case 'env':
      registerEnvironmentProxyResolver(createEnvProxyResolver());
      break;
    case 'manual': {
      if (settings.manualProxyUrl === undefined) {
        // Mirror the desktop: manual with nothing configured is direct.
        registerEnvironmentProxyResolver(null);
        break;
      }
      const proxyValue = settings.manualProxyUrl;
      const credentialRef = settings.manualCredentialRef;
      registerEnvironmentProxyResolver(
        createManualProxyResolver({
          proxyValue,
          ...(settings.manualBypassList !== undefined ? { bypassList: settings.manualBypassList } : {}),
          ...(credentialRef !== undefined
            ? {
                resolveCredential: () => {
                  const entry = getVault().secrets.find((s) => s.kind === 'string' && s.name === credentialRef);
                  return entry !== undefined && entry.kind === 'string' ? entry.value : null;
                },
              }
            : {}),
        }),
      );
      break;
    }
  }
  return settings;
}
