/**
 * Daemon config resolution — argv → env → daemon.json → defaults
 * precedence, platform data-dir defaults, and the refuse-to-boot
 * validation posture (bad bind address / privileged port throw).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { defaultDataDir, resolveConfigPath, resolveDaemonConfig, updateDaemonConfigFile } from '../../src/config';

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

  it('resolves licenseFile through the chain as an absolute path, defaulting to null', () => {
    expect(resolve().licenseFile).toBeNull();
    const file = writeConfigFile({ licenseFile: '/etc/openheaders/license.key' });
    expect(resolve(['--config', file]).licenseFile).toBe('/etc/openheaders/license.key');
    expect(resolve(['--config', file], { OH_LICENSE_FILE: '/run/secrets/oh-license' }).licenseFile).toBe(
      '/run/secrets/oh-license',
    );
    expect(
      resolve(['--config', file, '--license-file', '/var/lib/oh/license.key'], {
        OH_LICENSE_FILE: '/run/secrets/oh-license',
      }).licenseFile,
    ).toBe('/var/lib/oh/license.key');
    expect(path.isAbsolute(resolve(['--license-file', 'relative/license.key']).licenseFile ?? '')).toBe(true);
  });

  it('resolves licenseRefresh through the chain, defaulting to on', () => {
    expect(resolve().licenseRefresh).toBe(true);
    const file = writeConfigFile({ licenseRefresh: false });
    expect(resolve(['--config', file]).licenseRefresh).toBe(false);
    expect(resolve(['--config', file], { OH_LICENSE_REFRESH: '1' }).licenseRefresh).toBe(true);
    expect(resolve([], { OH_LICENSE_REFRESH: '0' }).licenseRefresh).toBe(false);
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

  it('reads oidc.claimMappings, trimming values and validating roles', () => {
    const file = writeConfigFile({
      oidc: {
        issuer: 'https://sso.openheaders.io',
        clientId: 'oh-daemon',
        claimMappings: {
          claimPath: ' groups ',
          rules: [{ value: ' eng ', workspaceId: ' 01900000-aaaa-7000-8000-000000000001 ', role: 'editor' }],
        },
      },
    });
    expect(resolve(['--config', file]).oidc?.claimMappings).toEqual({
      claimPath: 'groups',
      rules: [{ value: 'eng', workspaceId: '01900000-aaaa-7000-8000-000000000001', role: 'editor' }],
    });
  });

  it('rejects malformed claimMappings rather than booting a silently grant-less mapping', () => {
    const oidcWith = (claimMappings: unknown) => ({
      oidc: { issuer: 'https://sso.openheaders.io', clientId: 'x', claimMappings },
    });
    expect(() => resolve(['--config', writeConfigFile(oidcWith('groups'))])).toThrow(/claimMappings must be/);
    expect(() => resolve(['--config', writeConfigFile(oidcWith({ rules: [] }))])).toThrow(/claimPath/);
    expect(() => resolve(['--config', writeConfigFile(oidcWith({ claimPath: 'groups', rules: [] }))])).toThrow(
      /rules must be a non-empty array/,
    );
    expect(() =>
      resolve([
        '--config',
        writeConfigFile(oidcWith({ claimPath: 'groups', rules: [{ value: 'eng', workspaceId: 'w' }] })),
      ]),
    ).toThrow(/rules\[0\]\.role/);
    expect(() =>
      resolve([
        '--config',
        writeConfigFile(oidcWith({ claimPath: 'groups', rules: [{ value: '', workspaceId: 'w', role: 'viewer' }] })),
      ]),
    ).toThrow(/rules\[0\]\.value/);
  });
});

describe('resolveDaemonConfig — vault passphrase', () => {
  function writePassphraseFile(contents: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-daemon-vault-pass-'));
    tempDirs.push(dir);
    const file = path.join(dir, 'passphrase');
    fs.writeFileSync(file, contents);
    return file;
  }

  it('defaults to null and reads the env var', () => {
    expect(resolve().vaultPassphrase).toBeNull();
    expect(resolve([], { OH_DAEMON_VAULT_PASSPHRASE: 'hunter2' }).vaultPassphrase).toBe('hunter2');
  });

  it('reads a passphrase file, stripping only trailing newlines', () => {
    const file = writePassphraseFile('correct horse\n');
    expect(resolve([], { OH_DAEMON_VAULT_PASSPHRASE_FILE: file }).vaultPassphrase).toBe('correct horse');
    const windows = writePassphraseFile('pass\r\n');
    expect(resolve([], { OH_DAEMON_VAULT_PASSPHRASE_FILE: windows }).vaultPassphrase).toBe('pass');
  });

  it('refuses both sources set, empty values, and an unreadable file', () => {
    const file = writePassphraseFile('pass');
    expect(() => resolve([], { OH_DAEMON_VAULT_PASSPHRASE: 'a', OH_DAEMON_VAULT_PASSPHRASE_FILE: file })).toThrow(
      /both set/,
    );
    expect(() => resolve([], { OH_DAEMON_VAULT_PASSPHRASE: '' })).toThrow(/set but empty/);
    expect(() => resolve([], { OH_DAEMON_VAULT_PASSPHRASE_FILE: writePassphraseFile('\n') })).toThrow(/is empty/);
    expect(() => resolve([], { OH_DAEMON_VAULT_PASSPHRASE_FILE: `${file}.missing` })).toThrow(/cannot read/);
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

describe('resolveDaemonConfig — audit forwarding', () => {
  it('defaults to null and reads a full block from the file', () => {
    expect(resolve().auditForwarding).toBeNull();
    const file = writeConfigFile({
      auditForwarding: {
        url: 'https://siem.openheaders.io/ingest',
        headers: { Authorization: 'Bearer collector-token' },
        batchSize: 500,
        intervalMs: 2000,
      },
    });
    expect(resolve(['--config', file]).auditForwarding).toEqual({
      url: 'https://siem.openheaders.io/ingest',
      headers: { Authorization: 'Bearer collector-token' },
      batchSize: 500,
      intervalMs: 2000,
    });
  });

  it('a bare url is enough', () => {
    const file = writeConfigFile({ auditForwarding: { url: 'http://127.0.0.1:9880/ingest' } });
    expect(resolve(['--config', file]).auditForwarding).toEqual({ url: 'http://127.0.0.1:9880/ingest' });
  });

  it('refuses a malformed block', () => {
    expect(() => resolve(['--config', writeConfigFile({ auditForwarding: 'https://x' })])).toThrow(
      /auditForwarding must be a JSON object/,
    );
    expect(() => resolve(['--config', writeConfigFile({ auditForwarding: {} })])).toThrow(/auditForwarding\.url/);
    expect(() =>
      resolve(['--config', writeConfigFile({ auditForwarding: { url: 'ftp://siem.openheaders.io' } })]),
    ).toThrow(/must be http\(s\)/);
    expect(() =>
      resolve([
        '--config',
        writeConfigFile({ auditForwarding: { url: 'https://siem.openheaders.io', headers: { 'bad name': 'x' } } }),
      ]),
    ).toThrow(/headers\['bad name'\]/);
    expect(() =>
      resolve(['--config', writeConfigFile({ auditForwarding: { url: 'https://siem.openheaders.io', batchSize: 0 } })]),
    ).toThrow(/batchSize must be a positive integer/);
    expect(() =>
      resolve([
        '--config',
        writeConfigFile({ auditForwarding: { url: 'https://siem.openheaders.io', intervalMs: -5 } }),
      ]),
    ).toThrow(/intervalMs must be a positive number/);
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

  it('rejects a non-string licenseFile in the config file', () => {
    const file = writeConfigFile({ licenseFile: 42 });
    expect(() => resolve(['--config', file])).toThrow(/licenseFile/);
  });

  it('rejects a non-boolean licenseRefresh in the config file and a malformed env value', () => {
    const file = writeConfigFile({ licenseRefresh: 'off' });
    expect(() => resolve(['--config', file])).toThrow(/licenseRefresh/);
    expect(() => resolve([], { OH_LICENSE_REFRESH: 'yes' })).toThrow(/license refresh/);
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

describe('resolveConfigPath', () => {
  it('resolves explicit → env → the default data dir, always absolute', () => {
    expect(resolveConfigPath('/etc/openheaders/daemon.json', {}, 'linux', HOME)).toBe('/etc/openheaders/daemon.json');
    expect(resolveConfigPath(undefined, { OH_DAEMON_CONFIG: '/srv/oh/daemon.json' }, 'linux', HOME)).toBe(
      '/srv/oh/daemon.json',
    );
    expect(resolveConfigPath(undefined, {}, 'linux', HOME)).toBe(`${HOME}/.local/state/openheaders-daemon/daemon.json`);
  });
});

describe('updateDaemonConfigFile', () => {
  function tempConfigPath(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-daemon-update-'));
    tempDirs.push(dir);
    return path.join(dir, 'nested', 'daemon.json');
  }

  function readBack(configPath: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  }

  it('creates the file (and its directory) from the given update', () => {
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { bindAddress: '0.0.0.0', allowInsecureLan: true, bindPort: 9000 });
    expect(readBack(configPath)).toEqual({ bindAddress: '0.0.0.0', allowInsecureLan: true, bindPort: 9000 });
  });

  it('the written file resolves on its own — the exact posture of a unit that carries only --config', () => {
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { bindAddress: '0.0.0.0', allowInsecureLan: true });
    const config = resolveDaemonConfig({ argv: ['--config', configPath], env: {}, platform: 'linux', homedir: HOME });
    expect(config.bindAddress).toBe('0.0.0.0');
    expect(config.allowInsecureLan).toBe(true);
  });

  it('merges over the existing file, leaving omitted and unknown fields untouched', () => {
    const configPath = tempConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        bindPort: 9000,
        oidc: { issuer: 'https://sso.openheaders.io', clientId: 'oh-daemon' },
        futureField: 'kept',
      }),
    );
    updateDaemonConfigFile(configPath, { bindAddress: '0.0.0.0', trustedProxy: true });
    expect(readBack(configPath)).toEqual({
      bindPort: 9000,
      oidc: { issuer: 'https://sso.openheaders.io', clientId: 'oh-daemon' },
      futureField: 'kept',
      bindAddress: '0.0.0.0',
      trustedProxy: true,
    });
  });

  it('an explicit false clears a persisted boolean', () => {
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { trustedProxy: true });
    updateDaemonConfigFile(configPath, { trustedProxy: false });
    expect(readBack(configPath)).toEqual({ trustedProxy: false });
  });

  it('refuses an insecure merged posture BEFORE writing, whichever half arrives second', () => {
    const configPath = tempConfigPath();
    expect(() => updateDaemonConfigFile(configPath, { bindAddress: '0.0.0.0' })).toThrow(/cleartext/);
    expect(fs.existsSync(configPath)).toBe(false);

    updateDaemonConfigFile(configPath, { bindAddress: '0.0.0.0', allowInsecureLan: true });
    expect(() => updateDaemonConfigFile(configPath, { allowInsecureLan: false })).toThrow(/cleartext/);
    expect(readBack(configPath)).toEqual({ bindAddress: '0.0.0.0', allowInsecureLan: true });
  });

  it('refuses invalid values and a malformed existing file rather than persisting them', () => {
    const configPath = tempConfigPath();
    expect(() => updateDaemonConfigFile(configPath, { bindAddress: '192.168.1.10' })).toThrow(/bind address/);
    expect(() => updateDaemonConfigFile(configPath, { bindPort: 80 })).toThrow(/not bindable/);
    expect(() => updateDaemonConfigFile(configPath, { logLevel: 'verbose' })).toThrow(/log level/);
    expect(() => updateDaemonConfigFile(configPath, { allowedHosts: ['https://oh.openheaders.io'] })).toThrow(
      /bare hostname/,
    );
    expect(() => updateDaemonConfigFile(configPath, { proxy: { mode: 'pac' } })).toThrow(/not available on this tier/);
    expect(fs.existsSync(configPath)).toBe(false);

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, '[1,2,3]');
    expect(() => updateDaemonConfigFile(configPath, { bindPort: 9000 })).toThrow(/JSON object/);
  });

  it('normalizes allowed hosts and resolves paths before writing', () => {
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { allowedHosts: [' OH.openheaders.io '], dataDir: 'relative/data' });
    const written = readBack(configPath);
    expect(written.allowedHosts).toEqual(['oh.openheaders.io']);
    expect(path.isAbsolute(written.dataDir as string)).toBe(true);
  });

  it('replaces the proxy object wholesale — a mode change never strands stale manual fields', () => {
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { proxy: { mode: 'manual', url: 'corp.openheaders.io:8080' } });
    updateDaemonConfigFile(configPath, { proxy: { mode: 'env' } });
    expect(readBack(configPath).proxy).toEqual({ mode: 'env' });
  });

  it('creates the file owner-only — it may carry an OIDC client secret', () => {
    if (process.platform === 'win32') return;
    const configPath = tempConfigPath();
    updateDaemonConfigFile(configPath, { bindPort: 9000 });
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(configPath)).mode & 0o777).toBe(0o700);
  });
});

describe('resolveDaemonConfig — egress proxy (system plane)', () => {
  it('defaults to null — the stored slot or the tier default applies', () => {
    expect(resolve().systemProxy).toBeNull();
  });

  it('reads the proxy block from the file, manual shape mapped onto the settings slot', () => {
    const file = writeConfigFile({
      proxy: {
        mode: 'manual',
        url: 'corp.openheaders.io:8080',
        credentialRef: 'corp-proxy',
        bypassList: '.internal.openheaders.io,10.0.0.0/8',
      },
    });
    expect(resolve(['--config', file]).systemProxy).toEqual({
      version: 1,
      mode: 'manual',
      manualProxyUrl: 'corp.openheaders.io:8080',
      manualCredentialRef: 'corp-proxy',
      manualBypassList: '.internal.openheaders.io,10.0.0.0/8',
    });
  });

  it('resolves the mode through argv → env → file', () => {
    const file = writeConfigFile({ proxy: { mode: 'off' } });
    expect(resolve(['--config', file]).systemProxy).toEqual({ version: 1, mode: 'off' });
    expect(resolve(['--config', file], { OH_DAEMON_PROXY_MODE: 'env' }).systemProxy).toEqual({
      version: 1,
      mode: 'env',
    });
    expect(resolve(['--config', file, '--proxy-mode', 'off'], { OH_DAEMON_PROXY_MODE: 'env' }).systemProxy).toEqual({
      version: 1,
      mode: 'off',
    });
  });

  it('refuses pac and system with the honest error naming env and manual', () => {
    expect(() => resolve(['--proxy-mode', 'pac'])).toThrow(/'pac' is not available on this tier.*'env'.*'manual'/s);
    expect(() => resolve([], { OH_DAEMON_PROXY_MODE: 'system' })).toThrow(/'system' is not available on this tier/);
  });

  it('refuses an unknown mode naming the tier vocabulary', () => {
    expect(() => resolve(['--proxy-mode', 'auto'])).toThrow(/one of off, env, manual — got 'auto'/);
  });

  it('ties the manual fields to the manual mode, both directions', () => {
    expect(() => resolve(['--proxy-mode', 'manual'])).toThrow(/needs a proxy URL/);
    expect(() => resolve(['--proxy-url', 'corp:8080'])).toThrow(/set proxy mode 'manual'/);
    expect(() => resolve(['--proxy-mode', 'env', '--proxy-url', 'corp:8080'])).toThrow(
      /URL only applies to mode 'manual'/,
    );
    expect(() => resolve(['--proxy-mode', 'off', '--proxy-bypass', '*'])).toThrow(
      /bypass list only applies to mode 'manual'/,
    );
  });

  it('rejects a malformed proxy block in the config file', () => {
    expect(() => resolve(['--config', writeConfigFile({ proxy: 'corp:8080' })])).toThrow(/proxy must be a JSON object/);
    expect(() => resolve(['--config', writeConfigFile({ proxy: { url: 42 } })])).toThrow(/proxy\.url/);
  });
});
