/**
 * Phase E — LiveRegistry wiring in `variables-resolver`. Confirms the
 * scope chain serves `{{live.X}}` against the live-cache mirror +
 * live-variable store snapshot per the plan:
 *
 *   1. Enabled LVs with a matching cached run for the active env resolve.
 *   2. Disabled LVs do NOT resolve (even when cache is present).
 *   3. Cache rows keyed to a DIFFERENT env don't leak into the active
 *      env's registry.
 *   4. Manual override wins over the cached capture; expired overrides
 *      fall through to the cache.
 *   5. Stale cache (past `expiresAt`) still serves the value but marks
 *      `stale: true` (advisory — async-warm default).
 *   6. `hydrateLiveCacheMirror` primes the sync mirror from storage.
 *   7. `getLiveRegistrySnapshot` is the sync accessor shared with the
 *      request executor's own resolver.
 */

import type { LiveVariable } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks for the stores + environment-store ─────────────────────

const getLiveVariablesMock = vi.fn<() => LiveVariable[]>(() => []);
const listWorkflowRunCachesMock = vi.fn<() => Promise<unknown[]>>(() => Promise.resolve([]));
const getActiveEnvironmentIdMock = vi.fn<() => string | null>(() => null);

vi.mock('@/background/modules/environment-store', () => ({
  getEnvironments: vi.fn(() => []),
  getActiveEnvironmentId: () => getActiveEnvironmentIdMock(),
  getDefaultEnvironmentId: vi.fn(() => null),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] })),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] })),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: vi.fn(() => []),
  getRules: vi.fn(() => []),
}));

vi.mock('@/background/modules/live-variable-store', () => ({
  getLiveVariables: () => getLiveVariablesMock(),
  onLiveVariableStoreChange: vi.fn(() => () => {}),
}));

vi.mock('@/background/modules/live-cache-store', () => ({
  listWorkflowRunCaches: () => listWorkflowRunCachesMock(),
  onLiveCacheStoreChange: vi.fn(() => () => {}),
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────

function makeLV(overrides: Partial<LiveVariable> = {}): LiveVariable {
  return {
    schemaVersion: 5,
    uid: overrides.uid ?? 'lvar0001',
    path: `live-variables/${overrides.name ?? 'token'}-${overrides.uid ?? 'lvar0001'}`,
    name: overrides.name ?? 'token',
    workflowUid: overrides.workflowUid ?? 'wflow001',
    stepId: overrides.stepId ?? 'login',
    captureName: overrides.captureName ?? 'token',
    enabled: overrides.enabled ?? true,
    published: overrides.published ?? true,
    ...overrides,
  };
}

function makeRun(
  overrides: {
    workflowUid?: string;
    environmentId?: string | null;
    stepCaptures?: Record<string, Record<string, string>>;
    expiresAt?: number | null;
    extractedAt?: number;
  } = {},
) {
  return {
    workflowUid: overrides.workflowUid ?? 'wflow001',
    environmentId: overrides.environmentId ?? null,
    stepCaptures: overrides.stepCaptures ?? { login: { token: 'tok-abc' } },
    extractedAt: overrides.extractedAt ?? 1_700_000_000_000,
    expiresAt: overrides.expiresAt ?? null,
    stepResponseBytes: { login: 20 },
    consecutiveFailures: 0,
    lastExtractorOk: true,
  };
}

// ── Bootstrap the module fresh per test ──────────────────────────

let mod: typeof import('@/background/modules/variables-resolver');

beforeEach(async () => {
  vi.resetModules();
  getLiveVariablesMock.mockReset();
  listWorkflowRunCachesMock.mockReset();
  getActiveEnvironmentIdMock.mockReset();
  getLiveVariablesMock.mockReturnValue([]);
  listWorkflowRunCachesMock.mockResolvedValue([]);
  getActiveEnvironmentIdMock.mockReturnValue(null);
  mod = await import('@/background/modules/variables-resolver');
  mod.__resetForTests();
});

// ── Tests ──────────────────────────────────────────────────────────

describe('hydrateLiveCacheMirror', () => {
  it('primes the mirror from storage before the first sync read', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    const registry = mod.getLiveRegistrySnapshot();
    expect(registry.get('token')?.value).toBe('tok-abc');
  });

  it('tolerates a failing read — mirror stays empty', async () => {
    listWorkflowRunCachesMock.mockRejectedValue(new Error('chrome storage offline'));
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    expect(mod.getLiveRegistrySnapshot().size).toBe(0);
  });
});

describe('buildLiveRegistry semantics', () => {
  beforeEach(async () => {
    // Every test here assumes the mirror's been hydrated with SOMETHING —
    // helper scripts set the returned runs per-case.
    await mod.hydrateLiveCacheMirror();
  });

  it('enabled LV with matching cache → registry entry with cached value', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    const registry = mod.getLiveRegistrySnapshot();
    expect(registry.get('token')).toMatchObject({
      value: 'tok-abc',
      workflowUid: 'wflow001',
    });
    expect(registry.get('token')?.stale).toBeUndefined();
  });

  it('disabled LV → no registry entry even with cache present', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV({ enabled: false })]);
    expect(mod.getLiveRegistrySnapshot().size).toBe(0);
  });

  it('env-switch isolation: cache keyed to a different env does NOT resolve', async () => {
    // Cache has rows for env-staging AND null. Active is env-prod →
    // neither row matches → registry empty.
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ environmentId: 'env-staging' }),
      makeRun({ environmentId: null }),
    ]);
    await mod.hydrateLiveCacheMirror();
    getActiveEnvironmentIdMock.mockReturnValue('env-prod');
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    expect(mod.getLiveRegistrySnapshot().size).toBe(0);
  });

  it('"No environment" (null) resolves against the null-env cache row', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ environmentId: 'env-staging', stepCaptures: { login: { token: 'STAG' } } }),
      makeRun({ environmentId: null, stepCaptures: { login: { token: 'NONE' } } }),
    ]);
    await mod.hydrateLiveCacheMirror();
    getActiveEnvironmentIdMock.mockReturnValue(null);
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    expect(mod.getLiveRegistrySnapshot().get('token')?.value).toBe('NONE');
  });

  it('missing capture (typo in stepId) → no entry', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ stepCaptures: { other: { token: 'x' } } })]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    expect(mod.getLiveRegistrySnapshot().size).toBe(0);
  });

  it('expiresAt in the past flags stale:true but still serves the value', async () => {
    const now = Date.now();
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ expiresAt: now - 60_000 })]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    const entry = mod.getLiveRegistrySnapshot().get('token');
    expect(entry?.value).toBe('tok-abc');
    expect(entry?.stale).toBe(true);
  });

  it('expiresAt in the future → no stale flag', async () => {
    const now = Date.now();
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ expiresAt: now + 60_000 })]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV()]);
    expect(mod.getLiveRegistrySnapshot().get('token')?.stale).toBeUndefined();
  });

  it('manual override wins over the cached capture', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV({ manualOverride: { value: 'PINNED' } })]);
    expect(mod.getLiveRegistrySnapshot().get('token')?.value).toBe('PINNED');
  });

  it('expired manual override falls through to cache', async () => {
    const now = Date.now();
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV({ manualOverride: { value: 'OLD', until: now - 1000 } })]);
    expect(mod.getLiveRegistrySnapshot().get('token')?.value).toBe('tok-abc');
  });

  it('manual override with until in future still serves override', async () => {
    const now = Date.now();
    listWorkflowRunCachesMock.mockResolvedValue([makeRun()]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([makeLV({ manualOverride: { value: 'DEBUG', until: now + 60_000 } })]);
    expect(mod.getLiveRegistrySnapshot().get('token')?.value).toBe('DEBUG');
  });

  it('multiple LVs pointing at the same workflow get atomic captures', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ stepCaptures: { login: { token: 'T', refresh: 'R' } } })]);
    await mod.hydrateLiveCacheMirror();
    getLiveVariablesMock.mockReturnValue([
      makeLV({ uid: 'lva', name: 'accessToken', captureName: 'token' }),
      makeLV({ uid: 'lvb', name: 'refreshToken', captureName: 'refresh' }),
    ]);
    const r = mod.getLiveRegistrySnapshot();
    expect(r.get('accessToken')?.value).toBe('T');
    expect(r.get('refreshToken')?.value).toBe('R');
  });
});
