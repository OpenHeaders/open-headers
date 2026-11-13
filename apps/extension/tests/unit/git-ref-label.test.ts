/**
 * A log row's ref label — the order its refs are listed in (local,
 * remote, tag) and the one name it reads: the leading ref's, a local
 * branch and its same-named remote said as one, with the short form a
 * narrow list falls back to.
 */

import { orderedRefs, refLabelName } from '@openheaders/ui/workbench/components/panels/git/ref-label';
import { describe, expect, it } from 'vitest';

const local = (name: string) => ({ name, kind: 'local' as const });
const remote = (name: string) => ({ name, kind: 'remote' as const });
const tag = (name: string) => ({ name, kind: 'tag' as const });

describe('orderedRefs', () => {
  it('lists local, then remote, then tag — each kind as it arrived', () => {
    const refs = [tag('v2'), remote('origin/b'), local('b'), tag('v1'), local('a')];
    expect(orderedRefs(refs).map((ref) => ref.name)).toEqual(['b', 'a', 'origin/b', 'v2', 'v1']);
  });
});

describe('refLabelName', () => {
  it('names the leading ref: a local branch over a remote over a tag', () => {
    expect(refLabelName([tag('v1'), remote('origin/main'), local('work')])).toEqual({ full: 'work', short: null });
    expect(refLabelName([tag('v1'), remote('origin/release/2026.10')])).toEqual({
      full: 'origin/release/2026.10',
      short: null,
    });
    expect(refLabelName([tag('v2026.10.3')])).toEqual({ full: 'v2026.10.3', short: null });
    expect(refLabelName([])).toBeNull();
  });

  it('says a branch and its same-named remote as one name, with the folders folded when narrow', () => {
    expect(
      refLabelName([local('feature/auth-headers'), remote('origin/feature/auth-headers'), tag('v2026.11.0-rc1')]),
    ).toEqual({ full: 'origin & feature/auth-headers', short: '../auth-headers' });
  });

  it('keeps a plain branch as its own short form', () => {
    expect(refLabelName([local('main'), remote('origin/main')])).toEqual({ full: 'origin & main', short: 'main' });
  });

  it('joins every remote that carries the branch, and no remote that only ends alike', () => {
    expect(refLabelName([local('main'), remote('origin/main'), remote('backup/main')])).toEqual({
      full: 'origin & backup & main',
      short: 'main',
    });
    // `origin/feature/main` is another branch — its remote part would hold a slash.
    expect(refLabelName([local('main'), remote('origin/feature/main')])).toEqual({ full: 'main', short: null });
    expect(refLabelName([local('x/main'), remote('origin/main')])).toEqual({ full: 'x/main', short: null });
  });
});
