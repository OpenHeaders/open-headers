/**
 * ImportSectionedModal — spec-entity landing (API_SPECS_PLAN.md Phase
 * G). Pins:
 *   - OpenAPI imports default to "Specification with a Collection":
 *     the document lands verbatim as a spec entity and the generated
 *     collection binds `specLink` {specUid, sourceHash};
 *   - the chooser's "Collection" option keeps today's convert-only
 *     behavior (no spec entity, no link);
 *   - Insomnia embedded `api_spec` documents retain with NO chooser,
 *     each linked to the collection the OpenAPI importer minted;
 *   - a surface without a spec plane (`createSpec` absent) records an
 *     honest report drop instead of silently discarding documents.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import { hashImportSource, type ImportReport } from '@openheaders/core/import';
import ImportSectionedModal from '@openheaders/ui/workbench/components/import/ImportSectionedModal';
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

const OPENAPI_YAML = [
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

const INSOMNIA_EXPORT = JSON.stringify({
  _type: 'export',
  __export_format: 4,
  resources: [
    { _id: 'wrk_1', _type: 'workspace', name: 'Openheaders Workspace' },
    {
      _id: 'req_1',
      _type: 'request',
      parentId: 'wrk_1',
      name: 'Ping',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
    },
    { _id: 'spc_1', _type: 'api_spec', parentId: 'wrk_1', fileName: 'openapi.yaml', contents: OPENAPI_YAML },
  ],
});

interface Harness {
  createSpec: ReturnType<typeof vi.fn>;
  setCollectionSpecLink: ReturnType<typeof vi.fn>;
  onImported: ReturnType<typeof vi.fn>;
}

function renderModal(
  props: Partial<React.ComponentProps<typeof ImportSectionedModal>> & {
    sourceKind: React.ComponentProps<typeof ImportSectionedModal>['sourceKind'];
    initialText: string;
  },
): Harness {
  let collectionSeq = 0;
  const createSpec = vi.fn(async () => ({ uid: 'spc-created-1' }));
  const setCollectionSpecLink = vi.fn(async () => true);
  const onImported = vi.fn();
  render(
    <App>
      <ImportSectionedModal
        open
        onCancel={() => undefined}
        onImported={onImported}
        createCollection={async (name) => {
          collectionSeq += 1;
          return { uid: `col-${collectionSeq}`, path: `requests/${name}` };
        }}
        createFolder={async (name, parentPath) => ({ uid: `fld-${name}`, path: `${parentPath}/${name}` })}
        createRequest={async () => ({ uid: 'req-created' })}
        createEnvironment={async () => ({ uid: 'env-created' })}
        createSpec={createSpec}
        setCollectionSpecLink={setCollectionSpecLink}
        {...props}
      />
    </App>,
  );
  return { createSpec, setCollectionSpecLink, onImported };
}

const importButton = (): HTMLElement => screen.getByRole('button', { name: /import/i });

describe('ImportSectionedModal — spec landing', () => {
  it('lands the OpenAPI document as a spec entity and binds the collection specLink by default', async () => {
    const { createSpec, setCollectionSpecLink, onImported } = renderModal({
      sourceKind: 'openapi',
      initialText: OPENAPI_YAML,
    });
    expect(screen.getByText('IMPORT AS')).toBeTruthy();
    expect(screen.getByText(/SPECIFICATIONS · 1/)).toBeTruthy();

    fireEvent.click(importButton());

    const expectedHash = await hashImportSource(OPENAPI_YAML);
    await waitFor(() => {
      expect(setCollectionSpecLink).toHaveBeenCalledWith('col-1', {
        specUid: 'spc-created-1',
        sourceHash: expectedHash,
      });
    });
    expect(createSpec).toHaveBeenCalledWith({
      name: 'OpenHeaders API',
      content: OPENAPI_YAML,
      format: 'openapi-3.1',
    });
    expect(onImported).toHaveBeenCalled();
  });

  it('keeps convert-only behavior when the chooser selects Collection', async () => {
    const { createSpec, setCollectionSpecLink, onImported } = renderModal({
      sourceKind: 'openapi',
      initialText: OPENAPI_YAML,
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Collection' }));
    expect(screen.queryByText(/SPECIFICATIONS · 1/)).toBeNull();

    fireEvent.click(importButton());

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(createSpec).not.toHaveBeenCalled();
    expect(setCollectionSpecLink).not.toHaveBeenCalled();
    const report = onImported.mock.calls[0]?.[0]?.report as ImportReport;
    expect(report.drops.some((d) => d.path.startsWith('specs'))).toBe(false);
  });

  it('retains Insomnia embedded specs without a chooser, linked to their generated collections', async () => {
    const { createSpec, setCollectionSpecLink, onImported } = renderModal({
      sourceKind: 'insomnia',
      initialText: INSOMNIA_EXPORT,
    });
    expect(screen.queryByText('IMPORT AS')).toBeNull();
    expect(screen.getByText(/SPECIFICATIONS · 1/)).toBeTruthy();

    fireEvent.click(importButton());

    const expectedHash = await hashImportSource(OPENAPI_YAML);
    await waitFor(() => {
      // The workspace collection lands first (col-1); the spec's
      // generated collection is second (col-2) and takes the link.
      expect(setCollectionSpecLink).toHaveBeenCalledWith('col-2', {
        specUid: 'spc-created-1',
        sourceHash: expectedHash,
      });
    });
    expect(createSpec).toHaveBeenCalledWith({
      name: 'openapi.yaml',
      content: OPENAPI_YAML,
      format: 'openapi-3.1',
    });
    expect(onImported).toHaveBeenCalled();
  });

  it('records an honest drop when the surface has no spec plane', async () => {
    const { onImported } = renderModal({
      sourceKind: 'insomnia',
      initialText: INSOMNIA_EXPORT,
      createSpec: undefined,
      setCollectionSpecLink: undefined,
    });
    fireEvent.click(importButton());

    await waitFor(() => expect(onImported).toHaveBeenCalled());
    const report = onImported.mock.calls[0]?.[0]?.report as ImportReport;
    const drop = report.drops.find((d) => d.path === 'specs');
    expect(drop?.reason).toMatch(/1 specification not retained/);
  });
});
