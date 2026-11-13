/**
 * Favorite refs — pure. Some refs are favorites until the person says
 * otherwise: the checked-out branch and the remote branches that carry
 * it (`origin/main` for `main`) — the reference's reading. A star on
 * any other ref adds it; a star taken off one of those is remembered
 * as taken off. HEAD is no ref here: it leads every favorites list and
 * has no star to take.
 *
 * Keys are `<kind>:<name>` (`local:main`), as the rail's prefs hold
 * them.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';

type Ref = Pick<WorkspaceTreeRefWire, 'name' | 'kind'>;

export interface RefFavoritePrefs {
  /** Refs starred by hand. */
  favorites: readonly string[];
  /** Refs that would be favorites by default, un-starred by hand. */
  unfavorites: readonly string[];
}

export function refFavoriteKey(kind: string, name: string): string {
  return `${kind}:${name}`;
}

/** The refs that are favorites unless un-starred: the checked-out branch and its same-named remote branches. */
export function defaultFavoriteKeys(refs: readonly Ref[], currentRef: string | null): Set<string> {
  const keys = new Set<string>();
  if (currentRef === null) return keys;
  keys.add(refFavoriteKey('local', currentRef));
  for (const ref of refs) {
    if (ref.kind !== 'remote' || !ref.name.endsWith(`/${currentRef}`)) continue;
    const remote = ref.name.slice(0, ref.name.length - currentRef.length - 1);
    if (remote.length > 0 && !remote.includes('/')) keys.add(refFavoriteKey('remote', ref.name));
  }
  return keys;
}

/** Every ref that is a favorite now. */
export function favoriteKeys(prefs: RefFavoritePrefs, defaults: ReadonlySet<string>): Set<string> {
  const keys = new Set(prefs.favorites);
  for (const key of defaults) {
    if (!prefs.unfavorites.includes(key)) keys.add(key);
  }
  return keys;
}

/** The prefs after one ref's star is toggled. */
export function toggledFavorite(prefs: RefFavoritePrefs, key: string, defaults: ReadonlySet<string>): RefFavoritePrefs {
  const starred = favoriteKeys(prefs, defaults).has(key);
  const without = (keys: readonly string[]): string[] => keys.filter((entry) => entry !== key);
  if (starred) {
    return {
      favorites: without(prefs.favorites),
      unfavorites: defaults.has(key) ? [...without(prefs.unfavorites), key] : without(prefs.unfavorites),
    };
  }
  return {
    favorites: defaults.has(key) ? without(prefs.favorites) : [...without(prefs.favorites), key],
    unfavorites: without(prefs.unfavorites),
  };
}
