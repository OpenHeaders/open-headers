/**
 * In-tab import target clamp (A5, as gated S12): on a joined tab
 * import-into-new lands on the server — an absent or non-server orgId
 * is overridden to the daemon-bound Org, an explicit server orgId
 * passes through, and the never-joined offline tab (no bound Org)
 * keeps its local target untouched. Plus the source-level pin from the
 * S12 audit: the tab holds only the migration MIRROR — no module under
 * apps/web/src may import the oracle migration plane (the pull and its
 * materializer run daemon-side).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({
  bindings: new Map<string, string>(),
}));
vi.mock('@openheaders/core/identity', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/core/identity')>()),
  getOrgBackendBindings: () => identity.bindings,
}));

const orchestrator = vi.hoisted(() => ({
  importWorkspace: vi.fn(async (_args: { target: unknown }) => ({ report: {}, targetWorkspaceId: 'ws-imported' })),
  previewWorkspaceImport: vi.fn(),
}));
vi.mock('@openheaders/oracle/workspace/import-orchestrator', () => orchestrator);

vi.mock('@openheaders/ui/shared/build-info', () => ({
  getBuildInfo: () => ({ version: '0.0.0-test' }),
}));

import { WEB_DAEMON_BACKEND_ID } from '@/host/web-backend-id';
import { dispatchExportImportRpc } from '@/host/web-export-import-rpc';

const SERVER_ORG = 'org-server';

function importMessage(target: Record<string, unknown>): Record<string, unknown> {
  return {
    incoming: { entities: {}, secrets: undefined },
    target,
    sourceHash: 'hash',
  };
}

async function importedTarget(target: Record<string, unknown>): Promise<unknown> {
  await dispatchExportImportRpc('importWorkspace', importMessage(target));
  expect(orchestrator.importWorkspace).toHaveBeenCalledTimes(1);
  return orchestrator.importWorkspace.mock.calls[0][0].target;
}

beforeEach(() => {
  orchestrator.importWorkspace.mockClear();
  identity.bindings = new Map([[SERVER_ORG, WEB_DAEMON_BACKEND_ID]]);
});

describe('import-into-new lands on the server', () => {
  it('overrides an absent orgId with the daemon-bound Org', async () => {
    expect(await importedTarget({ mode: 'new', name: 'Fresh' })).toEqual({
      mode: 'new',
      name: 'Fresh',
      orgId: SERVER_ORG,
    });
  });

  it('overrides a non-server orgId — the browser Org would mint an unsyncable island', async () => {
    expect(await importedTarget({ mode: 'new', orgId: 'org-browser-home' })).toEqual({
      mode: 'new',
      orgId: SERVER_ORG,
    });
  });

  it('keeps an explicit server orgId', async () => {
    expect(await importedTarget({ mode: 'new', orgId: SERVER_ORG })).toEqual({ mode: 'new', orgId: SERVER_ORG });
  });

  it('leaves picked and current targets untouched', async () => {
    expect(await importedTarget({ mode: 'picked', workspaceId: 'ws-x' })).toEqual({
      mode: 'picked',
      workspaceId: 'ws-x',
    });
  });

  it('passes through unchanged on the never-joined offline tab', async () => {
    identity.bindings = new Map();
    expect(await importedTarget({ mode: 'new', name: 'Local' })).toEqual({ mode: 'new', name: 'Local' });
  });
});

describe('the migration plane stays daemon-side', () => {
  it('no module under apps/web/src imports @openheaders/oracle/migration', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes('@openheaders/oracle/migration')) {
          offenders.push(path.relative(srcDir, full));
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
