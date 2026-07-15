/**
 * CLI product-telemetry adapter (`TELEMETRY_PLAN.md` §2/§7) — the
 * OH_TELEMETRY/config gate matrix, the once-only first-run notice as
 * the disclosure, the `session_start` envelope one invocation earns,
 * and the never-break-the-command failure posture.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { TelemetryEnvelope } from '@openheaders/core/telemetry';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bootCliProductTelemetry, readTelemetryEnabled, TELEMETRY_NOTICE } from '../../src/product-telemetry';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-cli-telemetry-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

interface RigOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  cliVersion?: string;
  accept?: boolean;
}

async function makeRig(options: RigOptions = {}) {
  const configPath = path.join(dir, 'openheaders', 'cli.json');
  const sent: TelemetryEnvelope[] = [];
  const notices: string[] = [];
  const boot = () =>
    bootCliProductTelemetry({
      env: options.env ?? {},
      platform: options.platform ?? 'darwin',
      cliVersion: options.cliVersion ?? '2026.7.2',
      notify: (line) => notices.push(line),
      configPath,
      transport: {
        async send(envelope) {
          sent.push(envelope);
          return options.accept !== false;
        },
      },
      now: () => 1_760_000_000_000,
    });
  return { boot, sent, notices, configPath };
}

async function writeConfig(configPath: string, config: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config));
}

describe('readTelemetryEnabled', () => {
  it('defaults on with no env and no config key', () => {
    expect(readTelemetryEnabled({}, undefined)).toBe(true);
  });

  it('turns off via OH_TELEMETRY=0 / false / off, case-insensitively', () => {
    for (const value of ['0', 'false', 'off', 'FALSE', 'Off']) {
      expect(readTelemetryEnabled({ OH_TELEMETRY: value }, undefined)).toBe(false);
    }
  });

  it('turns off via the config key', () => {
    expect(readTelemetryEnabled({}, false)).toBe(false);
  });

  it('a set env var overrides the config key both ways', () => {
    expect(readTelemetryEnabled({ OH_TELEMETRY: '1' }, false)).toBe(true);
    expect(readTelemetryEnabled({ OH_TELEMETRY: '0' }, true)).toBe(false);
  });

  it('ignores an empty env value', () => {
    expect(readTelemetryEnabled({ OH_TELEMETRY: '' }, false)).toBe(false);
  });
});

describe('bootCliProductTelemetry — first-run notice', () => {
  it('prints the signed notice once and persists the flag', async () => {
    const { boot, notices, configPath } = await makeRig();
    await boot();
    expect(notices).toEqual([TELEMETRY_NOTICE]);
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toMatchObject({ telemetryNoticeShown: true });

    await boot();
    expect(notices).toHaveLength(1);
  });

  it('keeps existing config keys when persisting the flag', async () => {
    const { boot, configPath } = await makeRig();
    await writeConfig(configPath, { daemonUrl: 'https://daemon.openheaders.io', token: 'oh_secret' });
    await boot();
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
      daemonUrl: 'https://daemon.openheaders.io',
      token: 'oh_secret',
      telemetryNoticeShown: true,
    });
  });

  it('never prints when the channel is off — nothing is collected, nothing to disclose', async () => {
    const { boot, notices, sent, configPath } = await makeRig({ env: { OH_TELEMETRY: '0' } });
    const handle = await boot();
    await handle.finish();
    expect(notices).toEqual([]);
    expect(sent).toEqual([]);
    await expect(readFile(configPath, 'utf8')).rejects.toThrow();
  });
});

describe('bootCliProductTelemetry — session_start', () => {
  it('flushes one session_start with the cli identity on finish', async () => {
    const { boot, sent } = await makeRig();
    const handle = await boot();
    await handle.finish();
    expect(sent).toHaveLength(1);
    expect(sent[0].sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(sent[0].events).toEqual([
      {
        name: 'session_start',
        host: 'cli',
        appVersion: { year: 2026, month: 7, patch: 2 },
        platform: 'mac',
        locale: 'en',
      },
    ]);
  });

  it('sends nothing when the config key opts out', async () => {
    const { boot, sent, configPath } = await makeRig();
    await writeConfig(configPath, { telemetry: false });
    const handle = await boot();
    await handle.finish();
    expect(sent).toEqual([]);
  });

  it('skips the event on unmappable platforms instead of misreporting', async () => {
    const { boot, sent } = await makeRig({ platform: 'freebsd' });
    const handle = await boot();
    await handle.finish();
    expect(sent).toEqual([]);
  });

  it('maps the dev version stamp to zeros rather than failing', async () => {
    const { boot, sent } = await makeRig({ cliVersion: 'dev' });
    const handle = await boot();
    await handle.finish();
    expect(sent[0].events[0]).toMatchObject({ appVersion: { year: 0, month: 0, patch: 0 } });
  });
});

describe('bootCliProductTelemetry — failure posture', () => {
  it('treats a malformed config file as empty and never overwrites it', async () => {
    const { boot, notices, configPath } = await makeRig();
    await writeConfig(configPath, {});
    await writeFile(configPath, 'not json');
    const handle = await boot();
    await handle.finish();
    expect(notices).toEqual([TELEMETRY_NOTICE]);
    // The command's own config read raises the loud fix-or-delete error;
    // the user's content must survive for that.
    expect(await readFile(configPath, 'utf8')).toBe('not json');
  });

  it('finish() swallows a transport that rejects', async () => {
    const configPath = path.join(dir, 'openheaders', 'cli.json');
    const handle = await bootCliProductTelemetry({
      env: {},
      platform: 'linux',
      cliVersion: '2026.7.2',
      notify: () => undefined,
      configPath,
      transport: {
        async send() {
          throw new Error('offline');
        },
      },
      now: () => 1_760_000_000_000,
    });
    await expect(handle.finish()).resolves.toBeUndefined();
  });
});
