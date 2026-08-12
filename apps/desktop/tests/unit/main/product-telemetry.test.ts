import { OH, type StorageKey } from '@openheaders/core/storage';
import type { TelemetryEnvelope } from '@openheaders/core/telemetry';
import { describe, expect, it } from 'vitest';
import { installProductTelemetry, type ProductTelemetryHostDeps } from '../../../src/main/product-telemetry';

interface RigOptions {
  settings?: Record<string, unknown>;
  platform?: NodeJS.Platform;
  appVersion?: string;
}

function makeRig(options: RigOptions = {}) {
  const sent: TelemetryEnvelope[] = [];
  const values = new Map<string, unknown>([[OH.settingsUser.key, options.settings]]);
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
      channel: 'github-release',
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
    expect(sent[0].installId).toMatch(/^[0-9a-f]{32}$/);
    expect(sent[0].sinceInstall).toBe('0');
    expect(sent[0].events).toEqual([
      { name: 'first_run', channel: 'github-release' },
      {
        name: 'session_start',
        appVersion: { year: 2026, month: 7, patch: 1 },
        platform: 'mac',
        locale: 'en',
      },
    ]);

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
    expect(sent[0].events).toEqual([{ name: 'first_run', channel: 'github-release' }]);
    handle.dispose();
  });

  it('maps win32 and linux to their vocabulary members', async () => {
    for (const [node, wire] of [
      ['win32', 'win'],
      ['linux', 'linux'],
    ] as const) {
      const { install, sent } = makeRig({ platform: node });
      const handle = await install();
      await handle.flush();
      expect(sent[0].events[1]).toMatchObject({ name: 'session_start', platform: wire });
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
      {
        event: {
          name: 'session_start',
          appVersion: { year: 2026, month: 7, patch: 1 },
          platform: 'mac',
          locale: 'en',
        },
        at: 1_760_000_000_000,
        disposition: 'suppressed',
      },
      { event: { name: 'feature_used', feature: 'variables' }, at: 1_760_000_000_000, disposition: 'suppressed' },
    ]);
    handle.dispose();
  });
});
