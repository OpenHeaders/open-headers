/**
 * paths-tree (S66): what a checked row of the Paths chip's tree filters
 * the log by — a folder as ONE path, an entity kept in a directory of
 * its own by that directory, one kept as files of a shared directory by
 * its files — and the checked set as boxes are flipped, with the names
 * the picks were made under.
 */

import type { WorkspaceFileNode } from '@openheaders/ui/shared/workspace-files';
import {
  commonDirectory,
  folderPath,
  namedRowPaths,
  pickedNames,
  withRowChecked,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/paths-tree';
import { describe, expect, it } from 'vitest';

const part = (file: string): WorkspaceFileNode => ({ type: 'part', id: file, part: null, name: file, file });

describe('commonDirectory', () => {
  it('is the directory every file is in or under', () => {
    expect(commonDirectory(['requests/git-pass-e2egcol1/collection.yaml'])).toBe('requests/git-pass-e2egcol1');
    expect(
      commonDirectory([
        'requests/git-pass-e2egcol1/collection.yaml',
        'requests/git-pass-e2egcol1/create-order-e2egreq3/request.yaml',
        'requests/git-pass-e2egcol1/create-order-e2egreq3/body.json',
      ]),
    ).toBe('requests/git-pass-e2egcol1');
    expect(
      commonDirectory(['environments/staging-e2egenv1.yaml', 'environments/staging-e2egenv1.secret.yaml.template']),
    ).toBe('environments');
  });

  it('is none for files of the root, for files that share nothing, and for no file', () => {
    expect(commonDirectory(['workspace.yaml'])).toBe('');
    expect(commonDirectory(['notes/orders.md', 'assets/logo.svg'])).toBe('');
    expect(commonDirectory([])).toBe('');
  });
});

describe('namedRowPaths', () => {
  it('filters by a file of the user’s own and by its folder as one path', () => {
    expect(namedRowPaths({ type: 'file', id: 'notes/orders.md', name: 'orders.md', file: 'notes/orders.md' })).toEqual([
      'notes/orders.md',
    ]);
    expect(namedRowPaths({ type: 'directory', id: 'dir:config/envs', path: 'envs', children: [] })).toEqual([
      'config/envs/',
    ]);
    expect(folderPath('assets')).toBe('assets/');
  });

  it('filters by the directory of an entity that has one — a request, and the collection that holds it', () => {
    const request: WorkspaceFileNode = {
      type: 'entity',
      id: 'requests:e2egreq3',
      entity: { kind: 'folder', uid: 'e2egreq3', name: 'Create Order' },
      children: [
        part('requests/git-pass-e2egcol1/create-order-e2egreq3/request.yaml'),
        part('requests/git-pass-e2egcol1/create-order-e2egreq3/body.json'),
      ],
    };
    expect(namedRowPaths(request)).toEqual(['requests/git-pass-e2egcol1/create-order-e2egreq3/']);
    const lone: WorkspaceFileNode = {
      type: 'entity',
      id: 'requests:e2egreq4',
      entity: { kind: 'folder', uid: 'e2egreq4', name: 'List Orders' },
      file: 'requests/git-pass-e2egcol1/list-orders-e2egreq4/request.yaml',
      children: [],
    };
    expect(namedRowPaths(lone)).toEqual(['requests/git-pass-e2egcol1/list-orders-e2egreq4/']);
    const collection: WorkspaceFileNode = {
      type: 'entity',
      id: 'requests:e2egcol1',
      entity: { kind: 'collection', uid: 'e2egcol1', name: 'Git Pass' },
      children: [part('requests/git-pass-e2egcol1/collection.yaml'), request, lone],
    };
    expect(namedRowPaths(collection)).toEqual(['requests/git-pass-e2egcol1/']);
  });

  it('filters by the files of an entity kept in a shared directory, and of a page', () => {
    const environment: WorkspaceFileNode = {
      type: 'entity',
      id: 'environments:e2egenv1',
      entity: { kind: 'environment', uid: 'e2egenv1', name: 'Staging' },
      children: [
        part('environments/staging-e2egenv1.yaml'),
        part('environments/staging-e2egenv1.secret.yaml.template'),
      ],
    };
    expect(namedRowPaths(environment)).toEqual([
      'environments/staging-e2egenv1.yaml',
      'environments/staging-e2egenv1.secret.yaml.template',
    ]);
    expect(
      namedRowPaths({
        type: 'entity',
        id: 'workspace',
        entity: { kind: 'workspace' },
        file: 'workspace.yaml',
        children: [],
      }),
    ).toEqual(['workspace.yaml']);
    // One of an entity's files is that file.
    expect(namedRowPaths(part('requests/git-pass-e2egcol1/create-order-e2egreq3/body.json'))).toEqual([
      'requests/git-pass-e2egcol1/create-order-e2egreq3/body.json',
    ]);
  });
});

describe('withRowChecked', () => {
  it('takes a row’s paths in under its name and out again, leaving the rest', () => {
    const one = withRowChecked(new Map(), ['requests/git-pass-e2egcol1/'], 'Git Pass', true);
    const two = withRowChecked(one, ['notes/orders.md'], null, true);
    expect([...two]).toEqual([
      ['requests/git-pass-e2egcol1/', 'Git Pass'],
      ['notes/orders.md', null],
    ]);
    expect(pickedNames(two)).toEqual({ 'requests/git-pass-e2egcol1/': 'Git Pass' });
    expect([...withRowChecked(two, ['requests/git-pass-e2egcol1/'], 'Git Pass', false)]).toEqual([
      ['notes/orders.md', null],
    ]);
    // The first map is not touched.
    expect(one.size).toBe(1);
  });
});
