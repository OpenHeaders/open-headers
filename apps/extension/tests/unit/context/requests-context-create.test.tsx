/**
 * `RequestsContext.createRequest` on the override branch (the workbench)
 * builds the entity field by field before the write client seeds it.
 * Every create passes through it — the scratch request's first save,
 * the import landings, Generate Collection, the Update dialog's add —
 * so an optional field the builder skips is dropped on every create
 * while the update path keeps it. Pins the path parameter rows riding
 * the seed whole, and the field absent when the seed carries none.
 */

import type { PathParam, Request } from '@openheaders/core/types';
import { RequestsProvider, useRequestsContext } from '@openheaders/ui/context';
import { act, cleanup, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockApplyRequestCreate } = vi.hoisted(() => ({ mockApplyRequestCreate: vi.fn() }));

vi.mock('@openheaders/ui/shared/sync/request-write-client', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/ui/shared/sync/request-write-client')>()),
  applyRequestCreate: mockApplyRequestCreate,
}));

// The provider's read path mounts the container mirrors for the tree's
// slot order; the create under test never reads them.
vi.mock('@openheaders/ui/context/mirrors/request-collection-sync-mirror', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/ui/context/mirrors/request-collection-sync-mirror')>()),
  getRequestCollectionSyncMirrorForWorkspace: () => ({
    liveOrderedSetItems: () => [],
    subscribeAny: () => () => undefined,
  }),
}));
vi.mock('@openheaders/ui/context/mirrors/request-folder-sync-mirror', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/ui/context/mirrors/request-folder-sync-mirror')>()),
  getRequestFolderSyncMirrorForWorkspace: () => ({
    liveOrderedSetItems: () => [],
    subscribeAny: () => () => undefined,
  }),
}));

const ROWS: PathParam[] = [{ uid: 'pp000001', key: 'petId', value: '42', description: 'The pet to read.' }];

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <RequestsProvider surfaceId="workbench" activeWorkspaceIdOverride="ws-1">
      {children}
    </RequestsProvider>
  );
}

function seededEntity(): Request {
  const [entity] = mockApplyRequestCreate.mock.calls[0] as [Request, { workspaceId: string; surfaceId: string }];
  return entity;
}

beforeEach(() => {
  mockApplyRequestCreate.mockReset();
  mockApplyRequestCreate.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('RequestsContext.createRequest — path parameters', () => {
  it('carries the seed rows onto the created entity handed to the write client', async () => {
    const { result } = renderHook(() => useRequestsContext(), { wrapper: Wrapper });

    let created: Request | null = null;
    await act(async () => {
      created = await result.current.createRequest({
        name: 'Read pet',
        parentPath: 'requests/pets-col00001',
        seed: { method: 'GET', url: 'https://api.openheaders.io/pets/:petId', pathParams: ROWS },
      });
    });

    expect(mockApplyRequestCreate).toHaveBeenCalledTimes(1);
    expect(seededEntity().pathParams).toEqual(ROWS);
    expect(mockApplyRequestCreate.mock.calls[0][1]).toEqual({ workspaceId: 'ws-1', surfaceId: 'workbench' });
    expect(created).not.toBeNull();
    expect(created!.pathParams).toEqual(ROWS);
  });

  it('leaves the field absent when the seed carries none', async () => {
    const { result } = renderHook(() => useRequestsContext(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.createRequest({
        name: 'Ping',
        parentPath: 'requests/pets-col00001',
        seed: { url: 'https://api.openheaders.io/ping' },
      });
    });

    expect('pathParams' in seededEntity()).toBe(false);
  });
});
