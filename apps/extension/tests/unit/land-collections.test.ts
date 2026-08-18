/**
 * Shared collection-landing loop — the one code path both the
 * sectioned import modal and the spec editor's Generate Collection
 * ride (the API-specs plan §4: no parallel conversion pipeline).
 *
 * Pins: create order (collection → auth → variables → folders
 * depth-first → requests), report drops on write failures, per-section
 * uid tracking (Generate binds `specLink` to the returned uid), and
 * the honest drop when a surface has no collection-variable leg.
 */

import { type CurlRequest, createReport } from '@openheaders/core/import';
import {
  type CollectionLandingLegs,
  landSectionedCollections,
  type SectionedCollection,
} from '@openheaders/ui/workbench/components/import/land-collections';
import { describe, expect, it, vi } from 'vitest';

const makeRequest = (name: string): { folderPath: string[]; request: CurlRequest } => ({
  folderPath: [],
  request: {
    name,
    method: 'GET',
    url: 'https://api.openheaders.io/v1/status',
    headers: [],
    params: [],
    auth: { type: 'inherit', disabled: false },
    body: { type: 'none' },
  },
});

function makeSection(overrides: Partial<SectionedCollection> = {}): SectionedCollection {
  return {
    name: 'OpenHeaders API',
    folders: [],
    requests: [makeRequest('Status')],
    ...overrides,
  };
}

function makeLegs(overrides: Partial<CollectionLandingLegs> = {}): CollectionLandingLegs {
  return {
    createCollection: vi.fn(async (name: string) => ({ uid: `col-${name}`, path: `requests/${name}` })),
    createFolder: vi.fn(async (name: string, parentPath: string) => ({
      uid: `fol-${name}`,
      path: `${parentPath}/${name}`,
    })),
    createRequest: vi.fn(async () => ({ uid: 'req-1' })),
    ...overrides,
  };
}

describe('landSectionedCollections', () => {
  it('lands collection + auth + variables + nested folders + requests and reports uids', async () => {
    const setCollectionAuth = vi.fn(async () => true);
    const setCollectionVariables = vi.fn(async () => true);
    const legs = makeLegs({ setCollectionAuth, setCollectionVariables });
    const report = createReport('openapi');
    const section = makeSection({
      auth: { type: 'bearer', token: '{{token}}' },
      variables: [{ name: 'baseUrl', value: 'https://api.openheaders.io', type: 'default' }],
      folders: [{ path: ['pets'] }, { path: ['pets', 'toys'] }],
      requests: [
        { ...makeRequest('List pets'), folderPath: ['pets'] },
        { ...makeRequest('List toys'), folderPath: ['pets', 'toys'] },
      ],
    });
    const landed = await landSectionedCollections([section], ['My API'], legs, report);
    expect(landed.collectionsImported).toBe(1);
    expect(landed.requestsImported).toBe(2);
    expect(landed.collectionUids).toEqual(['col-My API']);
    expect(legs.createCollection).toHaveBeenCalledWith('My API');
    expect(setCollectionAuth).toHaveBeenCalledWith('col-My API', { type: 'bearer', token: '{{token}}' });
    expect(setCollectionVariables).toHaveBeenCalledWith('col-My API', [
      expect.objectContaining({ name: 'baseUrl', value: 'https://api.openheaders.io', type: 'default' }),
    ]);
    // Depth-first: the child folder lands under the parent's created path.
    expect(legs.createFolder).toHaveBeenNthCalledWith(1, 'pets', 'requests/My API');
    expect(legs.createFolder).toHaveBeenNthCalledWith(2, 'toys', 'requests/My API/pets');
    expect(report.summary.dropped).toBe(0);
  });

  it('blank name falls back to the section name', async () => {
    const legs = makeLegs();
    const landed = await landSectionedCollections([makeSection()], ['   '], legs, createReport('openapi'));
    expect(legs.createCollection).toHaveBeenCalledWith('OpenHeaders API');
    expect(landed.collectionUids).toEqual(['col-OpenHeaders API']);
  });

  it('records a drop and a null uid when the collection create fails, siblings land', async () => {
    const createCollection = vi
      .fn<CollectionLandingLegs['createCollection']>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ uid: 'col-2', path: 'requests/second' });
    const legs = makeLegs({ createCollection });
    const report = createReport('openapi');
    const landed = await landSectionedCollections(
      [makeSection({ name: 'First' }), makeSection({ name: 'Second' })],
      ['First', 'Second'],
      legs,
      report,
    );
    expect(landed.collectionUids).toEqual([null, 'col-2']);
    expect(landed.collectionsImported).toBe(1);
    expect(landed.requestsImported).toBe(1);
    expect(report.drops).toHaveLength(1);
    expect(report.drops[0].path).toBe('collections[0]');
  });

  it('drops variables honestly when the surface has no collection-variable leg', async () => {
    const report = createReport('openapi');
    await landSectionedCollections(
      [makeSection({ variables: [{ name: 'baseUrl', value: 'https://api.openheaders.io', type: 'default' }] })],
      ['My API'],
      makeLegs(),
      report,
    );
    expect(report.drops).toHaveLength(1);
    expect(report.drops[0].path).toBe('collections[0].variables');
  });

  it('records a drop when the variables write fails', async () => {
    const report = createReport('openapi');
    await landSectionedCollections(
      [makeSection({ variables: [{ name: 'baseUrl', value: 'https://api.openheaders.io', type: 'default' }] })],
      ['My API'],
      makeLegs({ setCollectionVariables: vi.fn(async () => false) }),
      report,
    );
    expect(report.drops).toHaveLength(1);
    expect(report.drops[0].reason).toContain('failed to write');
  });
});
