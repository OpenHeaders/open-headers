/**
 * `ohd config set / get / list` — the headless settings surface.
 * A whitelisted window onto the `oh.settings.user` record inside the
 * daemon's `storage.json`, NOT a generic storage editor: only the MCP
 * switches and the unattended auto-update opt-in are exposed (all
 * default-off), and unknown keys refuse with the whitelist printed.
 * Bind/proxy/web-root live in `daemon.json` and stay with the config
 * chain.
 *
 * Writes are offline by design — same single-writer law as show-token:
 * `FileBackedHostStorage` loads once and rewrites the whole envelope,
 * so a CLI write under a live daemon would be clobbered by the daemon's
 * next flush. The caller guards with a `/healthz` probe and refuses
 * while the daemon runs; the daemon reads the fresh settings on its
 * next boot. Reads are safe anytime (the daemon flushes every write).
 */

import * as path from 'node:path';
import { OH } from '@openheaders/core/storage';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import type { DaemonConfig } from '../config';
import { resolveDaemonCipher } from '../vault-cipher';

export const DAEMON_SETTING_KEYS = [
  'mcp.enabled',
  'mcp.allowObserve',
  'mcp.allowWrite',
  'mcp.allowExecute',
  'mcp.allowSecrets',
  'updates.autoUpdate',
] as const;

export type DaemonSettingKey = (typeof DAEMON_SETTING_KEYS)[number];

export function parseDaemonSettingKey(raw: string): DaemonSettingKey {
  if ((DAEMON_SETTING_KEYS as readonly string[]).includes(raw)) return raw as DaemonSettingKey;
  throw new Error(
    `unknown setting '${raw}' — settable keys: ${DAEMON_SETTING_KEYS.join(', ')}; ` +
      "bind and network options persist through 'ohd install <flags>' instead",
  );
}

export function parseDaemonSettingValue(key: DaemonSettingKey, raw: string): boolean {
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${key} is a boolean — expected true/false, got '${raw}'`);
}

function openStorage(config: DaemonConfig): FileBackedHostStorage {
  return new FileBackedHostStorage({
    filePath: path.join(config.dataDir, 'storage.json'),
    secretCipher: resolveDaemonCipher(config),
  });
}

export async function setDaemonSetting(config: DaemonConfig, key: DaemonSettingKey, value: boolean): Promise<void> {
  const storage = openStorage(config);
  const settings = (await storage.get(OH.settingsUser)) ?? {};
  await storage.set(OH.settingsUser, { ...settings, [key]: value });
}

/** Every whitelisted key with its stored value; absent = engine default (off). */
export async function readDaemonSettings(config: DaemonConfig): Promise<Record<DaemonSettingKey, boolean | undefined>> {
  const settings = (await openStorage(config).get(OH.settingsUser)) ?? {};
  const out = {} as Record<DaemonSettingKey, boolean | undefined>;
  for (const key of DAEMON_SETTING_KEYS) {
    const value = settings[key];
    out[key] = typeof value === 'boolean' ? value : undefined;
  }
  return out;
}
