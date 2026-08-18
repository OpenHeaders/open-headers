/**
 * UpdateCollectionModal — the per-link Update action (the API-specs plan
 * Phase F). Pins:
 *   - an in-sync collection presents the empty-plan state and Apply
 *     only rewrites `specLink.sourceHash` ("Mark in sync");
 *   - a drifted document presents adds/changes checked and removes
 *     UNCHECKED — a default Apply creates and converges but never
 *     deletes, and rewrites the source hash in the same gesture;
 *   - opting a removal row in deletes that request;
 *   - a non-parsing document shows the error and disables Apply.
 */

import { hashImportSource, parseOpenApi } from '@openheaders/core/import';
import type { Collection, CollectionTree, Request, Spec } from '@openheaders/core/types';
import { RequestsContext, type RequestsContextValue } from '@openheaders/ui/context';
import UpdateCollectionModal from '@openheaders/ui/workbench/components/specs/UpdateCollectionModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Typography ellipsis measures via rc-resize-observer; jsdom has no
// ResizeObserver.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

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

function specYaml(opts: { extraOp?: boolean; statusParam?: boolean; dropUsers?: boolean } = {}) {
  const lines = [
    "openapi: '3.1.0'",
    'info:',
    '  title: OpenHeaders API',
    "  version: '1.0.0'",
    'servers:',
    '  - url: https://api.openheaders.io',
    'paths:',
    '  /status:',
    '    get:',
    '      summary: Status',
  ];
  if (opts.statusParam) {
    lines.push(
      '      parameters:',
      '        - name: verbose',
      '          in: query',
      '          schema: { type: string }',
    );
  }
  lines.push('      responses:', "        '200':", '          description: OK');
  if (!opts.dropUsers) {
    lines.push(
      '  /users:',
      '    get:',
      '      summary: List users',
      '      responses:',
      "        '200':",
      '          description: OK',
    );
  }
  if (opts.extraOp) {
    lines.push(
      '  /users/{userId}:',
      '    get:',
      '      summary: Get user',
      '      responses:',
      "        '200':",
      '          description: OK',
    );
  }
  return `${lines.join('\n')}\n`;
}

const V1_CONTENT = specYaml();

function makeSpec(content: string): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/openheaders-api-spc00001',
    name: 'OpenHeaders API',
    format: 'openapi-3.1',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content }],
  };
}

/** Live collection + rows as landing v1 would have created them. */
function makeLive(): { collection: Collection; requests: Request[]; tree: CollectionTree } {
  const parsed = parseOpenApi(V1_CONTENT);
  const requests: Request[] = parsed.requests.map((r, i) => ({
    schemaVersion: 5,
    uid: `req0000${i + 1}`,
    path: `requests/openheaders-api-col00001/r${i + 1}`,
    name: r.request.name,
    method: r.request.method,
    url: r.request.url,
    headers: r.request.headers,
    params: r.request.params,
    auth: r.request.auth,
    body: r.request.body,
  }));
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/openheaders-api-col00001',
    name: 'OpenHeaders API',
    variables: parsed.collectionVariables.map((v, i) => ({
      uid: `var0000${i + 1}`,
      name: v.name,
      value: v.value,
      type: v.type,
    })),
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    specLink: { specUid: 'spc00001', sourceHash: 'sha256:v1' },
  };
  const tree: CollectionTree = {
    ...collection,
    tree: requests.map((r) => ({ type: 'request', uid: r.uid, name: r.name, path: r.path, method: r.method })),
  };
  return { collection, requests, tree };
}

function makeRequestsValue(
  live: ReturnType<typeof makeLive>,
  overrides: Partial<RequestsContextValue> = {},
): RequestsContextValue {
  return {
    requests: live.requests,
    collections: [live.collection],
    folders: [],
    collectionTrees: [live.tree],
    isReady: true,
    getRequest: vi.fn(async () => null),
    createRequest: vi.fn(async () => null),
    updateRequest: vi.fn(async () => ({ ok: true as const, request: live.requests[0] as Request })),
    deleteRequest: vi.fn(async () => true),
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

function renderModal(value: RequestsContextValue, live: ReturnType<typeof makeLive>, content: string) {
  const onCancel = vi.fn();
  render(
    <App>
      <RequestsContext.Provider value={value}>
        <UpdateCollectionModal
          open
          spec={makeSpec(content)}
          content={content}
          collection={live.collection}
          editorDirty={false}
          onCancel={onCancel}
        />
      </RequestsContext.Provider>
    </App>,
  );
  return { onCancel };
}

describe('UpdateCollectionModal', () => {
  it('presents the in-sync state and Apply only rewrites the source hash', async () => {
    const live = makeLive();
    const value = makeRequestsValue(live);
    const { onCancel } = renderModal(value, live, V1_CONTENT);

    expect(screen.getByTestId('spec-update-in-sync')).toBeTruthy();
    expect(screen.getByText('Mark in sync')).toBeTruthy();

    fireEvent.click(screen.getByTestId('spec-update-confirm'));
    const expectedHash = await hashImportSource(V1_CONTENT);
    await waitFor(() => {
      expect(value.setCollectionSpecLink).toHaveBeenCalledWith('col00001', {
        specUid: 'spc00001',
        sourceHash: expectedHash,
      });
    });
    expect(value.createRequest).not.toHaveBeenCalled();
    expect(value.updateRequest).not.toHaveBeenCalled();
    expect(value.deleteRequest).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('applies adds and changes by default, never removes, and rewrites the hash', async () => {
    const v2 = specYaml({ extraOp: true, statusParam: true, dropUsers: true });
    const live = makeLive();
    const createRequest = vi.fn(async () => ({
      schemaVersion: 5 as const,
      uid: 'req00050',
      path: 'requests/openheaders-api-col00001/new',
      name: 'Get user',
      method: 'GET' as const,
      url: 'u',
      headers: [],
      params: [],
      auth: { type: 'none' as const },
      body: { type: 'none' as const },
    }));
    const value = makeRequestsValue(live, { createRequest });
    renderModal(value, live, v2);

    expect(screen.getByText('Added (1)')).toBeTruthy();
    expect(screen.getByText('Changed (1)')).toBeTruthy();
    expect(screen.getByText('Removed from spec (1)')).toBeTruthy();

    fireEvent.click(screen.getByTestId('spec-update-confirm'));
    const expectedHash = await hashImportSource(v2);
    await waitFor(() => {
      expect(value.setCollectionSpecLink).toHaveBeenCalledWith('col00001', {
        specUid: 'spc00001',
        sourceHash: expectedHash,
      });
    });
    expect(createRequest).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Get user', parentPath: live.collection.path }),
    );
    expect(value.updateRequest).toHaveBeenCalledTimes(1);
    expect(value.updateRequest).toHaveBeenCalledWith(
      'req00001',
      expect.objectContaining({ params: [expect.objectContaining({ key: 'verbose' })] }),
    );
    expect(value.deleteRequest).not.toHaveBeenCalled();
  });

  it('deletes a removal row once the user opts it in', async () => {
    const v2 = specYaml({ dropUsers: true });
    const live = makeLive();
    const value = makeRequestsValue(live);
    renderModal(value, live, v2);

    fireEvent.click(screen.getByTestId('spec-update-remove-req00002'));
    fireEvent.click(screen.getByTestId('spec-update-confirm'));
    await waitFor(() => {
      expect(value.deleteRequest).toHaveBeenCalledWith('req00002');
    });
  });

  it('disables Apply and shows the error on a non-parsing document', () => {
    const live = makeLive();
    renderModal(makeRequestsValue(live), live, 'not: [valid openapi');
    expect(screen.getByText("This specification doesn't parse")).toBeTruthy();
    expect((screen.getByTestId('spec-update-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
