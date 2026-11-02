/**
 * entity-at-path pins: a manifest classifies by its name and tree, a
 * sibling in a collection-tree directory names every candidate
 * manifest, the user's own files and secrets answer none, and the
 * manifest's YAML yields the editor identity (uid, name, a request's
 * method), refusing a manifest without a uid.
 */

import { describe, expect, it } from 'vitest';
import { classifyTreePath, entityRefOfManifest } from '../../src/workspace-tree/entity-at-path';

describe('classifyTreePath', () => {
  it('a manifest names its entity and tree', () => {
    expect(classifyTreePath('requests/probes-c0000001/health-r0000001/request.yaml')).toEqual({
      kind: 'manifest',
      candidate: {
        kind: 'request',
        tree: 'requests',
        manifestPath: 'requests/probes-c0000001/health-r0000001/request.yaml',
      },
    });
    expect(classifyTreePath('rules/block-r0000001/rule.yaml')).toMatchObject({
      candidate: { kind: 'rule', tree: 'rules' },
    });
    expect(classifyTreePath('templates/base-c1/_collection.yaml')).toMatchObject({
      candidate: { kind: 'collection', tree: 'templates' },
    });
    expect(classifyTreePath('environments/staging-e0000001.yaml')).toMatchObject({
      candidate: { kind: 'environment', tree: null },
    });
    expect(classifyTreePath('workspace-vars.yaml')).toMatchObject({ candidate: { kind: 'workspace-variables' } });
    expect(classifyTreePath('workspace-vars.secret.yaml')).toMatchObject({ candidate: { kind: 'vault' } });
  });

  it('a sibling file lists every manifest its directory could carry', () => {
    const sibling = classifyTreePath('requests/probes-c1/health-r1/body.json');
    if (sibling.kind !== 'sibling') throw new Error(`expected sibling, got ${sibling.kind}`);
    expect(sibling.candidates.map((c) => c.manifestPath)).toContain('requests/probes-c1/health-r1/request.yaml');
    expect(sibling.candidates.every((c) => c.tree === 'requests')).toBe(true);
  });

  it("the user's own files, root files and secrets answer none", () => {
    expect(classifyTreePath('README.md')).toEqual({ kind: 'none' });
    expect(classifyTreePath('docs/guides/setup.md')).toEqual({ kind: 'none' });
    expect(classifyTreePath('workspace.yaml')).toEqual({ kind: 'none' });
    expect(classifyTreePath('environments/staging-e1.secret.yaml')).toEqual({ kind: 'none' });
    expect(classifyTreePath('scripts/_collection.yaml')).toEqual({ kind: 'none' });
  });
});

describe('entityRefOfManifest', () => {
  const request = { kind: 'request' as const, tree: 'requests' as const, manifestPath: 'requests/a/b/request.yaml' };

  it('reads uid, name and a request method from the YAML', () => {
    expect(entityRefOfManifest(request, 'schemaVersion: 5\nuid: r0000001\nname: Health\nmethod: GET\n')).toEqual({
      kind: 'request',
      tree: 'requests',
      uid: 'r0000001',
      name: 'Health',
      method: 'GET',
    });
    expect(
      entityRefOfManifest({ kind: 'rule', tree: 'rules', manifestPath: 'rules/x/rule.yaml' }, 'uid: r2\nname: Block\n'),
    ).toEqual({ kind: 'rule', tree: 'rules', uid: 'r2', name: 'Block' });
  });

  it('a manifest without a uid or with broken YAML answers null; the one-page kinds need no YAML', () => {
    expect(entityRefOfManifest(request, 'name: Nameless\n')).toBeNull();
    expect(entityRefOfManifest(request, 'uid: [unclosed\n')).toBeNull();
    expect(entityRefOfManifest({ kind: 'vault', tree: null, manifestPath: 'workspace-vars.secret.yaml' }, '')).toEqual({
      kind: 'vault',
      tree: null,
      uid: '',
      name: '',
    });
  });
});
