/**
 * Desktop environment-plane service — the mode-driven half of the
 * two-plane proxy architecture (docs/REQUEST_ENGINE_PROXY_DESIGN.md
 * P3): mode → resolver mapping over the P2 registry, the dedicated
 * Chromium resolver session's System/PAC wiring, per-device settings
 * hydration with malformed-slot tolerance, and the renderer-safe
 * resolution projection (credentials never cross the bridge).
 */

import { OH, type StorageKey } from '@openheaders/core/storage';
import {
  environmentProxyResolver,
  resetEnvironmentProxyResolver,
} from '@openheaders/oracle-host-node/live/environment-proxy';
import { afterEach, describe, expect, it } from 'vitest';
import {
  chromiumEnvironmentProxyResolver,
  installEnvironmentProxyService,
  pacScriptUrl,
  projectSelection,
} from '../../../src/main/environment-proxy-install';
// The mock-only session handle comes from the mock module itself — the
// vitest alias resolves 'electron' to the same file, so it is the same
// singleton, and the type exists (real electron types have no such
// member).
import { sessionPartitionMock } from '../../__mocks__/electron';

function makeStore(initial?: unknown) {
  const slots = new Map<string, unknown>();
  if (initial !== undefined) slots.set(OH.environmentProxy.key, initial);
  return {
    slots,
    get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return Promise.resolve(slots.get(spec.key) as T | undefined);
    },
    set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      slots.set(spec.key, value);
      return Promise.resolve();
    },
  };
}

afterEach(() => {
  resetEnvironmentProxyResolver();
  sessionPartitionMock.resolveProxyAnswer = 'DIRECT';
  sessionPartitionMock.proxyConfig = undefined;
});

describe('pacScriptUrl', () => {
  it('passes URLs through and turns a local path into a file:// URL', () => {
    expect(pacScriptUrl('https://proxy.openheaders.io/proxy.pac')).toBe('https://proxy.openheaders.io/proxy.pac');
    expect(pacScriptUrl('file:///etc/proxy.pac')).toBe('file:///etc/proxy.pac');
    expect(pacScriptUrl('/etc/proxy.pac')).toBe('file:///etc/proxy.pac');
  });
});

describe('chromiumEnvironmentProxyResolver', () => {
  it('parses the PAC-format answer under the given source', async () => {
    const resolver = chromiumEnvironmentProxyResolver(
      () => Promise.resolve('PROXY corp.openheaders.io:8080; DIRECT'),
      'pac',
    );
    await expect(resolver.resolve('https://api.openheaders.io')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }, { kind: 'direct' }],
      source: 'pac',
    });
  });

  it('answers null on an empty answer and on a resolution failure — never a new way to fail', async () => {
    await expect(
      chromiumEnvironmentProxyResolver(() => Promise.resolve('')).resolve('https://api.openheaders.io'),
    ).resolves.toBeNull();
    await expect(
      chromiumEnvironmentProxyResolver(() => Promise.reject(new Error('gone'))).resolve('https://api.openheaders.io'),
    ).resolves.toBeNull();
  });
});

describe('projectSelection', () => {
  it('maps a credential to hasCredential — the value never crosses the bridge', () => {
    expect(
      projectSelection({
        entries: [
          { kind: 'proxy', url: 'http://corp.openheaders.io:8080', credential: 'user:secret' },
          { kind: 'socks', raw: 'SOCKS5 corp.openheaders.io:1080' },
          { kind: 'direct' },
        ],
        source: 'manual',
      }),
    ).toEqual({
      entries: [
        { kind: 'proxy', url: 'http://corp.openheaders.io:8080', hasCredential: true },
        { kind: 'socks', raw: 'SOCKS5 corp.openheaders.io:1080' },
        { kind: 'direct' },
      ],
      source: 'manual',
    });
  });
});

describe('installEnvironmentProxyService', () => {
  it('defaults to System, points the resolver session at the OS, and resolves through Chromium', async () => {
    const service = await installEnvironmentProxyService(makeStore());
    expect(service.getSettings()).toEqual({ version: 1, mode: 'system' });
    expect(sessionPartitionMock.proxyConfig).toEqual({ mode: 'system' });
    sessionPartitionMock.resolveProxyAnswer = 'PROXY corp.openheaders.io:8080';
    await expect(service.resolve('https://api.openheaders.io')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }],
      source: 'system',
    });
  });

  it('reads a malformed stored slot as the tier default — never a boot failure', async () => {
    const service = await installEnvironmentProxyService(makeStore({ mode: 'sideways' }));
    expect(service.getSettings()).toEqual({ version: 1, mode: 'system' });
  });

  it("reads a stored node-tier 'env' mode as the tier default — Chromium resolves here, not the process env", async () => {
    const service = await installEnvironmentProxyService(makeStore({ version: 1, mode: 'env' }));
    expect(service.getSettings()).toEqual({ version: 1, mode: 'system' });
  });

  it('applies a set live: Off registers the explicit null, Manual resolves by config', async () => {
    const store = makeStore();
    const service = await installEnvironmentProxyService(store);
    const off = await service.setSettings({ version: 1, mode: 'off' });
    expect(off.ok).toBe(true);
    expect(environmentProxyResolver()).toBeNull();
    await expect(service.resolve('https://api.openheaders.io')).resolves.toBeNull();

    const manual = await service.setSettings({
      version: 1,
      mode: 'manual',
      manualProxyUrl: 'corp.openheaders.io:8080',
      manualBypassList: '.internal.openheaders.io',
    });
    expect(manual.ok).toBe(true);
    // Persisted per device under the OH slot.
    expect(store.slots.get(OH.environmentProxy.key)).toEqual({
      version: 1,
      mode: 'manual',
      manualProxyUrl: 'corp.openheaders.io:8080',
      manualBypassList: '.internal.openheaders.io',
    });
    await expect(service.resolve('https://api.openheaders.io')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }],
      source: 'manual',
    });
    await expect(service.resolve('https://build.internal.openheaders.io')).resolves.toBeNull();
  });

  it('PAC mode points the dedicated session at the script and answers under the pac source', async () => {
    const service = await installEnvironmentProxyService(makeStore());
    const result = await service.setSettings({ version: 1, mode: 'pac', pacSource: '/etc/proxy.pac' });
    expect(result.ok).toBe(true);
    expect(sessionPartitionMock.proxyConfig).toEqual({ pacScript: 'file:///etc/proxy.pac' });
    sessionPartitionMock.resolveProxyAnswer = 'PROXY corp.openheaders.io:8080; DIRECT';
    await expect(service.resolve('https://api.openheaders.io')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }, { kind: 'direct' }],
      source: 'pac',
    });
    // PAC with no source configured yet — the plane stands off.
    const empty = await service.setSettings({ version: 1, mode: 'pac' });
    expect(empty.ok).toBe(true);
    await expect(service.resolve('https://api.openheaders.io')).resolves.toBeNull();
  });

  it("refuses an invalid shape and the node tier's env mode without touching the active mode", async () => {
    const service = await installEnvironmentProxyService(makeStore());
    const shape = await service.setSettings({ version: 1, mode: 'sideways' });
    expect(shape.ok).toBe(false);
    const nodeMode = await service.setSettings({ version: 1, mode: 'env' });
    expect(nodeMode.ok).toBe(false);
    if (!nodeMode.ok) expect(nodeMode.error).toMatch(/not available on the desktop/);
    expect(service.getSettings()).toEqual({ version: 1, mode: 'system' });
  });
});
