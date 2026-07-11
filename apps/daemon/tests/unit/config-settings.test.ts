/**
 * Headless settings surface (`oh daemon config set / get / list`) —
 * whitelist validation, boolean parsing, and the merge-write against an
 * on-disk `storage.json` (plain bucket, other slots untouched).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DAEMON_SETTING_KEYS,
  parseDaemonSettingKey,
  parseDaemonSettingValue,
  readDaemonSettings,
  setDaemonSetting,
} from '../../src/cli/config-settings';
import type { DaemonConfig } from '../../src/config';

const tempDirs: string[] = [];

function makeConfig(): DaemonConfig {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-config-set-'));
  tempDirs.push(dataDir);
  return {
    dataDir,
    bindAddress: '127.0.0.1',
    bindPort: 8137,
    logLevel: 'info',
    trustedProxy: false,
    allowedHosts: [],
    allowInsecureLan: false,
    webRoot: null,
    oidc: null,
    vaultPassphrase: null,
    auditRetentionDays: 90,
    auditForwarding: null,
    licenseFile: null,
    configPath: path.join(dataDir, 'daemon.json'),
  };
}

function readSettingsSlot(dataDir: string): Record<string, unknown> {
  const envelope = JSON.parse(fs.readFileSync(path.join(dataDir, 'storage.json'), 'utf-8')) as {
    values: Record<string, unknown>;
  };
  return (envelope.values['oh.settings.user'] ?? {}) as Record<string, unknown>;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('parseDaemonSettingKey', () => {
  it('accepts every whitelisted key', () => {
    for (const key of DAEMON_SETTING_KEYS) {
      expect(parseDaemonSettingKey(key)).toBe(key);
    }
  });

  it('refuses unknown keys with the whitelist in the message', () => {
    expect(() => parseDaemonSettingKey('backend.bindPort')).toThrow(/mcp\.enabled.*mcp\.allowSecrets/s);
    expect(() => parseDaemonSettingKey('mcp')).toThrow(/unknown setting/);
  });
});

describe('parseDaemonSettingValue', () => {
  it('parses true/false/1/0 and refuses anything else', () => {
    expect(parseDaemonSettingValue('mcp.enabled', 'true')).toBe(true);
    expect(parseDaemonSettingValue('mcp.enabled', '1')).toBe(true);
    expect(parseDaemonSettingValue('mcp.enabled', 'false')).toBe(false);
    expect(parseDaemonSettingValue('mcp.enabled', '0')).toBe(false);
    expect(() => parseDaemonSettingValue('mcp.enabled', 'yes')).toThrow(/expected true\/false/);
  });
});

describe('setDaemonSetting / readDaemonSettings', () => {
  it('writes the key into oh.settings.user and reads it back', async () => {
    const config = makeConfig();
    await setDaemonSetting(config, 'mcp.enabled', true);

    expect(readSettingsSlot(config.dataDir)['mcp.enabled']).toBe(true);
    const settings = await readDaemonSettings(config);
    expect(settings['mcp.enabled']).toBe(true);
    expect(settings['mcp.allowWrite']).toBeUndefined();
  });

  it('merges into existing settings instead of replacing the record', async () => {
    const config = makeConfig();
    fs.writeFileSync(
      path.join(config.dataDir, 'storage.json'),
      JSON.stringify({
        schemaVersion: 1,
        values: { 'oh.settings.user': { 'backend.bindPort': 9137, 'mcp.allowWrite': true } },
        secrets: {},
      }),
    );

    await setDaemonSetting(config, 'mcp.enabled', true);

    const slot = readSettingsSlot(config.dataDir);
    expect(slot['backend.bindPort']).toBe(9137);
    expect(slot['mcp.allowWrite']).toBe(true);
    expect(slot['mcp.enabled']).toBe(true);
  });

  it('reads absent storage as all-unset (engine defaults)', async () => {
    const settings = await readDaemonSettings(makeConfig());
    for (const key of DAEMON_SETTING_KEYS) {
      expect(settings[key]).toBeUndefined();
    }
  });

  it('ignores non-boolean junk in a whitelisted slot', async () => {
    const config = makeConfig();
    fs.writeFileSync(
      path.join(config.dataDir, 'storage.json'),
      JSON.stringify({
        schemaVersion: 1,
        values: { 'oh.settings.user': { 'mcp.enabled': 'true' } },
        secrets: {},
      }),
    );
    const settings = await readDaemonSettings(config);
    expect(settings['mcp.enabled']).toBeUndefined();
  });
});
