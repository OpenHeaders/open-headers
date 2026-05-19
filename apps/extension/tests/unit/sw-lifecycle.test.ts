/**
 * SW-lifecycle harness — proves every persisted store's in-memory cache
 * is reconstructible from `chrome.storage.local` alone.
 *
 * MV3 service workers are killed after ~30s idle and every module-level
 * `let` resets when the SW wakes. Chrome keeps `chrome.storage.local`
 * intact across the eviction, so state survival depends entirely on the
 * hydrate-from-storage discipline each store follows.
 *
 * Strategy:
 *   1. Install a real in-memory backing for `chrome.storage.local`
 *      (default mock returns `{}` for every read — wrong shape here).
 *   2. Seed the backing store with the persisted shape a prior SW
 *      lifetime would have written.
 *   3. Import the module (first SW lifetime), call its hydrate path,
 *      read the in-memory getters → assert state matches the seed.
 *   4. Call `vi.resetModules()` to drop module-level caches — this
 *      models SW termination. Backing store (the Map) is untouched,
 *      matching chrome.storage's persistence across evictions.
 *   5. Re-import the module (second SW lifetime), call hydrate again,
 *      assert the getters still return the seeded state.
 *
 * If this file ever fails, the offending store is not reconstructible
 * from storage alone — which means its state would vanish the first
 * time the browser evicts the SW.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installBackingStorage,
  installHostStorage,
  seedStorage,
  seedStorageMany,
} from '../helpers/chrome-storage-backing';

function workspace(id: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 5,
    version: 1,
    id,
    kind: 'personal',
    name: id,
    sortIndex: 0,
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
    orgId: '01890000-0000-7000-8000-000000000000',
    ...overrides,
  };
}

function makeUid(seed: string): string {
  return seed
    .padEnd(8, '0')
    .slice(0, 8)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '0');
}

describe('SW lifecycle — persisted stores reconstruct from storage alone', () => {
  beforeEach(async () => {
    installBackingStorage();
    vi.resetModules();
    await installHostStorage();
  });

  // ── observability-log ──────────────────────────────────────────────

  it('observability-log: entries persisted before SW kill are rehydrated on wake', async () => {
    const entries = [
      {
        timestamp: 1_000,
        subsystem: 'extension' as const,
        op: 'sw-init',
        level: 'info' as const,
        message: 'Service worker initialized',
        context: { extensionVersion: '5.0.0' },
      },
      {
        timestamp: 2_000,
        subsystem: 'rule-engine' as const,
        op: 'resolve',
        level: 'warn' as const,
        message: '1 unresolved variable across 1 rule',
        context: { extensionVersion: '5.0.0' },
      },
    ];
    seedStorage('oh.observability.log', entries);

    const first = await import('@/background/modules/observability-log');
    await first.hydrateObservabilityLog();
    expect(first.getObservabilityLog()).toHaveLength(2);

    // Kill + wake.
    vi.resetModules();
    await installHostStorage();
    const second = await import('@/background/modules/observability-log');
    expect(second.getObservabilityLog()).toHaveLength(0);
    await second.hydrateObservabilityLog();
    expect(second.getObservabilityLog()).toHaveLength(2);
    expect(second.getObservabilityLog()[0].message).toBe('Service worker initialized');
  });

  // ── workspace-store ────────────────────────────────────────────────

  it('workspace-store: bootstrap restores list + active id from storage', async () => {
    seedStorageMany({
      'oh.workspaces': [workspace('ws-a', { name: 'Home' }), workspace('ws-b', { name: 'Work', sortIndex: 1 })],
      'oh.runtimeActive.active': 'ws-b',
    });

    const first = await import('@/background/modules/workspace-store');
    await first.bootstrap();
    expect(first.listWorkspaces()).toHaveLength(2);
    expect(first.getActiveWorkspaceId()).toBe('ws-b');

    vi.resetModules();
    await installHostStorage();
    const second = await import('@/background/modules/workspace-store');
    await second.bootstrap();
    expect(second.listWorkspaces()).toHaveLength(2);
    expect(second.getActiveWorkspaceId()).toBe('ws-b');
  });

  // ── environment-store ──────────────────────────────────────────────

  it('environment-store: envs + vault + defaults round-trip across SW kill', async () => {
    const activeWs = 'ws-env';
    seedStorageMany({
      'oh.workspaces': [workspace(activeWs)],
      'oh.runtimeActive.active': activeWs,
      [`oh.ws.${activeWs}.environments`]: [
        { schemaVersion: 5, version: 1, uid: makeUid('envstage'), name: 'staging', variables: [] },
        { schemaVersion: 5, version: 1, uid: makeUid('envprod0'), name: 'prod', variables: [] },
      ],
      [`oh.ws.${activeWs}.defaultEnvironmentId`]: null,
      [`oh.ws.${activeWs}.workspaceVars`]: {
        schemaVersion: 5,
        version: 1,
        variables: [{ uid: 'b2fb4b0b', name: 'API_URL', value: 'https://api.openheaders.io', type: 'default' }],
      },
      [`oh.ws.${activeWs}.vault`]: {
        schemaVersion: 5,
        
        secrets: [{ uid: '32209dbc', kind: 'string', name: 'TOKEN', value: 'abc' }],
      },
    });

    let ws = await import('@/background/modules/workspace-store');
    await ws.bootstrap();
    let oracleSync = await import('@openheaders/oracle/sync');
    oracleSync.setOracleHostHooks({ getActiveWorkspaceId: ws.getActiveWorkspaceId });
    let env = await import('@openheaders/oracle/entity/environment-store');
    await env.hydrateEnvironmentsFromStorage();
    expect(env.getEnvironments()).toHaveLength(2);
    expect(env.getWorkspaceVariables().variables[0].name).toBe('API_URL');
    expect(env.getVault().secrets[0].name).toBe('TOKEN');

    vi.resetModules();
    await installHostStorage();
    ws = await import('@/background/modules/workspace-store');
    await ws.bootstrap();
    oracleSync = await import('@openheaders/oracle/sync');
    oracleSync.setOracleHostHooks({ getActiveWorkspaceId: ws.getActiveWorkspaceId });
    env = await import('@openheaders/oracle/entity/environment-store');
    expect(env.getEnvironments()).toEqual([]);
    await env.hydrateEnvironmentsFromStorage();
    expect(env.getEnvironments()).toHaveLength(2);
    const secret0 = env.getVault().secrets[0];
    expect(secret0?.kind).toBe('string');
    expect(secret0?.kind === 'string' && secret0.value).toBe('abc');
  });

  // ── rule-store ─────────────────────────────────────────────────────

  it('rule-store: rules/collections/folders round-trip across SW kill', async () => {
    const activeWs = 'ws-workbench';
    const rule = {
      schemaVersion: 5,
      uid: makeUid('r1a2b3c4'),
      path: 'rules/coll-abcd1234/r1a2b3c4',
      name: 'R',
      type: 'header',
      enabled: true,
      conditions: [{ uid: 'tcd00057', type: 'request-domains', values: ['*.openheaders.io'] }],
      action: {
        requestHeaders: [{ uid: 'thm00093', operation: 'override', headerName: 'X-Token', value: 'abc' }],
        responseHeaders: [],
      },
    };
    const coll = {
      schemaVersion: 5,
      version: 1,
      uid: makeUid('abcd1234'),
      path: 'rules/coll-abcd1234',
      name: 'coll',
      variables: [],
    };
    seedStorageMany({
      'oh.workspaces': [workspace(activeWs)],
      'oh.runtimeActive.active': activeWs,
      [`oh.ws.${activeWs}.rules`]: [rule],
      [`oh.ws.${activeWs}.collections`]: [coll],
      [`oh.ws.${activeWs}.folders`]: [],
    });

    let ws = await import('@/background/modules/workspace-store');
    await ws.bootstrap();
    let oracleSync = await import('@openheaders/oracle/sync');
    oracleSync.setOracleHostHooks({ getActiveWorkspaceId: ws.getActiveWorkspaceId });
    let store = await import('@openheaders/oracle/entity/rule-store');
    await store.hydrateFromStorage();
    expect(store.getRules()).toHaveLength(1);
    expect(store.getCollections()).toHaveLength(1);

    vi.resetModules();
    await installHostStorage();
    ws = await import('@/background/modules/workspace-store');
    await ws.bootstrap();
    oracleSync = await import('@openheaders/oracle/sync');
    oracleSync.setOracleHostHooks({ getActiveWorkspaceId: ws.getActiveWorkspaceId });
    store = await import('@openheaders/oracle/entity/rule-store');
    expect(store.getRules()).toEqual([]);
    await store.hydrateFromStorage();
    expect(store.getRules()).toHaveLength(1);
    expect(store.getRules()[0].uid).toBe(rule.uid);
  });

  // ── pause-markers-store ────────────────────────────────────────────

  // pause-markers SW round-trip is exercised through
  // `pause-markers-cache.test.ts` + `pause-markers-post-state.test.ts`
  // post Phase B. The legacy in-memory mirror no longer reads
  // chrome.storage directly — the cache owns persistence and seeds the
  // mirror via `bridgePauseMarkersSyncEngine` against the sync service.

  // ── end-to-end: orchestrator hydrates every per-workspace store ────

  it('orchestrator: hydrateActiveWorkspaceStores replays every per-workspace store at once', async () => {
    const activeWs = 'ws-e2e';
    const env = { schemaVersion: 5, version: 1, uid: makeUid('envdev00'), name: 'dev', variables: [] };
    const coll = {
      schemaVersion: 5,
      version: 1,
      uid: makeUid('eecc1234'),
      path: 'rules/coll-eecc1234',
      name: 'c',
      variables: [],
    };
    const rule = {
      schemaVersion: 5,
      uid: makeUid('e2e1a2b3'),
      path: `rules/coll-eecc1234/e2e1a2b3`,
      name: 'R',
      type: 'header',
      enabled: true,
      conditions: [{ uid: 'tcd00058', type: 'request-domains', values: ['*.openheaders.io'] }],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    seedStorageMany({
      'oh.workspaces': [workspace(activeWs)],
      'oh.runtimeActive.active': activeWs,
      [`oh.ws.${activeWs}.rules`]: [rule],
      [`oh.ws.${activeWs}.collections`]: [coll],
      [`oh.ws.${activeWs}.folders`]: [],
      [`oh.ws.${activeWs}.environments`]: [env],
      [`oh.ws.${activeWs}.vault`]: { schemaVersion: 5, secrets: [] },
      [`oh.ws.${activeWs}.workspaceVars`]: { schemaVersion: 5, variables: [] },
      [`oh.ws.${activeWs}.templates`]: [],
      [`oh.ws.${activeWs}.templateCollections`]: [],
      [`oh.ws.${activeWs}.templateFolders`]: [],
      [`oh.ws.${activeWs}.requests`]: [],
      [`oh.ws.${activeWs}.requestCollections`]: [],
      [`oh.ws.${activeWs}.requestFolders`]: [],
      [`oh.ws.${activeWs}.pauseMarkers`]: {},
    });

    const ws = await import('@/background/modules/workspace-store');
    await ws.bootstrap();
    const { setOracleHostHooks } = await import('@openheaders/oracle/sync');
    setOracleHostHooks({ getActiveWorkspaceId: ws.getActiveWorkspaceId });
    const orchestrator = await import('@/background/modules/workspace-orchestrator');
    await orchestrator.hydrateActiveWorkspaceStores();

    const rules = await import('@openheaders/oracle/entity/rule-store');
    const envs = await import('@openheaders/oracle/entity/environment-store');
    expect(rules.getRules()).toHaveLength(1);
    expect(rules.getCollections()).toHaveLength(1);
    expect(envs.getEnvironments()).toHaveLength(1);
    expect(envs.getEnvironments()[0].name).toBe('dev');
  });
});
