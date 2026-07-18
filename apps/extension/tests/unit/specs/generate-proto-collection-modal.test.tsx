/**
 * GenerateProtoCollectionModal — the Protobuf spec editor's Generate
 * Collection action (GRPC_CLIENT_PLAN.md Phase G). Pins:
 *   - the modal pre-fills the name from the spec entity and shows the
 *     method/service counts;
 *   - Generate creates the collection, one folder per service (multi-
 *     service specs), one GrpcRequest per rpc with the example message
 *     pre-filled, then records `specLink` {specUid, sourceHash};
 *   - a document with no service methods disables Generate.
 */

import { hashImportSource } from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { RequestsContext, type RequestsContextValue } from '@openheaders/ui/context';
import GenerateProtoCollectionModal from '@openheaders/ui/workbench/components/specs/GenerateProtoCollectionModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import type React from 'react';
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

const PROTO_CONTENT = [
  'syntax = "proto3";',
  'package library.v1;',
  '',
  'message GetBookRequest { string name = 1; }',
  'message Book { string name = 1; string title = 2; }',
  '',
  'service Library {',
  '  rpc GetBook(GetBookRequest) returns (Book);',
  '}',
  '',
  'service Shelf {',
  '  rpc GetBook(GetBookRequest) returns (Book);',
  '}',
  '',
].join('\n');

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spc00001',
  path: 'specs/books-spc00001',
  name: 'Books API',
  format: 'protobuf',
  rootFileUid: 'fil00001',
  files: [{ uid: 'fil00001', fileName: 'index.proto', content: PROTO_CONTENT }],
};

function makeRequestsValue(overrides: Partial<RequestsContextValue> = {}): RequestsContextValue {
  return {
    requests: [],
    collections: [],
    folders: [],
    collectionTrees: [],
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
    ...overrides,
  };
}

function renderModal(
  value: RequestsContextValue,
  props: Partial<React.ComponentProps<typeof GenerateProtoCollectionModal>> = {},
): { onCancel: ReturnType<typeof vi.fn> } {
  const onCancel = vi.fn();
  render(
    <App>
      <RequestsContext.Provider value={value}>
        <GenerateProtoCollectionModal
          open
          spec={SPEC}
          content={PROTO_CONTENT}
          editorDirty={false}
          onCancel={onCancel}
          {...props}
        />
      </RequestsContext.Provider>
    </App>,
  );
  return { onCancel };
}

describe('GenerateProtoCollectionModal', () => {
  it('pre-fills the name from the spec and shows the counts', () => {
    renderModal(makeRequestsValue());
    expect((screen.getByTestId('spec-generate-name') as HTMLInputElement).value).toBe('Books API');
    expect(screen.getByText('2 gRPC requests')).toBeTruthy();
    expect(screen.getByText('2 services')).toBeTruthy();
  });

  it('generates per-service folders and gRPC requests, then records the specLink', async () => {
    const createCollection = vi.fn(async (name: string) => ({
      schemaVersion: 5 as const,
      uid: 'col00001',
      path: `requests/${name}`,
      name,
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    }));
    const createFolder = vi.fn(async (name: string, parentPath: string) => ({
      uid: `fld-${name}`,
      path: `${parentPath}/${name}`,
      name,
    }));
    const createGrpcRequest = vi.fn(async (input: { name: string; parentPath: string }) => ({
      schemaVersion: 5 as const,
      uid: `grq-${input.name}`,
      path: `${input.parentPath}/${input.name}`,
      name: input.name,
      url: '',
      message: '',
      metadata: [],
    }));
    const setCollectionSpecLink = vi.fn(async () => true);
    const value = makeRequestsValue({ createCollection, createFolder, createGrpcRequest, setCollectionSpecLink });
    const { onCancel } = renderModal(value);

    fireEvent.click(screen.getByTestId('spec-generate-confirm'));

    const expectedHash = await hashImportSource(PROTO_CONTENT);
    await waitFor(() => {
      expect(setCollectionSpecLink).toHaveBeenCalledWith('col00001', {
        specUid: 'spc00001',
        sourceHash: expectedHash,
      });
    });
    expect(createCollection).toHaveBeenCalledWith('Books API');
    expect(createFolder).toHaveBeenCalledWith('library.v1.Library', 'requests/Books API');
    expect(createFolder).toHaveBeenCalledWith('library.v1.Shelf', 'requests/Books API');
    expect(createGrpcRequest).toHaveBeenCalledTimes(2);
    expect(createGrpcRequest).toHaveBeenCalledWith({
      name: 'GetBook',
      parentPath: 'requests/Books API/library.v1.Library',
      seed: expect.objectContaining({
        method: { service: 'library.v1.Library', rpc: 'GetBook' },
        specLink: { specUid: 'spc00001' },
        message: expect.stringContaining('"name"'),
      }),
    });
    expect(onCancel).toHaveBeenCalled();
  });

  it('lands single-service specs flat in the collection root', async () => {
    const singleService = [
      'syntax = "proto3";',
      'package library.v1;',
      'message GetBookRequest { string name = 1; }',
      'message Book { string name = 1; }',
      'service Library {',
      '  rpc GetBook(GetBookRequest) returns (Book);',
      '}',
    ].join('\n');
    const spec: Spec = { ...SPEC, files: [{ uid: 'fil00001', fileName: 'index.proto', content: singleService }] };
    const createCollection = vi.fn(async (name: string) => ({
      schemaVersion: 5 as const,
      uid: 'col00001',
      path: `requests/${name}`,
      name,
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    }));
    const createFolder = vi.fn(async () => null);
    const createGrpcRequest = vi.fn(async () => null);
    const value = makeRequestsValue({ createCollection, createFolder, createGrpcRequest });
    renderModal(value, { spec, content: singleService });

    fireEvent.click(screen.getByTestId('spec-generate-confirm'));

    await waitFor(() => {
      expect(createGrpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'GetBook', parentPath: 'requests/Books API' }),
      );
    });
    expect(createFolder).not.toHaveBeenCalled();
  });

  it('disables Generate when the document declares no service methods', () => {
    const spec: Spec = {
      ...SPEC,
      files: [{ uid: 'fil00001', fileName: 'index.proto', content: 'syntax = "proto3";\nmessage Empty {}\n' }],
    };
    renderModal(makeRequestsValue(), { spec, content: 'syntax = "proto3";\nmessage Empty {}\n' });
    expect(screen.getByTestId('spec-generate-proto-empty')).toBeTruthy();
    expect((screen.getByTestId('spec-generate-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
