/**
 * Daemon config resolution — argv → env → daemon.json → defaults
 * precedence, platform data-dir defaults, and the refuse-to-boot
 * validation posture (bad bind address / privileged port throw).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultDataDir, resolveDaemonConfig } from '../../src/config';

const HOME = '/home/oh';

const tempDirs: string[] = [];

/** A real on-disk daemon.json; config reading is deliberately not mocked. */
function writeConfigFile(contents: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-daemon-config-'));
  tempDirs.push(dir);
  const file = path.join(dir, 'daemon.json');
  fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return file;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function resolve(argv: string[] = [], env: Record<string, string | undefined> = {}) {
  return resolveDaemonConfig({ argv, env, platform: 'linux', homedir: HOME });
}

describe('defaultDataDir', () => {
  it('uses the platform state dir per OS', () => {
    expect(defaultDataDir('darwin', {}, HOME)).toBe(`${HOME}/Library/Application Support/openheaders-daemon`);
    expect(defaultDataDir('linux', {}, HOME)).toBe(`${HOME}/.local/state/openheaders-daemon`);
    expect(defaultDataDir('linux', { XDG_STATE_HOME: '/var/state' }, HOME)).toBe('/var/state/openheaders-daemon');
  });
});

describe('resolveDaemonConfig — defaults', () => {
  it('falls back to loopback:8137 in the platform data dir', () => {
    const config = resolve();
    expect(config).toMatchObject({
      dataDir: `${HOME}/.local/state/openheaders-daemon`,
      bindAddress: '127.0.0.1',
      bindPort: 8137,
    });
    expect(config.configPath).toBe(`${HOME}/.local/state/openheaders-daemon/daemon.json`);
  });
});

describe('resolveDaemonConfig — precedence', () => {
  it('reads the config file when present', () => {
    const file = writeConfigFile({ bindAddress: '0.0.0.0', bindPort: 9000, dataDir: '/srv/oh' });
    const config = resolve(['--config', file]);
    expect(config).toMatchObject({ dataDir: '/srv/oh', bindAddress: '0.0.0.0', bindPort: 9000 });
  });

  it('lets env override the file, and argv override env', () => {
    const file = writeConfigFile({ bindAddress: '0.0.0.0', bindPort: 9000 });
    const config = resolve(['--config', file, '--bind-port', '9002'], {
      OH_DAEMON_BIND_PORT: '9001',
      OH_DAEMON_BIND_ADDRESS: '127.0.0.1',
    });
    expect(config.bindAddress).toBe('127.0.0.1'); // env beats file
    expect(config.bindPort).toBe(9002); // argv beats env
  });

  it('the file may move the data dir but not itself', () => {
    const file = writeConfigFile({ dataDir: '/srv/oh' });
    const config = resolve([], { OH_DAEMON_CONFIG: file });
    expect(config.dataDir).toBe('/srv/oh');
    expect(config.configPath).toBe(file);
  });

  it('resolves the log level through the same chain, defaulting to info', () => {
    expect(resolve().logLevel).toBe('info');
    const file = writeConfigFile({ logLevel: 'error' });
    expect(resolve(['--config', file]).logLevel).toBe('error');
    expect(resolve(['--config', file], { OH_DAEMON_LOG_LEVEL: 'warn' }).logLevel).toBe('warn');
    expect(resolve(['--config', file, '--log-level', 'debug'], { OH_DAEMON_LOG_LEVEL: 'warn' }).logLevel).toBe('debug');
  });
});

describe('resolveDaemonConfig — validation', () => {
  it('rejects a bind address that is neither loopback nor all-interfaces', () => {
    expect(() => resolve(['--bind-address', '192.168.1.10'])).toThrow(/bind address/);
  });

  it('rejects a privileged port', () => {
    expect(() => resolve(['--bind-port', '80'])).toThrow(/not bindable/);
  });

  it('rejects a malformed config file rather than guessing', () => {
    const file = writeConfigFile('[1,2,3]');
    expect(() => resolve(['--config', file])).toThrow(/JSON object/);
  });

  it('rejects an unknown log level', () => {
    expect(() => resolve(['--log-level', 'verbose'])).toThrow(/log level/);
  });
});
