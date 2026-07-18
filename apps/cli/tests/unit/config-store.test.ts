/**
 * Config file round-trip — missing file is an empty config, writes are
 * 0600 (the file holds a daemon token), malformed content is a loud
 * error naming the path, unknown keys are dropped on read.
 */

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cliConfigPath, readCliConfig, writeCliConfig } from '../../src/config-store';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-config-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('cliConfigPath', () => {
  // Expectations go through path.join like the code does — the
  // platform argument selects the APPDATA rule, not the separator,
  // so literal '/'-joined strings would fail on a Windows host.
  it('prefers XDG_CONFIG_HOME', () => {
    expect(cliConfigPath({ XDG_CONFIG_HOME: '/xdg' }, '/home/oh')).toBe(path.join('/xdg', 'openheaders', 'cli.json'));
  });

  it('falls back to ~/.config', () => {
    expect(cliConfigPath({}, '/home/oh')).toBe(path.join('/home/oh', '.config', 'openheaders', 'cli.json'));
  });

  it('ignores an empty XDG_CONFIG_HOME', () => {
    expect(cliConfigPath({ XDG_CONFIG_HOME: '' }, '/home/oh')).toBe(
      path.join('/home/oh', '.config', 'openheaders', 'cli.json'),
    );
  });

  it('uses %APPDATA% on Windows', () => {
    expect(cliConfigPath({ APPDATA: 'C:\\Users\\oh\\AppData\\Roaming' }, 'C:\\Users\\oh', 'win32')).toBe(
      path.join('C:\\Users\\oh\\AppData\\Roaming', 'openheaders', 'cli.json'),
    );
  });

  it('XDG_CONFIG_HOME wins over %APPDATA% on Windows — the relocation escape hatch', () => {
    expect(cliConfigPath({ XDG_CONFIG_HOME: '/xdg', APPDATA: 'C:\\Roaming' }, 'C:\\Users\\oh', 'win32')).toBe(
      path.join('/xdg', 'openheaders', 'cli.json'),
    );
  });

  it('falls back to ~/.config on Windows without APPDATA', () => {
    expect(cliConfigPath({}, 'C:\\Users\\oh', 'win32')).toBe(
      path.join('C:\\Users\\oh', '.config', 'openheaders', 'cli.json'),
    );
  });

  it('never uses APPDATA off Windows', () => {
    expect(cliConfigPath({ APPDATA: '/roaming' }, '/home/oh', 'linux')).toBe(
      path.join('/home/oh', '.config', 'openheaders', 'cli.json'),
    );
  });
});

describe('readCliConfig / writeCliConfig', () => {
  it('reads a missing file as an empty config', async () => {
    expect(await readCliConfig(path.join(dir, 'nope', 'cli.json'))).toEqual({});
  });

  it('round-trips and creates parent directories', async () => {
    const file = path.join(dir, 'openheaders', 'cli.json');
    const config = { daemonUrl: 'https://daemon.openheaders.io', token: 'oh_secret', channel: 'beta' as const };
    await writeCliConfig(file, config);
    expect(await readCliConfig(file)).toEqual(config);
  });

  it('drops a channel value outside stable|beta', async () => {
    const file = path.join(dir, 'cli.json');
    await writeFile(file, JSON.stringify({ channel: 'nightly' }));
    expect(await readCliConfig(file)).toEqual({});
  });

  // The 0600 mode is a no-op on Windows, where the profile dir's ACL
  // is the protection (config-store.ts header) — nothing to assert.
  it.runIf(process.platform !== 'win32')('writes the file mode 0600', async () => {
    const file = path.join(dir, 'cli.json');
    await writeCliConfig(file, { token: 'oh_secret' });
    const mode = (await stat(file)).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('throws a path-naming error on malformed JSON', async () => {
    const file = path.join(dir, 'cli.json');
    await writeFile(file, 'not json');
    await expect(readCliConfig(file)).rejects.toThrow(file);
  });

  it('throws when the file is JSON but not an object', async () => {
    const file = path.join(dir, 'cli.json');
    await writeFile(file, '[1,2]');
    await expect(readCliConfig(file)).rejects.toThrow('not a JSON object');
  });

  it('drops unknown and mistyped keys on read', async () => {
    const file = path.join(dir, 'cli.json');
    await writeFile(file, JSON.stringify({ daemonUrl: 7, token: 'oh_x', extra: true }));
    expect(await readCliConfig(file)).toEqual({ token: 'oh_x' });
    expect(JSON.parse(await readFile(file, 'utf8'))).toHaveProperty('extra');
  });
});
