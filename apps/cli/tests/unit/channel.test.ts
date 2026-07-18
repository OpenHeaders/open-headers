/**
 * `oh channel` — show/persist the update channel in the CLI config.
 * Local command, no daemon round-trip; absent config reads `stable`,
 * a set merges over the existing file (never touches the connection
 * pair or telemetry keys), and anything outside stable|beta is a
 * usage error.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commandChannel } from '../../src/commands';
import { readCliConfig } from '../../src/config-store';
import { UsageError } from '../../src/exit-codes';

let dir: string;
let configFile: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-channel-'));
  configFile = path.join(dir, 'openheaders', 'cli.json');
  vi.stubEnv('XDG_CONFIG_HOME', dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe('commandChannel', () => {
  it('reads stable when no config exists', async () => {
    expect(await commandChannel([])).toEqual(['stable']);
  });

  it('sets and reads back beta, naming the saved path', async () => {
    expect(await commandChannel(['beta'])).toEqual(['channel set to beta', `saved to ${configFile}`]);
    expect(await commandChannel([])).toEqual(['beta']);
  });

  it('merges over the existing config instead of replacing it', async () => {
    await mkdir(path.dirname(configFile), { recursive: true });
    await writeFile(configFile, JSON.stringify({ daemonUrl: 'https://daemon.openheaders.io', token: 'oh_x' }));
    await commandChannel(['beta']);
    expect(await readCliConfig(configFile)).toEqual({
      daemonUrl: 'https://daemon.openheaders.io',
      token: 'oh_x',
      channel: 'beta',
    });
  });

  it('emits the --json shape on read and set', async () => {
    expect(await commandChannel(['--json'])).toEqual([JSON.stringify({ channel: 'stable' }, null, 2)]);
    expect(await commandChannel(['beta', '--json'])).toEqual([JSON.stringify({ channel: 'beta' }, null, 2)]);
  });

  it('rejects a channel outside stable|beta and extra positionals as usage errors', async () => {
    await expect(commandChannel(['nightly'])).rejects.toThrow(UsageError);
    await expect(commandChannel(['stable', 'beta'])).rejects.toThrow(UsageError);
  });
});
