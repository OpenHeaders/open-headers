/**
 * Favorite refs and the order they give the rail — the reference's
 * reading: the checked-out branch and its same-named remote are
 * favorites until un-starred, any other ref once starred; in a level of
 * the rail the checked-out branch leads, then the favorites, then the
 * folders, then every other ref by name.
 */

import {
  defaultFavoriteKeys,
  favoriteKeys,
  toggledFavorite,
} from '@openheaders/ui/workbench/components/panels/git/rail/ref-favorites';
import { buildRefTree, type RefRank } from '@openheaders/ui/workbench/components/panels/git/rail/ref-tree-model';
import { describe, expect, it } from 'vitest';

const ref = (kind: 'local' | 'remote' | 'tag', name: string) => ({ kind, name, sha: name });
const refs = [
  ref('local', 'main'),
  ref('local', 'feature/auth-headers'),
  ref('local', 'feature/orders-v2'),
  ref('local', 'local-test'),
  ref('remote', 'origin/main'),
  ref('remote', 'origin/feature/main'),
  ref('remote', 'origin/release/2026.10'),
  ref('tag', 'v1'),
];
const none = { favorites: [], unfavorites: [] };

describe('favorite refs', () => {
  it('the checked-out branch and the remote that carries it are favorites by default', () => {
    expect([...defaultFavoriteKeys(refs, 'main')].sort()).toEqual(['local:main', 'remote:origin/main']);
    expect(defaultFavoriteKeys(refs, null).size).toBe(0);
    // A branch with no remote of its name stands alone.
    expect([...defaultFavoriteKeys(refs, 'local-test')]).toEqual(['local:local-test']);
  });

  it('a star adds a ref; a star taken off a default is remembered as taken off', () => {
    const defaults = defaultFavoriteKeys(refs, 'main');
    expect([...favoriteKeys(none, defaults)].sort()).toEqual(['local:main', 'remote:origin/main']);

    const starred = toggledFavorite(none, 'local:feature/orders-v2', defaults);
    expect(starred).toEqual({ favorites: ['local:feature/orders-v2'], unfavorites: [] });
    expect(favoriteKeys(starred, defaults).has('local:feature/orders-v2')).toBe(true);
    expect(toggledFavorite(starred, 'local:feature/orders-v2', defaults)).toEqual(none);

    const unstarred = toggledFavorite(none, 'local:main', defaults);
    expect(unstarred).toEqual({ favorites: [], unfavorites: ['local:main'] });
    expect([...favoriteKeys(unstarred, defaults)]).toEqual(['remote:origin/main']);
    expect(toggledFavorite(unstarred, 'local:main', defaults)).toEqual(none);
  });

  it('a ref starred by hand stays a favorite when the checked-out branch moves on', () => {
    const onMain = defaultFavoriteKeys(refs, 'main');
    const prefs = toggledFavorite(none, 'local:local-test', onMain);
    const onLocalTest = defaultFavoriteKeys(refs, 'local-test');
    expect([...favoriteKeys(prefs, onLocalTest)]).toEqual(['local:local-test']);
    // main was a favorite only by being checked out.
    expect(favoriteKeys(prefs, onLocalTest).has('local:main')).toBe(false);
  });
});

describe('the rail’s order', () => {
  const labels = (nodes: ReturnType<typeof buildRefTree>): string[] =>
    nodes.map((node) => (node.kind === 'folder' ? `d:${node.label}` : node.label));
  const locals = refs.filter((entry) => entry.kind === 'local');
  const rankOf =
    (current: string, favorites: readonly string[]) =>
    (entry: { name: string }): RefRank =>
      entry.name === current ? 'current' : favorites.includes(entry.name) ? 'favorite' : 'plain';

  it('flat: the checked-out branch, then the favorites, then the rest by name', () => {
    expect(labels(buildRefTree(locals, 'local', false, rankOf('main', ['local-test'])))).toEqual([
      'main',
      'local-test',
      'feature/auth-headers',
      'feature/orders-v2',
    ]);
  });

  it('by directory: the leading refs come before the folders, the rest after them', () => {
    expect(labels(buildRefTree(locals, 'local', true, rankOf('main', [])))).toEqual([
      'main',
      'd:feature',
      'local-test',
    ]);
    const tree = buildRefTree(locals, 'local', true, rankOf('local-test', ['feature/orders-v2']));
    expect(labels(tree)).toEqual(['local-test', 'd:feature', 'main']);
    const feature = tree[1];
    if (feature.kind !== 'folder') throw new Error('expected folder');
    expect(labels(feature.children)).toEqual(['orders-v2', 'auth-headers']);
  });

  it('with no rank given, the folders lead and the refs follow by name — as before', () => {
    expect(labels(buildRefTree(locals, 'local'))).toEqual(['d:feature', 'local-test', 'main']);
  });
});
