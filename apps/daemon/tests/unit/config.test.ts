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
    const file = writeConfigFile({ bindAddress: '0.0.0.0', bindPort: 9000, dataDir: '/srv/oh', trustedProxy: true });
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

  it('resolves trustedProxy through the chain, defaulting to off', () => {
    expect(resolve().trustedProxy).toBe(false);
    const file = writeConfigFile({ trustedProxy: true });
    expect(resolve(['--config', file]).trustedProxy).toBe(true);
    expect(resolve(['--config', file], { OH_DAEMON_TRUSTED_PROXY: 'false' }).trustedProxy).toBe(false);
    expect(resolve(['--trusted-proxy'], { OH_DAEMON_TRUSTED_PROXY: 'false' }).trustedProxy).toBe(true);
  });

  it('resolves allowedHosts through the chain, lower-cased, defaulting to none', () => {
    expect(resolve().allowedHosts).toEqual([]);
    const file = writeConfigFile({ allowedHosts: ['oh.openheaders.io'] });
    expect(resolve(['--config', file]).allowedHosts).toEqual(['oh.openheaders.io']);
    expect(
      resolve(['--config', file], { OH_DAEMON_ALLOWED_HOSTS: 'A.openheaders.io,b.openheaders.io' }).allowedHosts,
    ).toEqual(['a.openheaders.io', 'b.openheaders.io']);
    expect(
      resolve(['--allowed-host', 'c.openheaders.io', '--allowed-host', 'd.openheaders.io'], {
        OH_DAEMON_ALLOWED_HOSTS: 'a.openheaders.io',
      }).allowedHosts,
    ).toEqual(['c.openheaders.io', 'd.openheaders.io']);
  });

  it('resolves allowInsecureLan through the chain, defaulting to off', () => {
    expect(resolve().allowInsecureLan).toBe(false);
    const file = writeConfigFile({ allowInsecureLan: true });
    expect(resolve(['--config', file]).allowInsecureLan).toBe(true);
    expect(resolve(['--config', file], { OH_DAEMON_ALLOW_INSECURE_LAN: 'false' }).allowInsecureLan).toBe(false);
    expect(resolve(['--allow-insecure-lan'], { OH_DAEMON_ALLOW_INSECURE_LAN: 'false' }).allowInsecureLan).toBe(true);
  });

  it('resolves webRoot through the chain as an absolute path, defaulting to null', () => {
    expect(resolve().webRoot).toBeNull();
    const file = writeConfigFile({ webRoot: '/srv/oh-web' });
    expect(resolve(['--config', file]).webRoot).toBe('/srv/oh-web');
    expect(resolve(['--config', file], { OH_DAEMON_WEB_ROOT: '/opt/web' }).webRoot).toBe('/opt/web');
    expect(resolve(['--config', file, '--web-root', '/var/web'], { OH_DAEMON_WEB_ROOT: '/opt/web' }).webRoot).toBe(
      '/var/web',
    );
    expect(path.isAbsolute(resolve(['--web-root', 'relative/web']).webRoot ?? '')).toBe(true);
  });

  it('reads the oidc block, defaulting to null, with the secret env riding on top', () => {
    expect(resolve().oidc).toBeNull();
    const file = writeConfigFile({
      oidc: {
        issuer: 'https://sso.openheaders.io/',
        clientId: 'oh-daemon',
        scopes: ['openid', 'email', 'profile'],
        autoProvision: true,
        sessionTtlDays: 7,
        redirectOrigin: 'https://oh.openheaders.io',
        providerLabel: 'ACME SSO',
      },
    });
    const config = resolve(['--config', file]);
    expect(config.oidc).toMatchObject({
      issuer: 'https://sso.openheaders.io', // trailing slash trimmed
      clientId: 'oh-daemon',
      autoProvision: true,
      sessionTtlDays: 7,
      redirectOrigin: 'https://oh.openheaders.io',
      providerLabel: 'ACME SSO',
    });
    expect(config.oidc?.clientSecret).toBeUndefined();
    const withEnv = resolve(['--config', file], { OH_DAEMON_OIDC_CLIENT_SECRET: 's3cret' });
    expect(withEnv.oidc?.clientSecret).toBe('s3cret');
  });
});

describe('resolveDaemonConfig — audit retention', () => {
  it('defaults to 90 days, reading the file value and the env on top', () => {
    expect(resolve().auditRetentionDays).toBe(90);
    const file = writeConfigFile({ auditRetentionDays: 730 });
    expect(resolve(['--config', file]).auditRetentionDays).toBe(730);
    expect(resolve(['--config', file], { OH_DAEMON_AUDIT_RETENTION_DAYS: '30' }).auditRetentionDays).toBe(30);
  });

  it('refuses a non-positive or non-numeric retention', () => {
    expect(() => resolve(['--config', writeConfigFile({ auditRetentionDays: 0 })])).toThrow(/positive number/);
    expect(() => resolve(['--config', writeConfigFile({ auditRetentionDays: 'forever' })])).toThrow(/must be a number/);
    expect(() => resolve([], { OH_DAEMON_AUDIT_RETENTION_DAYS: 'x' })).toThrow(/positive number/);
  });
});

describe('resolveDaemonConfig — validation', () => {
  it('rejects a bind address that is neither loopback nor all-interfaces', () => {
    expect(() => resolve(['--bind-address', '192.168.1.10'])).toThrow(/bind address/);
  });

  it('refuses a LAN bind without a TLS proxy or the explicit cleartext acknowledgment', () => {
    expect(() => resolve(['--bind-address', '0.0.0.0'])).toThrow(/cleartext/);
    expect(() => resolve(['--config', writeConfigFile({ bindAddress: '0.0.0.0' })])).toThrow(/cleartext/);
  });

  it('admits a LAN bind behind a trusted proxy or with the acknowledgment', () => {
    expect(resolve(['--bind-address', '0.0.0.0', '--trusted-proxy']).bindAddress).toBe('0.0.0.0');
    expect(resolve(['--bind-address', '0.0.0.0', '--allow-insecure-lan']).bindAddress).toBe('0.0.0.0');
    expect(resolve(['--bind-address', '0.0.0.0'], { OH_DAEMON_ALLOW_INSECURE_LAN: '1' }).allowInsecureLan).toBe(true);
    expect(
      resolve(['--config', writeConfigFile({ bindAddress: '0.0.0.0', allowInsecureLan: true })]).allowInsecureLan,
    ).toBe(true);
  });

  it('rejects a non-boolean allowInsecureLan in the config file', () => {
    const file = writeConfigFile({ allowInsecureLan: 'yes' });
    expect(() => resolve(['--config', file])).toThrow(/allowInsecureLan/);
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

  it('rejects a malformed trusted-proxy env value', () => {
    expect(() => resolve([], { OH_DAEMON_TRUSTED_PROXY: 'yes' })).toThrow(/trusted proxy/);
  });

  it('rejects a non-string webRoot in the config file', () => {
    const file = writeConfigFile({ webRoot: 42 });
    expect(() => resolve(['--config', file])).toThrow(/webRoot/);
  });

  it('rejects a malformed oidc block rather than booting a broken login', () => {
    expect(() => resolve(['--config', writeConfigFile({ oidc: { clientId: 'x' } })])).toThrow(/oidc\.issuer/);
    expect(() => resolve(['--config', writeConfigFile({ oidc: { issuer: 'https://sso.openheaders.io' } })])).toThrow(
      /oidc\.clientId/,
    );
    expect(() => resolve(['--config', writeConfigFile({ oidc: { issuer: 'not-a-url', clientId: 'x' } })])).toThrow(
      /not a valid URL/,
    );
    expect(() =>
      resolve([
        '--config',
        writeConfigFile({ oidc: { issuer: 'https://sso.openheaders.io', clientId: 'x', sessionTtlDays: -1 } }),
      ]),
    ).toThrow(/sessionTtlDays/);
  });

  it('rejects the secret env var without an oidc block (half a provider config)', () => {
    expect(() => resolve([], { OH_DAEMON_OIDC_CLIENT_SECRET: 's3cret' })).toThrow(/no oidc block/);
  });

  it('rejects URL-shaped allowed hosts rather than never matching them', () => {
    expect(() => resolve(['--allowed-host', 'https://oh.openheaders.io'])).toThrow(/bare hostname/);
    expect(() => resolve(['--allowed-host', 'oh.openheaders.io:443'])).toThrow(/bare hostname/);
    expect(() => resolve(['--allowed-host', '*.openheaders.io'])).toThrow(/bare hostname/);
  });
});
