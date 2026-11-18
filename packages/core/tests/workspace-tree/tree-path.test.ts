/**
 * tree-path — the paths a workspace tree can hold, by the text alone:
 * the same answer on every platform, whatever the filesystem folds.
 */

import { describe, expect, it } from 'vitest';
import { OH_SIDECAR_DIR, treePathRefusal } from '../../src/workspace-tree';

const refusals = (paths: readonly string[]): Array<string | null> => paths.map(treePathRefusal);

describe('treePathRefusal', () => {
  it('holds what a tree writes, and a name that only begins as git’s directory or the sidecar does', () => {
    expect(
      refusals([
        'workspace.yaml',
        'requests/api-cccccccc/login-aaaaaaaa/request.yaml',
        'environments/dev-eeeeeeee.secret.yaml.template',
        '.gitignore',
        '.github/workflows/ci.yaml',
        'specs/pets-ssssssss/.gitkeep',
        'specs/pets-ssssssss/git~10/index.yaml',
        'specs/pets-ssssssss/.ohm/index.yaml',
        'specs/pets-ssssssss/ .git/index.yaml',
      ]),
    ).toEqual([null, null, null, null, null, null, null, null, null]);
  });

  it('is no rule of what every platform stores: a name Windows cannot hold is a path of the tree', () => {
    expect(refusals(['specs/pets-ssssssss/a:b.yaml', 'specs/pets-ssssssss/notes.', 'specs/CON/index.yaml'])).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('refuses a name that climbs or stays — at any depth, and names it', () => {
    expect(refusals(['../outside/spec.yaml', 'specs/pets-ssssssss/../../outside/spec.yaml'])).toEqual(['".."', '".."']);
    expect(refusals(['./workspace.yaml', 'specs/./spec.yaml'])).toEqual(['"."', '"."']);
  });

  it('refuses an empty name — no path at all, one from the root, a doubled or a trailing slash', () => {
    expect(refusals(['', '/etc/spec.yaml', 'specs//spec.yaml', 'specs/pets-ssssssss/'])).toEqual([
      'an empty name',
      'an empty name',
      'an empty name',
      'an empty name',
    ]);
  });

  it('refuses a backslash, which divides names on Windows', () => {
    expect(refusals(['specs\\pets-ssssssss/spec.yaml', 'specs/pets\\..\\..\\outside/spec.yaml'])).toEqual([
      '"\\"',
      '"\\"',
    ]);
  });

  it('refuses a control character', () => {
    expect(
      refusals(['specs/pets\n-ssssssss/spec.yaml', 'specs/pets\u0000/spec.yaml', 'specs/pets\u007f/spec.yaml']),
    ).toEqual(['a control character', 'a control character', 'a control character']);
  });

  it('refuses git’s directory at any depth and in any case', () => {
    expect(refusals(['.git/hooks/pre-commit', 'specs/.GIT/config', 'specs/pets-ssssssss/.Git'])).toEqual([
      '".git"',
      '".GIT"',
      '".Git"',
    ]);
  });

  it('refuses the names a filesystem folds onto it: dots and spaces after it, NTFS’s short name, a stream, what HFS+ leaves out', () => {
    expect(refusals(['.git./config', '.git /config', '.git. ./config'])).toEqual(['".git."', '".git "', '".git. ."']);
    expect(refusals(['git~1/config', 'specs/GIT~1/config'])).toEqual(['"git~1"', '"GIT~1"']);
    expect(refusals(['.git::$INDEX_ALLOCATION/config', '.git:stream'])).toEqual([
      '".git::$INDEX_ALLOCATION"',
      '".git:stream"',
    ]);
    expect(refusals(['.g‌it/config', '﻿.git/config'])).toEqual(['".g‌it"', '"﻿.git"']);
  });

  it('refuses the sidecar the same', () => {
    expect(OH_SIDECAR_DIR).toBe('.oh');
    expect(refusals([`${OH_SIDECAR_DIR}/lock`, 'specs/.OH/lock', '.oh./lock', '.oh:stream', '.o‍h/lock'])).toEqual([
      '".oh"',
      '".OH"',
      '".oh."',
      '".oh:stream"',
      '".o‍h"',
    ]);
    expect(refusals(['oh~1/lock', 'OH~1/lock'])).toEqual(['"oh~1"', '"OH~1"']);
  });
});
