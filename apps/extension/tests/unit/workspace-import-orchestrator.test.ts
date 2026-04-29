/**
 * Coverage for the SW-side workspace-export import orchestrator
 * (`workspace-import-orchestrator.ts`).
 *
 * Drives an end-to-end import (target = current / new) against a
 * Map-backed `extensionStorage` mock + a deterministic FIFO lock
 * runtime, then asserts:
 *   • Force-disable on Rule / LiveWorkflow / LiveVariable
 *   • Workspace metadata behavior (target=new uses export's name)
 *   • ImportReport persisted into the target's per-workspace ring
 *   • Same-workspace concurrent imports serialize on the lock
 *   • Different-workspace concurrent imports run in parallel
 */

import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs } = vi.hoisted(() => ({ blobs: new Map<string, unknown>() }));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-active'),
  listWorkspaces: vi.fn(() => [{ id: 'ws-active', name: 'Active' }]),
  getWorkspace: vi.fn((id: string) =>
    id === 'ws-active'
      ? { id: 'ws-active', name: 'Active' }
      : id === 'ws-other'
        ? { id: 'ws-other', name: 'Other' }
        : null,
  ),
  createWorkspace: vi.fn(async (input: { name: string }) => ({
    id: `ws-new-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
  })),
}));

vi.mock('@/background/modules/rule-store', () => ({
  hydrateFromStorage: vi.fn(async () => []),
  bridgeToSyncEngine: vi.fn(async () => undefined),
  bridgeCollectionSyncEngine: vi.fn(async () => undefined),
  bridgeFolderSyncEngine: vi.fn(async () => undefined),
}));
vi.mock('@/background/modules/request-store', () => ({
  hydrateFromStorage: vi.fn(async () => []),
  bridgeRequestSyncEngine: vi.fn(async () => undefined),
}));
vi.mock('@/background/modules/template-store', () => ({
  hydrateTemplatesFromStorage: vi.fn(async () => []),
}));
vi.mock('@/background/modules/environment-store', () => ({
  hydrateEnvironmentsFromStorage: vi.fn(async () => []),
  bridgeEnvironmentSyncEngine: vi.fn(async () => {}),
  bridgeVaultSyncEngine: vi.fn(async () => {}),
  bridgeWorkspaceVariablesSyncEngine: vi.fn(async () => {}),
}));
vi.mock('@/background/modules/live-workflow-store', () => ({
  hydrateFromStorage: vi.fn(async () => []),
}));
vi.mock('@/background/modules/live-variable-store', () => ({
  hydrateFromStorage: vi.fn(async () => []),
}));
vi.mock('@/background/modules/rule-engine', () => ({
  scheduleUpdate: vi.fn(),
}));
vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));
vi.mock('@/background/modules/import-reports-store', () => ({
  recordImportReport: vi.fn(async (report: unknown) => {
    const current = (blobs.get('oh.ws.ws-active.importReports') as unknown[]) ?? [];
    blobs.set('oh.ws.ws-active.importReports', [...current, report]);
  }),
}));
vi.mock('@/background/modules/request-scripts-review-store', () => ({
  markPendingScriptsReview: vi.fn(async (uids: readonly string[]) => {
    const key = 'oh.ws.ws-active.requestScriptsReviewPending';
    const current = ((blobs.get(key) as string[] | undefined) ?? []).slice();
    for (const uid of uids) if (!current.includes(uid)) current.push(uid);
    blobs.set(key, current);
  }),
  markPendingScriptsReviewForWorkspace: vi.fn(async (workspaceId: string, uids: readonly string[]) => {
    const key = `oh.ws.${workspaceId}.requestScriptsReviewPending`;
    const current = ((blobs.get(key) as string[] | undefined) ?? []).slice();
    for (const uid of uids) if (!current.includes(uid)) current.push(uid);
    blobs.set(key, current);
  }),
}));

vi.mock('@/shared/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...actual,
    extensionStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
      getMany: vi.fn(async (specs: Record<string, { key: string }>) => {
        const out: Record<string, unknown> = {};
        for (const [name, spec] of Object.entries(specs)) out[name] = blobs.get(spec.key);
        return out;
      }),
      set: vi.fn(async (key: { key: string }, value: unknown) => {
        blobs.set(key.key, value);
      }),
      setMany: vi.fn(async (writes: ReadonlyArray<readonly [{ key: string }, unknown]>) => {
        for (const [spec, value] of writes) blobs.set(spec.key, value);
      }),
      remove: vi.fn(async (key: { key: string }) => {
        blobs.delete(key.key);
      }),
    },
  };
});

import { setLockRuntime } from '@/shared/coordination/with-lock';

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let orchestrator: typeof import('@/background/modules/workspace-import-orchestrator');

beforeEach(async () => {
  blobs.clear();
  setLockRuntime(new FifoLockRuntime());
  vi.resetModules();
  orchestrator = await import('@/background/modules/workspace-import-orchestrator');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────

function makeExport(overrides: Partial<WorkspaceExport> = {}): WorkspaceExport {
  return {
    schemaVersion: 5,
    kind: 'workspace-export',
    exportFormatVersion: 1,
    exportId: 'e8a1b2c3',
    exportedAt: '2026-04-27T18:30:00.000Z',
    source: { app: 'extension', appVersion: '5.0.4', platform: 'chrome', workspaceLabel: 'My WS' },
    scope: 'workspace',
    workspace: { uid: 'wuid0001', name: 'Imported WS' },
    entities: {
      collections: [],
      folders: [],
      rules: [
        {
          schemaVersion: 5,
          uid: 'rul00001',
          path: 'rules/auth-col/auth-rul00001',
          name: 'Auth',
          type: 'header',
          enabled: true,
          conditions: [],
          action: { requestHeaders: [], responseHeaders: [] },
        },
      ],
      requests: [],
      templates: [],
      environments: [],
      workspaceVars: { schemaVersion: 5, variables: [] },
      liveWorkflows: [],
      liveVariables: [],
    },
    meta: {
      redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
      counts: { rules: 1, requests: 0, environments: 0, liveWorkflows: 0, liveVariables: 0, templates: 0, secrets: 0 },
    },
    ...overrides,
  } as WorkspaceExport;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('importWorkspace', () => {
  it('forces Rule.enabled = false on import (no trustExport)', async () => {
    const result = await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:deadbeef',
    });

    expect(result.targetWorkspaceId).toBe('ws-active');
    const stored = blobs.get('oh.ws.ws-active.rules') as Array<{ enabled: boolean }>;
    expect(stored).toHaveLength(1);
    expect(stored[0].enabled).toBe(false);
  });

  it('preserves Rule.enabled when trustExport=true', async () => {
    await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      trustExport: true,
      target: { mode: 'current' },
      sourceHash: 'sha256:deadbeef',
    });
    const stored = blobs.get('oh.ws.ws-active.rules') as Array<{ enabled: boolean }>;
    expect(stored[0].enabled).toBe(true);
  });

  it('persists a workspace-export ImportReport with the required arm fields', async () => {
    await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:deadbeef',
    });
    const ring = blobs.get('oh.ws.ws-active.importReports') as Array<{
      source: string;
      exportId: string;
      sourceWorkspaceLabel: string;
      sourceAppVersion: string;
      targetMode: string;
    }>;
    expect(ring).toHaveLength(1);
    expect(ring[0].source).toBe('workspace-export');
    expect(ring[0].exportId).toBe('e8a1b2c3');
    expect(ring[0].sourceWorkspaceLabel).toBe('My WS');
    expect(ring[0].sourceAppVersion).toBe('5.0.4');
    expect(ring[0].targetMode).toBe('current');
  });

  it('does not leak into other workspaces under target=current', async () => {
    blobs.set('oh.ws.ws-other.rules', [
      {
        schemaVersion: 5,
        uid: 'rul99999',
        path: 'rules/other/r-rul99999',
        name: 'Other',
        type: 'header',
        enabled: true,
        conditions: [],
        action: { requestHeaders: [], responseHeaders: [] },
      },
    ]);
    await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:abc',
    });
    const otherRules = blobs.get('oh.ws.ws-other.rules') as Array<{ uid: string; enabled: boolean }>;
    expect(otherRules).toHaveLength(1);
    expect(otherRules[0].uid).toBe('rul99999');
    expect(otherRules[0].enabled).toBe(true);
  });

  it('creates a fresh workspace under target=new and writes there', async () => {
    const result = await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'new' },
      sourceHash: 'sha256:fresh',
    });
    expect(result.targetWorkspaceId).toMatch(/^ws-new-/);
    const newKey = `oh.ws.${result.targetWorkspaceId}.rules`;
    expect(blobs.has(newKey)).toBe(true);
    expect(blobs.has('oh.ws.ws-active.rules')).toBe(false);
  });
});

describe('importWorkspace — locking', () => {
  it('serializes concurrent imports into the same workspace', async () => {
    const order: string[] = [];
    const a = orchestrator
      .importWorkspace({
        incoming: makeExport({ exportId: 'aaaaaaaa' }),
        strategies: {},
        target: { mode: 'current' },
        sourceHash: 'sha256:a',
      })
      .then(() => order.push('a'));
    const b = orchestrator
      .importWorkspace({
        incoming: makeExport({ exportId: 'bbbbbbbb' }),
        strategies: {},
        target: { mode: 'current' },
        sourceHash: 'sha256:b',
      })
      .then(() => order.push('b'));
    await Promise.all([a, b]);
    // Both completed; the two-import sequence ran via the same lock (FIFO).
    expect(order).toHaveLength(2);
    const ring = blobs.get('oh.ws.ws-active.importReports') as unknown[];
    expect(ring).toHaveLength(2);
  });

  it('runs concurrent imports into different workspaces in parallel', async () => {
    const a = orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:a',
    });
    const b = orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'picked', workspaceId: 'ws-other' },
      sourceHash: 'sha256:b',
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.targetWorkspaceId).toBe('ws-active');
    expect(rb.targetWorkspaceId).toBe('ws-other');
    expect(blobs.get('oh.ws.ws-active.rules')).toBeDefined();
    expect(blobs.get('oh.ws.ws-other.rules')).toBeDefined();
  });
});

describe('importWorkspace — scripts review pending set', () => {
  function makeRequest(uid: string, opts: { pre?: string; post?: string } = {}) {
    return {
      schemaVersion: 5 as const,
      uid,
      path: `requests/api-col/req-${uid}`,
      name: `Request ${uid}`,
      method: 'GET' as const,
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'none' as const },
      body: { type: 'none' as const },
      ...(opts.pre !== undefined ? { preRequestScript: opts.pre } : {}),
      ...(opts.post !== undefined ? { postResponseScript: opts.post } : {}),
    };
  }

  function makeExportWithRequests(requests: ReturnType<typeof makeRequest>[]): WorkspaceExport {
    return makeExport({
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests,
        templates: [],
        environments: [],
        workspaceVars: { schemaVersion: 5, variables: [] },
        liveWorkflows: [],
        liveVariables: [],
      },
      meta: {
        redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
        counts: {
          rules: 0,
          requests: requests.length,
          environments: 0,
          liveWorkflows: 0,
          liveVariables: 0,
          templates: 0,
          secrets: 0,
        },
      },
    } as Partial<WorkspaceExport>);
  }

  it('marks imported requests with scripts; ignores requests without scripts', async () => {
    await orchestrator.importWorkspace({
      incoming: makeExportWithRequests([
        makeRequest('req00001', { pre: 'console.log("hi")' }),
        makeRequest('req00002', { post: 'return ctx;' }),
        makeRequest('req00003'),
      ]),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:scripts',
    });
    // No-collision creates regenerate uids via the importer's tree-aware
    // new-uid path, so the persisted set carries the *new* uids — which
    // is correct, since those are what the renderer references too.
    const pending = blobs.get('oh.ws.ws-active.requestScriptsReviewPending') as string[];
    const persisted = blobs.get('oh.ws.ws-active.requests') as Array<{
      uid: string;
      preRequestScript?: string;
      postResponseScript?: string;
    }>;
    const expectedPending = persisted
      .filter(
        (r) =>
          (r.preRequestScript && r.preRequestScript.length > 0) ||
          (r.postResponseScript && r.postResponseScript.length > 0),
      )
      .map((r) => r.uid);
    expect(pending.sort()).toEqual(expectedPending.sort());
    expect(pending).toHaveLength(2);
  });

  it('does not mark anything when stripScripts removes the source', async () => {
    await orchestrator.importWorkspace({
      incoming: makeExportWithRequests([makeRequest('req00010', { pre: 'console.log("x")' })]),
      strategies: {},
      stripScripts: true,
      target: { mode: 'current' },
      sourceHash: 'sha256:strip',
    });
    expect(blobs.get('oh.ws.ws-active.requestScriptsReviewPending')).toBeUndefined();
  });

  it('writes the pending set to the target workspace key when target ≠ active', async () => {
    await orchestrator.importWorkspace({
      incoming: makeExportWithRequests([makeRequest('req00020', { pre: 'noop()' })]),
      strategies: {},
      target: { mode: 'picked', workspaceId: 'ws-other' },
      sourceHash: 'sha256:other',
    });
    const persisted = blobs.get('oh.ws.ws-other.requests') as Array<{ uid: string }>;
    expect(persisted).toHaveLength(1);
    expect(blobs.get('oh.ws.ws-other.requestScriptsReviewPending')).toEqual([persisted[0].uid]);
    expect(blobs.get('oh.ws.ws-active.requestScriptsReviewPending')).toBeUndefined();
  });
});

describe('importWorkspace — quota pre-check (best-effort, warn-only)', () => {
  it('logs a warning and continues when the estimated plan exceeds the quota headroom', async () => {
    const { logger } = await import('@utils/logger');
    // A 4 MB inline script in one request blows past the 4.5 MB headroom
    // when combined with any envelope overhead. The orchestrator should
    // warn but still write — pre-check is a UX hint, not a guard
    // (design §5.3 step 2).
    const huge = 'x'.repeat(5 * 1024 * 1024);
    const incoming = makeExport({
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests: [
          {
            schemaVersion: 5,
            uid: 'req99999',
            path: 'requests/api-col/req99999',
            name: 'Big',
            method: 'POST',
            url: 'https://api.openheaders.io/upload',
            headers: [],
            params: [],
            auth: { type: 'none' },
            body: { type: 'text', content: huge },
          },
        ],
        templates: [],
        environments: [],
        workspaceVars: { schemaVersion: 5, variables: [] },
        liveWorkflows: [],
        liveVariables: [],
      },
      meta: {
        redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
        counts: {
          rules: 0,
          requests: 1,
          environments: 0,
          liveWorkflows: 0,
          liveVariables: 0,
          templates: 0,
          secrets: 0,
        },
      },
    } as Partial<WorkspaceExport>);

    const result = await orchestrator.importWorkspace({
      incoming,
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:huge',
    });

    expect(result.targetWorkspaceId).toBe('ws-active');
    // Write still succeeded — the partial-success contract says we never
    // roll back, and the pre-check doesn't block writes.
    expect(blobs.get('oh.ws.ws-active.requests')).toBeDefined();
    // Warning surfaced for the operator log.
    const warned = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      String(call[1] ?? '').includes('exceeds best-effort quota headroom'),
    );
    expect(warned).toBe(true);
  });

  it('does not warn when the plan fits comfortably under the headroom', async () => {
    const { logger } = await import('@utils/logger');
    await orchestrator.importWorkspace({
      incoming: makeExport(),
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:tiny',
    });
    const warned = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.some((call) =>
      String(call[1] ?? '').includes('exceeds best-effort quota headroom'),
    );
    expect(warned).toBe(false);
  });
});

describe('previewWorkspaceImport', () => {
  it('returns a diff + missing-deps + snapshot hash for target=current', async () => {
    const res = await orchestrator.previewWorkspaceImport({
      incoming: makeExport(),
      target: { mode: 'current' },
    });
    expect(res.targetWorkspaceId).toBe('ws-active');
    expect(res.diff.rules).toHaveLength(1);
    expect(res.diff.rules[0]?.state).toBe('no-collision');
    expect(res.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    // Empty target means no missing-deps walk for the trivial export.
    expect(res.missingDeps).toEqual([]);
  });

  it('returns null targetWorkspaceId for target=new (everything is new)', async () => {
    const res = await orchestrator.previewWorkspaceImport({
      incoming: makeExport(),
      target: { mode: 'new' },
    });
    expect(res.targetWorkspaceId).toBeNull();
    expect(res.diff.rules[0]?.state).toBe('no-collision');
  });

  it('snapshot hash changes when target storage changes (concurrent-edit signal)', async () => {
    const before = await orchestrator.previewWorkspaceImport({
      incoming: makeExport(),
      target: { mode: 'current' },
    });
    // Simulate a concurrent edit landing the same uid.
    blobs.set('oh.ws.ws-active.rules', [
      {
        schemaVersion: 5,
        uid: 'rul00001',
        path: 'rules/auth-col/auth-rul00001',
        name: 'Auth (local)',
        type: 'header',
        enabled: true,
        conditions: [],
        action: { requestHeaders: [], responseHeaders: [] },
      },
    ]);
    const after = await orchestrator.previewWorkspaceImport({
      incoming: makeExport(),
      target: { mode: 'current' },
    });
    expect(after.snapshotHash).not.toBe(before.snapshotHash);
    expect(after.diff.rules[0]?.state).toBe('collision-uid');
  });

  it('does not write to storage during preview', async () => {
    await orchestrator.previewWorkspaceImport({
      incoming: makeExport(),
      target: { mode: 'current' },
    });
    expect(blobs.get('oh.ws.ws-active.rules')).toBeUndefined();
    expect(blobs.get('oh.ws.ws-active.importReports')).toBeUndefined();
  });
});
