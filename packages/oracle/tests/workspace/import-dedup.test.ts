/**
 * Coverage for the cross-workspace dedup walker
 * (`workspace/import-dedup.ts`) — drives the soft-dedup banner in the
 * import preview modal.
 *
 * Asserts the §5.2 precedence: exportId match in the same target beats
 * exportId in another target beats workspace.uid match. Workspaces
 * with no matching report contribute nothing to the result.
 */

import type { WorkspaceExportImportReport } from '@openheaders/core/import';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { blobs, workspaces } = vi.hoisted(() => ({
  blobs: new Map<string, unknown>(),
  workspaces: [
    { id: 'ws-a', name: 'Alpha' },
    { id: 'ws-b', name: 'Beta' },
    { id: 'ws-c', name: 'Gamma' },
  ],
}));

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  listWorkspaces: vi.fn(() => workspaces),
}));

vi.mock('@openheaders/oracle/storage', async () => {
  const actual = await vi.importActual<typeof import('@openheaders/oracle/storage')>('@openheaders/oracle/storage');
  return {
    ...actual,
    hostStorage: {
      get: vi.fn(async (key: { key: string }) => blobs.get(key.key)),
    },
  };
});

let dedup: typeof import('../../src/workspace/import-dedup');

beforeEach(async () => {
  blobs.clear();
  vi.resetModules();
  dedup = await import('../../src/workspace/import-dedup');
});

afterEach(() => {
  vi.clearAllMocks();
});

function makeReport(overrides: Partial<WorkspaceExportImportReport> = {}): WorkspaceExportImportReport {
  return {
    schemaVersion: 5,
    source: 'workspace-export',
    sourceHash: '',
    importedAt: '2026-04-27T10:00:00.000Z',
    summary: { imported: 1, dropped: 0, transformed: 0 },
    drops: [],
    transforms: [],
    exportId: 'aaaaaaaa',
    perEntityStrategies: {},
    missingDeps: [],
    targetMode: 'current',
    sourceWorkspaceLabel: 'Source',
    sourceAppVersion: '5.0.0',
    ...overrides,
  };
}

describe('findExportImportMatches — exportId precedence', () => {
  it('returns nothing when no rings contain the export', async () => {
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdSameTarget).toEqual([]);
    expect(res.exportIdOtherTargets).toEqual([]);
    expect(res.workspaceUidMatches).toEqual([]);
  });

  it('places same-target hits in `exportIdSameTarget`', async () => {
    blobs.set('oh.ws.ws-a.importReports', [makeReport({ exportId: 'aaaaaaaa' })]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdSameTarget).toHaveLength(1);
    expect(res.exportIdSameTarget[0]?.workspaceId).toBe('ws-a');
    expect(res.exportIdOtherTargets).toEqual([]);
  });

  it('places other-target hits in `exportIdOtherTargets`', async () => {
    blobs.set('oh.ws.ws-b.importReports', [makeReport({ exportId: 'aaaaaaaa' })]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdSameTarget).toEqual([]);
    expect(res.exportIdOtherTargets).toHaveLength(1);
    expect(res.exportIdOtherTargets[0]?.workspaceId).toBe('ws-b');
    expect(res.exportIdOtherTargets[0]?.workspaceName).toBe('Beta');
  });

  it('sorts hits newest-first by importedAt', async () => {
    blobs.set('oh.ws.ws-b.importReports', [
      makeReport({ exportId: 'aaaaaaaa', importedAt: '2026-04-20T10:00:00.000Z' }),
    ]);
    blobs.set('oh.ws.ws-c.importReports', [
      makeReport({ exportId: 'aaaaaaaa', importedAt: '2026-04-26T10:00:00.000Z' }),
    ]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdOtherTargets).toHaveLength(2);
    expect(res.exportIdOtherTargets[0]?.workspaceId).toBe('ws-c');
    expect(res.exportIdOtherTargets[1]?.workspaceId).toBe('ws-b');
  });
});

describe('findExportImportMatches — workspace.uid fallback', () => {
  it('reports workspace.uid matches when no exportId hit', async () => {
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'ws-b',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.workspaceUidMatches).toHaveLength(1);
    expect(res.workspaceUidMatches[0]?.workspaceId).toBe('ws-b');
  });

  it('suppresses workspace.uid match when the same workspace already had an exportId hit', async () => {
    blobs.set('oh.ws.ws-b.importReports', [makeReport({ exportId: 'aaaaaaaa' })]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'ws-b',
      currentTargetWorkspaceId: 'ws-a',
    });
    // ws-b was already covered by the exportId hit — don't report it twice.
    expect(res.workspaceUidMatches).toEqual([]);
    expect(res.exportIdOtherTargets).toHaveLength(1);
  });
});

describe('findExportImportMatches — robustness', () => {
  it('ignores non-workspace-export entries in the ring', async () => {
    blobs.set('oh.ws.ws-a.importReports', [
      {
        schemaVersion: 5,
        source: 'curl',
        sourceHash: 'sha256:dead',
        importedAt: '2026-04-27T00:00:00.000Z',
        summary: { imported: 1, dropped: 0, transformed: 0 },
        drops: [],
        transforms: [],
      },
    ]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdSameTarget).toEqual([]);
  });

  it('ignores corrupt ring entries (silent-drop semantics)', async () => {
    blobs.set('oh.ws.ws-a.importReports', [
      { source: 'workspace-export', exportId: 'aaaaaaaa' /* missing required fields */ },
    ]);
    const res = await dedup.findExportImportMatches({
      exportId: 'aaaaaaaa',
      workspaceUid: 'wuid0001',
      currentTargetWorkspaceId: 'ws-a',
    });
    expect(res.exportIdSameTarget).toEqual([]);
  });
});
