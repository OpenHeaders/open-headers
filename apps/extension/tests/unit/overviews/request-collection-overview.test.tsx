/**
 * RequestCollectionOverview + RequestFolderOverview — the gRPC-family
 * legs of the request overview tabs. Pins:
 *   - `grpc-request` tree nodes render as request rows with the gRPC
 *     mark, never as the defensive folder fall-through ("Folder · 0
 *     requests" — the live-pass find);
 *   - the stats bar and folder child counts include gRPC requests;
 *   - clicking a gRPC row opens its editor via `onSelectGrpcRequest`.
 */

import type { CollectionTree } from '@openheaders/core/types';
import { RequestsContext, type RequestsContextValue } from '@openheaders/ui/context';
import RequestCollectionOverview from '@openheaders/ui/workbench/components/overviews/RequestCollectionOverview';
import RequestFolderOverview from '@openheaders/ui/workbench/components/overviews/RequestFolderOverview';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(cleanup);

const COLLECTION_TREE: CollectionTree = {
  schemaVersion: 5,
  uid: 'col00001',
  path: 'requests/probe-col00001',
  name: 'Probe',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  tree: [
    {
      type: 'folder',
      uid: 'fld00001',
      name: 'openheaders.e2e.LibraryService',
      path: 'requests/probe-col00001/library',
      children: [
        {
          type: 'grpc-request',
          uid: 'grp00002',
          name: 'GetShelf',
          path: 'requests/probe-col00001/library/getshelf-grp00002',
        },
      ],
    },
    { type: 'request', uid: 'req00001', name: 'Ping', path: 'requests/probe-col00001/ping-req00001', method: 'GET' },
    { type: 'grpc-request', uid: 'grp00001', name: 'GetBook', path: 'requests/probe-col00001/getbook-grp00001' },
  ],
};

function makeRequestsValue(overrides: Partial<RequestsContextValue> = {}): RequestsContextValue {
  return {
    requests: [],
    collections: [],
    folders: [],
    collectionTrees: [COLLECTION_TREE],
    isReady: true,
    getRequest: vi.fn(async () => null),
    createRequest: vi.fn(async () => null),
    updateRequest: vi.fn(async () => ({ ok: false as const, reason: 'other' as const, message: 'not wired' })),
    deleteRequest: vi.fn(async () => false),
    grpcRequests: [],
    createGrpcRequest: vi.fn(async () => null),
    updateGrpcRequest: vi.fn(async () => ({ ok: false as const, reason: 'other' as const, message: 'not wired' })),
    deleteGrpcRequest: vi.fn(async () => false),
    websocketRequests: [],
    createWebSocketRequest: vi.fn(async () => null),
    updateWebSocketRequest: vi.fn(async () => ({
      ok: false as const,
      reason: 'other' as const,
      message: 'not wired',
    })),
    deleteWebSocketRequest: vi.fn(async () => false),
    createCollection: vi.fn(async () => null),
    renameCollection: vi.fn(async () => false),
    deleteCollection: vi.fn(async () => false),
    createFolder: vi.fn(async () => null),
    renameFolder: vi.fn(async () => false),
    deleteFolder: vi.fn(async () => false),
    setCollectionScripts: vi.fn(async () => false),
    setFolderScripts: vi.fn(async () => false),
    setCollectionAuth: vi.fn(async () => true),
    setFolderAuth: vi.fn(async () => false),
    setCollectionVariables: vi.fn(async () => true),
    setCollectionSpecLink: vi.fn(async () => true),
    execute: vi.fn(async () => null),
    executeGrpc: vi.fn(async () => null),
    executeWebSocket: vi.fn(async () => null),
    ...overrides,
  };
}

function renderCollectionOverview(): { onSelectGrpcRequest: ReturnType<typeof vi.fn> } {
  const onSelectGrpcRequest = vi.fn();
  render(
    <RequestsContext.Provider value={makeRequestsValue()}>
      <RequestCollectionOverview
        collectionUid="col00001"
        onSelectRequest={vi.fn()}
        onSelectGrpcRequest={onSelectGrpcRequest}
        onSelectWebSocketRequest={vi.fn()}
        onCreateRequest={vi.fn()}
        onOpenFolderOverview={vi.fn()}
      />
    </RequestsContext.Provider>,
  );
  return { onSelectGrpcRequest };
}

function renderFolderOverview(): { onSelectGrpcRequest: ReturnType<typeof vi.fn> } {
  const onSelectGrpcRequest = vi.fn();
  render(
    <RequestsContext.Provider value={makeRequestsValue()}>
      <RequestFolderOverview
        folderUid="fld00001"
        onSelectRequest={vi.fn()}
        onSelectGrpcRequest={onSelectGrpcRequest}
        onSelectWebSocketRequest={vi.fn()}
        onCreateRequest={vi.fn()}
        onOpenFolderOverview={vi.fn()}
      />
    </RequestsContext.Provider>,
  );
  return { onSelectGrpcRequest };
}

describe('RequestCollectionOverview — gRPC family', () => {
  it('counts gRPC requests in the stats bar and the folder child cell', () => {
    renderCollectionOverview();
    // 1 HTTP + 2 gRPC (one nested) — never the pre-fix "1 request".
    expect(screen.getByText(/3 requests/)).toBeTruthy();
    expect(screen.getByText('Folder · 1 request')).toBeTruthy();
  });

  it('renders gRPC rows with the gRPC mark, not as empty folders', () => {
    renderCollectionOverview();
    expect(screen.getByText('GetBook')).toBeTruthy();
    expect(screen.getAllByText('gRPC').length).toBeGreaterThan(0);
    // The defensive fall-through would render "Folder · 0 requests".
    expect(screen.queryByText('Folder · 0 requests')).toBeNull();
  });

  it('clicking a gRPC row opens its editor', () => {
    const { onSelectGrpcRequest } = renderCollectionOverview();
    fireEvent.click(screen.getByText('GetBook'));
    expect(onSelectGrpcRequest).toHaveBeenCalledWith('grp00001', 'GetBook');
  });
});

describe('RequestFolderOverview — gRPC family', () => {
  it('counts and renders nested gRPC requests, and click-through opens the editor', () => {
    const { onSelectGrpcRequest } = renderFolderOverview();
    expect(screen.getByText(/1 request/)).toBeTruthy();
    expect(screen.getByText('GetShelf')).toBeTruthy();
    expect(screen.queryByText('Folder · 0 requests')).toBeNull();
    fireEvent.click(screen.getByText('GetShelf'));
    expect(onSelectGrpcRequest).toHaveBeenCalledWith('grp00002', 'GetShelf');
  });
});
