/**
 * A log row's ref label — the order its refs are listed in (local,
 * remote, tag) and the one name it reads: the leading ref's, a local
 * branch and its same-named remote said as one, with the short form a
 * narrow list falls back to; then the labels a row draws in each view,
 * and that a tag is always a glyph — Tag Names switches its name alone.
 */

import { orderedRefs, refLabelName, refLabels } from '@openheaders/ui/workbench/components/panels/git/ref-label';
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

describe('refLabels — what a row draws', () => {
  const auth = [local('feature/auth-headers'), remote('origin/feature/auth-headers'), tag('v2026.11.0-rc1')];
  const joined = { full: 'origin & feature/auth-headers', short: '../auth-headers' };

  it('compact: one label — a glyph for everything on the commit, the leading branch named', () => {
    expect(refLabels(auth, { isHead: false, compact: true, tagNames: true })).toEqual([
      { lead: 'feature/auth-headers', glyphs: ['local', 'remote', 'tag'], name: joined },
    ]);
    expect(refLabels([local('main')], { isHead: true, compact: true, tagNames: true })).toEqual([
      { lead: 'main', glyphs: ['head', 'local'], name: { full: 'main', short: null } },
    ]);
  });

  it('full: a label per branch with its remote joined, and a label per tag', () => {
    expect(refLabels(auth, { isHead: false, compact: false, tagNames: true })).toEqual([
      { lead: 'feature/auth-headers', glyphs: ['local', 'remote'], name: joined },
      { lead: 'v2026.11.0-rc1', glyphs: ['tag'], name: { full: 'v2026.11.0-rc1', short: null } },
    ]);
    expect(
      refLabels([local('main'), local('work'), remote('origin/release')], {
        isHead: true,
        compact: false,
        tagNames: true,
      }),
    ).toEqual([
      { lead: 'main', glyphs: ['head', 'local'], name: { full: 'main', short: null } },
      { lead: 'work', glyphs: ['local'], name: { full: 'work', short: null } },
      { lead: 'origin/release', glyphs: ['remote'], name: { full: 'origin/release', short: null } },
    ]);
  });

  it('Tag Names off keeps a tag’s glyph and drops its name — in both views', () => {
    expect(refLabels(auth, { isHead: false, compact: false, tagNames: false })).toEqual([
      { lead: 'feature/auth-headers', glyphs: ['local', 'remote'], name: joined },
      { lead: 'v2026.11.0-rc1', glyphs: ['tag'], name: null },
    ]);
    expect(refLabels(auth, { isHead: false, compact: true, tagNames: false })).toEqual([
      { lead: 'feature/auth-headers', glyphs: ['local', 'remote', 'tag'], name: joined },
    ]);
    for (const compact of [true, false]) {
      expect(refLabels([tag('v2026.10.3')], { isHead: false, compact, tagNames: false })).toEqual([
        { lead: 'v2026.10.3', glyphs: ['tag'], name: null },
      ]);
      expect(refLabels([tag('v2026.10.3')], { isHead: false, compact, tagNames: true })).toEqual([
        { lead: 'v2026.10.3', glyphs: ['tag'], name: { full: 'v2026.10.3', short: null } },
      ]);
    }
  });

  it('HEAD stands alone as a label only when nothing else points at the commit', () => {
    const alone = [{ lead: 'HEAD', glyphs: ['head'], name: { full: 'HEAD', short: null } }];
    expect(refLabels([], { isHead: true, compact: true, tagNames: true })).toEqual(alone);
    expect(refLabels([], { isHead: true, compact: false, tagNames: true })).toEqual(alone);
    expect(refLabels([], { isHead: false, compact: true, tagNames: true })).toEqual([]);
    // A tag alone on the checked-out commit (detached at a tag): HEAD's label, then the tag's.
    expect(refLabels([tag('v1')], { isHead: true, compact: false, tagNames: true })).toEqual([
      ...alone,
      { lead: 'v1', glyphs: ['tag'], name: { full: 'v1', short: null } },
    ]);
  });
});
