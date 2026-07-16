/**
 * GenerateCollectionModal — the spec editor's Generate Collection
 * action (API_SPECS_PLAN.md Phase E). Pins:
 *   - the modal parses the SAVED content and pre-fills the required
 *     name from the document's info.title;
 *   - Generate rides the shared landing loop through the Requests
 *     context legs, then records `specLink` {specUid, sourceHash} on
 *     the created collection (sourceHash = sha256 of the saved
 *     source);
 *   - a non-parsing document shows the parse error and disables
 *     Generate.
 */

import { hashImportSource } from '@openheaders/core/import';
import type { Spec } from '@openheaders/core/types';
import { RequestsContext, type RequestsContextValue } from '@openheaders/ui/context';
import GenerateCollectionModal from '@openheaders/ui/workbench/components/specs/GenerateCollectionModal';
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

const SPEC_CONTENT = [
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
  '      responses:',
  "        '200':",
  '          description: OK',
  '',
].join('\n');

const SPEC: Spec = {
  schemaVersion: 5,
  uid: 'spc00001',
  path: 'specs/openheaders-api-spc00001',
  name: 'OpenHeaders API',
  format: 'openapi-3.1',
  rootFileUid: 'fil00001',
  files: [{ uid: 'fil00001', fileName: 'index.yaml', content: SPEC_CONTENT }],
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
    ...overrides,
  };
}

function renderModal(
  value: RequestsContextValue,
  props: Partial<React.ComponentProps<typeof GenerateCollectionModal>> = {},
): { onCancel: ReturnType<typeof vi.fn> } {
  const onCancel = vi.fn();
  render(
    <App>
      <RequestsContext.Provider value={value}>
        <GenerateCollectionModal
          open
          spec={SPEC}
          content={SPEC_CONTENT}
          editorDirty={false}
          onCancel={onCancel}
          {...props}
        />
      </RequestsContext.Provider>
    </App>,
  );
  return { onCancel };
}

describe('GenerateCollectionModal', () => {
  it('pre-fills the name from info.title and shows the counts', () => {
    renderModal(makeRequestsValue());
    expect((screen.getByTestId('spec-generate-name') as HTMLInputElement).value).toBe('OpenHeaders API');
    expect(screen.getByText('1 request')).toBeTruthy();
  });

  it('generates through the landing legs and records the specLink with the source hash', async () => {
    const createCollection = vi.fn(async (name: string) => ({
      schemaVersion: 5 as const,
      uid: 'col00001',
      path: `requests/${name}`,
      name,
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    }));
    const createRequest = vi.fn(async () => null);
    const setCollectionSpecLink = vi.fn(async () => true);
    const value = makeRequestsValue({ createCollection, createRequest, setCollectionSpecLink });
    const { onCancel } = renderModal(value);

    fireEvent.click(screen.getByTestId('spec-generate-confirm'));

    const expectedHash = await hashImportSource(SPEC_CONTENT);
    await waitFor(() => {
      expect(setCollectionSpecLink).toHaveBeenCalledWith('col00001', {
        specUid: 'spc00001',
        sourceHash: expectedHash,
      });
    });
    expect(createCollection).toHaveBeenCalledWith('OpenHeaders API');
    expect(createRequest).toHaveBeenCalledTimes(1);
    // The collection variables leg carries {{baseUrl}} from `servers`.
    expect(value.setCollectionVariables).toHaveBeenCalledWith('col00001', [
      expect.objectContaining({ name: 'baseUrl', value: 'https://api.openheaders.io' }),
    ]);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the dirty hint when the editor buffer has unsaved changes', () => {
    renderModal(makeRequestsValue(), { editorDirty: true });
    expect(screen.getByText(/generation uses the last saved document/i)).toBeTruthy();
  });

  it('disables Generate and shows the error on a non-parsing document', () => {
    renderModal(makeRequestsValue(), { content: 'not: [valid openapi' });
    expect(screen.getByText("This specification doesn't parse")).toBeTruthy();
    expect((screen.getByTestId('spec-generate-confirm') as HTMLButtonElement).disabled).toBe(true);
  });
});
