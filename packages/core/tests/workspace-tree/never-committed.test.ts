/**
 * never-committed pins: the sidecar's files and the secret files are
 * named by a path's text alone — at any depth and in any case, a
 * directory's own row answering for what is in it — and nothing a
 * commit holds is: a secret's committed template, a file that only
 * shares the sidecar's name, a directory that only ends as a secret
 * file does.
 */

import { describe, expect, it } from 'vitest';
import { isNeverCommittedPath, REQUIRED_IGNORE_ENTRIES } from '../../src/workspace-tree';

describe('isNeverCommittedPath', () => {
  it.each([
    '.oh/lock',
    '.oh/materialized-index.json',
    '.oh/deep/er/file.json',
    'environments/.oh/lock',
    '.OH/lock',
    '.oh/',
  ])('a file beneath the sidecar is one: %s', (path) => {
    expect(isNeverCommittedPath(path)).toBe(true);
  });

  it.each([
    'workspace-vars.secret.yaml',
    'environments/dev-env00001.secret.yaml',
    'environments/X.SECRET.YAML',
    'a/b/c/.secret.yaml',
  ])('a secret file is one: %s', (path) => {
    expect(isNeverCommittedPath(path)).toBe(true);
  });

  it.each([
    'workspace.yaml',
    'workspace-vars.yaml',
    'environments/dev-env00001.yaml',
    'environments/dev-env00001.secret.yaml.template',
    '.gitignore',
    'secret.yaml',
    'notes/.oh',
    'notes/.ohx/lock',
    'notes/x.oh/lock',
    'held.secret.yaml/readme.md',
    'held.secret.yaml/',
  ])('a file a commit holds is not: %s', (path) => {
    expect(isNeverCommittedPath(path)).toBe(false);
  });
});

describe('REQUIRED_IGNORE_ENTRIES', () => {
  it('are the sidecar and the secret files, one entry each', () => {
    expect(REQUIRED_IGNORE_ENTRIES).toEqual(['.oh/', '*.secret.yaml']);
  });
});
