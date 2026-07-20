/**
 * `oh autoupdate` — show/persist the background self-update switch in
 * the CLI config. Local command, same merge law as `oh channel`:
 * absent reads `on`, a set owns only its own key, and anything outside
 * on|off is a usage error.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandAutoUpdate } from '../../src/commands';
import { readCliConfig } from '../../src/config-store';
import { UsageError } from '../../src/exit-codes';

let dir: string;
let configFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-autoupdate-'));
  configFile = path.join(dir, 'openheaders', 'cli.json');
  vi.stubEnv('XDG_CONFIG_HOME', dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe('commandAutoUpdate', () => {
  it('reads on when no config exists', async () => {
    expect(await commandAutoUpdate([])).toEqual(['on']);
  });

  it('sets off and reads it back, naming the saved path', async () => {
    expect(await commandAutoUpdate(['off'])).toEqual(['auto-update turned off', `saved to ${configFile}`]);
    expect(await commandAutoUpdate([])).toEqual(['off']);
    expect(await commandAutoUpdate(['on'])).toEqual(['auto-update turned on', `saved to ${configFile}`]);
    expect(await commandAutoUpdate([])).toEqual(['on']);
  });

  it('merges over the existing config instead of replacing it', async () => {
    await mkdir(path.dirname(configFile), { recursive: true });
    await writeFile(configFile, JSON.stringify({ daemonUrl: 'https://daemon.openheaders.io', channel: 'beta' }));
    await commandAutoUpdate(['off']);
    expect(await readCliConfig(configFile)).toEqual({
      daemonUrl: 'https://daemon.openheaders.io',
      channel: 'beta',
      autoUpdate: false,
    });
  });

  it('emits the --json shape on read and set', async () => {
    expect(await commandAutoUpdate(['--json'])).toEqual([JSON.stringify({ autoUpdate: true }, null, 2)]);
    expect(await commandAutoUpdate(['off', '--json'])).toEqual([JSON.stringify({ autoUpdate: false }, null, 2)]);
  });

  it('rejects values outside on|off and extra positionals as usage errors', async () => {
    await expect(commandAutoUpdate(['yes'])).rejects.toThrow(UsageError);
    await expect(commandAutoUpdate(['on', 'off'])).rejects.toThrow(UsageError);
  });
});
