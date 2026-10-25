import { OH, type StorageKey } from '@openheaders/core/storage';
import type { TelemetryEnvelope } from '@openheaders/core/telemetry';
import { describe, expect, it } from 'vitest';
import { installProductTelemetry, type ProductTelemetryHostDeps } from '../../../src/main/product-telemetry';

interface RigOptions {
  settings?: Record<string, unknown>;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  translated?: boolean;
  systemVersion?: string;
  appVersion?: string;
  locale?: string;
  backends?: Array<{ url: string }>;
  treeBindings?: Array<{ workspaceId: string }>;
}

function makeRig(options: RigOptions = {}) {
  const sent: TelemetryEnvelope[] = [];
  const values = new Map<string, unknown>([
    [OH.settingsUser.key, options.settings],
    [OH.backends.key, options.backends],
    [OH.workspaceTreeBindings.key, options.treeBindings],
  ]);
  const listeners = new Map<string, Array<(next: unknown) => void>>();

  const storage: ProductTelemetryHostDeps['storage'] = {
    get: async <T>(spec: StorageKey<T>) => values.get(spec.key) as T | undefined,
    set: async (spec, value) => {
      values.set(spec.key, value);
    },
    remove: async (spec) => {
      for (const one of Array.isArray(spec) ? spec : [spec]) values.delete(one.key);
    },
    subscribe: <T>(spec: StorageKey<T>, fn: (next: T | undefined) => void) => {
      const bucket = listeners.get(spec.key) ?? [];
      bucket.push(fn as (next: unknown) => void);
      listeners.set(spec.key, bucket);
      return () => undefined;
    },
  };
  const write = (spec: StorageKey<unknown>, value: unknown): void => {
    values.set(spec.key, value);
    for (const fn of listeners.get(spec.key) ?? []) fn(value);
  };

  const install = () =>
    installProductTelemetry({
      storage,
      appVersion: options.appVersion ?? '2026.7.1',
      platform: options.platform ?? 'darwin',
      arch: options.arch ?? 'arm64',
      runningUnderArm64Translation: options.translated ?? false,
      systemVersion: options.systemVersion ?? '15.1',
      channel: 'github-release',
      locale: () => options.locale ?? 'en',
      transport: {
        async send(envelope) {
          sent.push(envelope);
          return true;
        },
      },
      now: () => 1_760_000_000_000,
    });

  return { install, sent, write, values };
}

// track() is fire-and-forget; settle the microtask queue before reading.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('installProductTelemetry — session_start', () => {
  it('fires once at boot with the desktop identity and mapped platform, after first_run on a fresh install', async () => {
    const { install, sent } = makeRig();
    const handle = await install();
    await handle.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].host).toBe('desktop');
    expect(sent[0].channel).toBe('github-release');
    expect(sent[0].appVersion).toEqual({ year: 2026, month: 7, patch: 1 });
    expect(sent[0].platform).toBe('mac');
    expect(sent[0].arch).toBe('arm64');
    expect(sent[0].locale).toBe('en');
    expect(sent[0].installId).toMatch(/^[0-9a-f]{32}$/);
    expect(sent[0].sinceInstall).toBe('0');
    expect(sent[0].events).toEqual([{ name: 'first_run' }, { name: 'session_start' }]);

    // A second flush sends nothing — the latch holds for the process lifetime.
    await handle.flush();
    expect(sent).toHaveLength(1);
    handle.dispose();
  });

  it('keeps the install id across launches and never repeats first_run', async () => {
    const { install, sent } = makeRig();
    const first = await install();
    await first.flush();
    first.dispose();

    // Same storage, fresh process = a second launch with a new session.
    const second = await install();
    await second.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].installId).toBe(sent[0].installId);
    expect(sent[1].sessionId).not.toBe(sent[0].sessionId);
    expect(sent[1].events).toEqual([expect.objectContaining({ name: 'session_start' })]);
    second.dispose();
  });

  it('skips the event on unmappable platforms instead of misreporting (first_run still counts the install)', async () => {
    const { install, sent } = makeRig({ platform: 'freebsd' });
    const handle = await install();
    await handle.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toEqual([{ name: 'first_run' }]);
    expect('platform' in sent[0]).toBe(false);
    handle.dispose();
  });

  it('maps win32 and linux onto the envelope platform fact', async () => {
    for (const [node, wire] of [
      ['win32', 'win'],
      ['linux', 'linux'],
    ] as const) {
      const { install, sent } = makeRig({ platform: node });
      const handle = await install();
      await handle.flush();
      expect(sent[0].platform).toBe(wire);
      handle.dispose();
    }
  });

  it('stamps the architecture fact — an x64 build under arm64 translation by name, unlisted architectures unstamped', async () => {
    for (const [arch, translated, wire] of [
      ['x64', false, 'x64'],
      ['x64', true, 'x64-on-arm64'],
      ['arm64', false, 'arm64'],
    ] as const) {
      const { install, sent } = makeRig({ platform: 'win32', arch, translated });
      const handle = await install();
      await handle.flush();
      expect(sent[0].arch).toBe(wire);
      handle.dispose();
    }
    const { install, sent } = makeRig({ arch: 'ia32' });
    const handle = await install();
    await handle.flush();
    expect('arch' in sent[0]).toBe(false);
    handle.dispose();
  });

  it('stamps the OS major as people know it — macOS as read, Windows 11 by build, Linux never (S35)', async () => {
    for (const [platform, systemVersion, wire] of [
      ['darwin', '15.1', 15],
      ['darwin', '26.0.1', 26],
      ['win32', '10.0.22631', 11],
      ['win32', '10.0.19045', 10],
    ] as const) {
      const { install, sent } = makeRig({ platform, systemVersion });
      const handle = await install();
      await handle.flush();
      expect(sent[0].osVersion).toBe(wire);
      expect('browserVersion' in sent[0]).toBe(false);
      handle.dispose();
    }
    const { install, sent } = makeRig({ platform: 'linux', systemVersion: '6.8.0-45-generic' });
    const handle = await install();
    await handle.flush();
    expect('osVersion' in sent[0]).toBe(false);
    handle.dispose();
  });

  it('carries the install-wide sync kind on the state block — server over git over local, the loopback desktop wire never a server (S35)', async () => {
    const cases: Array<[RigOptions, string]> = [
      [{}, 'local'],
      [{ backends: [{ url: 'ws://127.0.0.1:8137' }] }, 'local'],
      [{ treeBindings: [{ workspaceId: 'ws-a' }] }, 'git'],
      [{ backends: [{ url: 'wss://sync.openheaders.io' }], treeBindings: [{ workspaceId: 'ws-a' }] }, 'server'],
      [{ backends: [{ url: 'ws://127.0.0.1:8137' }, { url: 'ws://192.168.1.20:8137' }] }, 'server'],
    ];
    for (const [options, sync] of cases) {
      const { install, sent } = makeRig(options);
      const handle = await install();
      await handle.flush();
      expect(sent[0].events).toContainEqual({ name: 'session_start' });
      expect(sent[0].schemaVersion === 3 ? sent[0].state.sync : null).toBe(sync);
      handle.dispose();
    }
  });

  it('stamps the state block from the storage readings and the license slot — free without a license (the v2 plan §3)', async () => {
    const { install, sent } = makeRig({ backends: [{ url: 'wss://sync.openheaders.io' }] });
    const handle = await install();
    await handle.flush();
    expect(sent[0].schemaVersion).toBe(3);
    expect(sent[0].schemaVersion === 3 ? sent[0].state : null).toEqual({
      stage: 'installed',
      rules: '0',
      requests: '0',
      workspaces: '0',
      sync: 'server',
      plan: 'free',
      profile: 'none',
      activeDays: '1',
      migratedFrom: 'none',
    });
    handle.dispose();
  });

  it('stamps the resolved interface locale, mapping codes outside the vocabulary to other', async () => {
    for (const [resolved, wire] of [
      ['zh-CN', 'zh-CN'],
      ['pseudo', 'other'],
    ] as const) {
      const { install, sent } = makeRig({ locale: resolved });
      const handle = await install();
      await handle.flush();
      expect(sent[0].locale).toBe(wire);
      handle.dispose();
    }
  });
});

describe('installProductTelemetry — enabled gate', () => {
  it('defaults on when the settings blob is absent or silent about the key', async () => {
    const { install, sent } = makeRig({ settings: { 'appearance.theme': 'dark' } });
    const handle = await install();
    await handle.flush();
    expect(sent).toHaveLength(1);
    handle.dispose();
  });

  it('respects telemetry.enabled=false at boot and suppresses everything', async () => {
    const { install, sent } = makeRig({ settings: { 'telemetry.enabled': false } });
    const handle = await install();
    handle.track({ name: 'workflow_run', ok: true });
    await handle.flush();
    expect(sent).toEqual([]);
    const snapshot = await handle.snapshot();
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.entries.every((entry) => entry.disposition === 'suppressed')).toBe(true);
    handle.dispose();
  });

  it('kills the channel live when the settings blob flips the toggle off', async () => {
    const { install, sent, write } = makeRig();
    const handle = await install();
    await handle.flush();
    expect(sent).toHaveLength(1);

    write(OH.settingsUser, { 'telemetry.enabled': false });
    handle.track({ name: 'rule_created', ruleType: 'header' });
    await handle.flush();
    expect(sent).toHaveLength(1);

    write(OH.settingsUser, { 'telemetry.enabled': true });
    handle.track({ name: 'rule_created', ruleType: 'redirect' });
    await handle.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].events).toEqual([{ name: 'rule_created', ruleType: 'redirect' }]);
    // Toggle-off wiped the identity; re-enable minted a fresh one, without a second first_run.
    expect(sent[1].installId).toMatch(/^[0-9a-f]{32}$/);
    expect(sent[1].installId).not.toBe(sent[0].installId);
    handle.dispose();
  });

  it('wipes the persisted identity record on toggle-off', async () => {
    const { install, write, values } = makeRig();
    const handle = await install();
    expect(values.get(OH.productTelemetryInstall.key)).toBeDefined();
    write(OH.settingsUser, { 'telemetry.enabled': false });
    await handle.snapshot();
    expect(values.get(OH.productTelemetryInstall.key)).toBeUndefined();
    expect(values.get(OH.productTelemetryFirstRunSent.key)).toBe(true);
    handle.dispose();
  });
});

describe('installProductTelemetry — inspector snapshot', () => {
  it('exposes the session log including suppressed while-disabled events', async () => {
    const { install } = makeRig({ settings: { 'telemetry.enabled': false } });
    const handle = await install();
    handle.track({ name: 'feature_used', feature: 'variables' });
    // track() consults the session-store latch before logging; settle
    // the microtask queue so the snapshot read observes the entry.
    await settle();
    const snapshot = await handle.snapshot();
    expect(snapshot.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(snapshot.entries).toEqual([
      { event: { name: 'session_start' }, at: 1_760_000_000_000, disposition: 'suppressed' },
      { event: { name: 'feature_used', feature: 'variables' }, at: 1_760_000_000_000, disposition: 'suppressed' },
    ]);
    handle.dispose();
  });
});
