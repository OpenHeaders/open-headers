/**
 * document-paths pins: a listing's documents are the root singletons,
 * the environment files, and every file in a directory that holds an
 * entity manifest — the manifest and the siblings beside it. A file
 * anywhere else is the user's own, a `.yaml` one included.
 */

import { describe, expect, it } from 'vitest';
import { treeDocumentPaths } from '../../src/workspace-tree/document-paths';

const REQUEST_DIR = 'requests/probes-c0000001/health-r0000001';

describe('treeDocumentPaths', () => {
  it('a manifest brings its siblings: body, scripts, a spec file', () => {
    const listing = [
      `${REQUEST_DIR}/request.yaml`,
      `${REQUEST_DIR}/body.json`,
      `${REQUEST_DIR}/pre-request.js`,
      'requests/probes-c0000001/_collection.yaml',
      'requests/probes-c0000001/pre-request.js',
      'specs/billing-s0000001/spec.yaml',
      'specs/billing-s0000001/openapi.json',
    ];
    expect([...treeDocumentPaths(listing)].sort()).toEqual([...listing].sort());
  });

  it('the root singletons and the environment files are documents', () => {
    const listing = [
      'workspace.yaml',
      'workspace-vars.yaml',
      'workspace-vars.secret.yaml',
      'trusted-roots.yaml',
      'environments/staging-e0000001.yaml',
      'environments/staging-e0000001.secret.yaml',
      'environments/staging-e0000001.secret.yaml.template',
    ];
    expect([...treeDocumentPaths(listing)].sort()).toEqual([...listing].sort());
  });

  it("the user's own files are left out — a yaml one, a root one, one beside no manifest", () => {
    const documents = treeDocumentPaths([
      'workspace.yaml',
      `${REQUEST_DIR}/request.yaml`,
      'README.md',
      '.gitignore',
      '.gitattributes',
      'docker-compose.yaml',
      'docs/guide.md',
      'k8s/deploy.yaml',
      'environments/notes.md',
      'requests/README.md',
      'requests/probes-c0000001/notes/todo.md',
    ]);
    expect([...documents].sort()).toEqual([`${REQUEST_DIR}/request.yaml`, 'workspace.yaml']);
  });

  it('a directory whose manifest is absent from the listing holds no documents', () => {
    expect(treeDocumentPaths([`${REQUEST_DIR}/body.json`, `${REQUEST_DIR}/pre-request.js`]).size).toBe(0);
  });
});
