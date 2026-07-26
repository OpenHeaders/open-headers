/**
 * CLI provisioning laws — provision writes `{daemonUrl, token}` into
 * `cli.json` preserving every other key (the `oh connect` ownership
 * law), 0600 file mode, secret-on-disk-only; re-provision rotates the
 * remembered token instead of accumulating ledger rows; a malformed
 * file is refused without minting; status is derived live against the
 * ledger (configured / stale / external / malformed / unconfigured)
 * and never bumps `lastUsedAt`.
 */

import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { listDaemonAuthTokens, revokeDaemonAuthToken } from '@openheaders/core/identity';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliProvisionService, createCliProvisionService } from '../../../src/daemon/cli-provision';
import { createHostStorageFake } from '../_host-storage-fake';

const PORT = 59321;

let dir: string;
let evicted: string[];
let service: CliProvisionService;

function configFile(): string {
  return path.join(dir, 'openheaders', 'cli.json');
}

async function readConfigJson(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(configFile(), 'utf8')) as Record<string, unknown>;
}

beforeEach(async () => {
  setHostStorage(createHostStorageFake());
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-provision-'));
  evicted = [];
  service = createCliProvisionService({
    getBoundPort: () => PORT,
    closePeersByTokenId: (tokenId) => evicted.push(tokenId),
    env: { XDG_CONFIG_HOME: dir },
    hostname: 'testhost',
    // Deterministic probe — the default spawns the machine's real login
    // shell, which would answer for the dev box, not the test.
    probeLoginShell: async () => false,
  });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('provision', () => {
  it('fresh machine: mints a hostname-labeled token and writes the connection pair, mode 0600', async () => {
    const result = await service.provision();
    if (!result.ok) throw new Error(result.error);
    expect(result.configPath).toBe(configFile());

    const written = await readConfigJson();
    expect(written.daemonUrl).toBe(`http://127.0.0.1:${PORT}`);
    expect(typeof written.token).toBe('string');
    expect(written.token as string).toMatch(/^oh_/);

    const tokens = await listDaemonAuthTokens();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].id).toBe(result.tokenId);
    expect(tokens[0].label).toBe('CLI — testhost');
    expect(tokens[0].kind).toBe('apiToken');
    expect(tokens[0].revokedAt).toBeNull();

    expect(await hostStorage.get(OH.cliProvision)).toMatchObject({ tokenId: result.tokenId });

    if (process.platform !== 'win32') {
      expect((await stat(configFile())).mode & 0o777).toBe(0o600);
    }
  });

  it('merge law: telemetry and channel keys ride over untouched', async () => {
    await service.provision();
    const before = await readConfigJson();
    await writeFile(
      configFile(),
      JSON.stringify({ ...before, channel: 'beta', telemetry: false, telemetryInstallId: 'abc' }),
    );
    const result = await service.provision();
    if (!result.ok) throw new Error(result.error);
    const after = await readConfigJson();
    expect(after.channel).toBe('beta');
    expect(after.telemetry).toBe(false);
    expect(after.telemetryInstallId).toBe('abc');
    expect(after.token).not.toBe(before.token);
  });

  it('rotate-not-accumulate: re-provision revokes and evicts the prior token', async () => {
    const first = await service.provision();
    const second = await service.provision();
    if (!first.ok || !second.ok) throw new Error('setup failed');
    expect(second.tokenId).not.toBe(first.tokenId);

    const tokens = await listDaemonAuthTokens();
    expect(tokens).toHaveLength(2);
    const active = tokens.filter((t) => t.revokedAt === null);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second.tokenId);
    expect(evicted).toEqual([first.tokenId]);
  });

  it('malformed file: refuses with a path-naming error and mints nothing', async () => {
    await mkdir(path.dirname(configFile()), { recursive: true });
    await writeFile(configFile(), 'not json');
    const result = await service.provision();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(configFile());
    expect(await listDaemonAuthTokens()).toHaveLength(0);
    expect(await readFile(configFile(), 'utf8')).toBe('not json');
  });
});

describe('status', () => {
  it('missing file reads unconfigured', async () => {
    expect(await service.status()).toEqual({
      configPath: configFile(),
      state: 'unconfigured',
      binaryInstalled: false,
      hostPlatform: process.platform,
    });
  });

  it('after provision reads configured with the ledger row, without bumping lastUsedAt', async () => {
    const result = await service.provision();
    if (!result.ok) throw new Error(result.error);
    const status = await service.status();
    expect(status.state).toBe('configured');
    expect(status.tokenId).toBe(result.tokenId);
    expect(status.label).toBe('CLI — testhost');
    const [token] = await listDaemonAuthTokens();
    expect(token.lastUsedAt).toBeNull();
  });

  it('a revoked provisioned token reads stale', async () => {
    const result = await service.provision();
    if (!result.ok) throw new Error(result.error);
    await revokeDaemonAuthToken(result.tokenId);
    expect((await service.status()).state).toBe('stale');
  });

  it('an unknown token next to a foreign daemonUrl reads external', async () => {
    await mkdir(path.dirname(configFile()), { recursive: true });
    await writeFile(
      configFile(),
      JSON.stringify({ daemonUrl: 'http://daemon.openheaders.io:59210', token: 'oh_someoneelses' }),
    );
    const status = await service.status();
    expect(status.state).toBe('external');
    expect(status.daemonUrl).toBe('http://daemon.openheaders.io:59210');
  });

  it('an unknown token next to a loopback daemonUrl on our port reads stale', async () => {
    await mkdir(path.dirname(configFile()), { recursive: true });
    await writeFile(configFile(), JSON.stringify({ daemonUrl: `http://localhost:${PORT}`, token: 'oh_gone' }));
    expect((await service.status()).state).toBe('stale');
  });

  it('a malformed file reads malformed with the parse error', async () => {
    await mkdir(path.dirname(configFile()), { recursive: true });
    await writeFile(configFile(), '[1,2]');
    const status = await service.status();
    expect(status.state).toBe('malformed');
    expect(status.error).toContain('not a JSON object');
  });

  it('a file without a token reads unconfigured', async () => {
    await mkdir(path.dirname(configFile()), { recursive: true });
    await writeFile(configFile(), JSON.stringify({ telemetry: false }));
    expect((await service.status()).state).toBe('unconfigured');
  });
});

describe('binary probe', () => {
  function serviceWith(
    env: Record<string, string | undefined>,
    platform: string,
    probeLoginShell: (shell: string) => Promise<boolean> = async () => false,
  ): CliProvisionService {
    return createCliProvisionService({
      getBoundPort: () => PORT,
      closePeersByTokenId: () => {},
      env: { XDG_CONFIG_HOME: dir, ...env },
      platform,
      hostname: 'testhost',
      probeLoginShell,
    });
  }

  it('posix: a login shell that resolves oh reads binaryInstalled true, with the probed shell', async () => {
    const shells: string[] = [];
    const probe = serviceWith({ SHELL: '/bin/zsh' }, 'darwin', async (shell) => {
      shells.push(shell);
      return true;
    });
    const status = await probe.status();
    expect(status.binaryInstalled).toBe(true);
    expect(status.hostPlatform).toBe('darwin');
    expect(shells).toEqual(['/bin/zsh']);
  });

  it('posix: a blind login shell falls back to the env PATH scan', async () => {
    const bin = path.join(dir, 'bin');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'oh'), '');
    const probe = serviceWith({ PATH: `/nowhere:${bin}` }, 'linux');
    const status = await probe.status();
    expect(status.binaryInstalled).toBe(true);
    expect(status.hostPlatform).toBe('linux');
  });

  it('win32 resolves PATHEXT-derived names over a ;-delimited PATH', async () => {
    const bin = path.join(dir, 'bin');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'oh.exe'), '');
    const probe = serviceWith({ PATH: `C:\\nowhere;${bin}`, PATHEXT: '.COM;.EXE;.BAT;.CMD' }, 'win32');
    expect((await probe.status()).binaryInstalled).toBe(true);
  });

  it('a bare oh file does not satisfy win32 — an executable needs a PATHEXT name', async () => {
    const bin = path.join(dir, 'bin');
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, 'oh'), '');
    const probe = serviceWith({ PATH: bin }, 'win32');
    expect((await probe.status()).binaryInstalled).toBe(false);
  });
});
