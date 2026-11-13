/**
 * log-scope (S66): a log tab's scope as a list of refs walked together —
 * what it asks of the host (every ref, the default walk, one ref by the
 * field every host reads, several by `refs`), what is left when refs go,
 * what the Branch menu's Favorites row applies, and how the chip, its
 * hover and the tab read it.
 */

import {
  favoritesScope,
  logScopeWire,
  scopeChipText,
  scopeHoverText,
  scopeTabText,
  scopeWithout,
} from '@openheaders/ui/workbench/components/panels/git/log-scope';
import { describe, expect, it } from 'vitest';

describe('logScopeWire', () => {
  it('asks every ref for an empty scope and the default walk for HEAD alone', () => {
    expect(logScopeWire([])).toEqual({ allRefs: true });
    expect(logScopeWire(['HEAD'])).toEqual({});
  });

  it('sends one ref by `ref` and several by `refs`, HEAD a member', () => {
    expect(logScopeWire(['feature/orders-v2'])).toEqual({ ref: 'feature/orders-v2' });
    expect(logScopeWire(['HEAD', 'main'])).toEqual({ refs: ['HEAD', 'main'] });
    expect(logScopeWire(['main', 'origin/main', 'v2026.10.3'])).toEqual({
      refs: ['main', 'origin/main', 'v2026.10.3'],
    });
  });
});

describe('scopeWithout', () => {
  it('drops the refs that went and keeps the order of the rest', () => {
    expect(scopeWithout(['HEAD', 'main', 'local-test', 'origin/main'], ['local-test'])).toEqual([
      'HEAD',
      'main',
      'origin/main',
    ]);
    expect(scopeWithout(['main'], ['main'])).toEqual([]);
    expect(scopeWithout(['main', 'fix/probe-timeout'], ['gone'])).toEqual(['main', 'fix/probe-timeout']);
  });
});

describe('favoritesScope', () => {
  const refs = [
    { name: 'feature/orders-v2', kind: 'local' as const },
    { name: 'main', kind: 'local' as const },
    { name: 'origin/main', kind: 'remote' as const },
    { name: 'v2026.10.3', kind: 'tag' as const },
  ];

  it('is HEAD, then every favorite ref in the listing’s order', () => {
    expect(favoritesScope(refs, new Set(['local:main', 'remote:origin/main']))).toEqual([
      'HEAD',
      'main',
      'origin/main',
    ]);
    expect(favoritesScope(refs, new Set(['tag:v2026.10.3', 'local:feature/orders-v2']))).toEqual([
      'HEAD',
      'feature/orders-v2',
      'v2026.10.3',
    ]);
  });

  it('is HEAD alone with no favorite, and names a branch and its same-named tag once', () => {
    expect(favoritesScope(refs, new Set())).toEqual(['HEAD']);
    const twins = [
      { name: 'release', kind: 'local' as const },
      { name: 'release', kind: 'tag' as const },
    ];
    expect(favoritesScope(twins, new Set(['local:release', 'tag:release']))).toEqual(['HEAD', 'release']);
  });

  it('skips a favorite the listing no longer holds', () => {
    expect(favoritesScope(refs, new Set(['local:gone', 'local:main']))).toEqual(['HEAD', 'main']);
  });
});

describe('the scope as text', () => {
  it('reads nothing on the unfiltered log', () => {
    expect(scopeChipText([])).toBeNull();
    expect(scopeTabText([])).toBeNull();
    expect(scopeHoverText([])).toBeNull();
  });

  it('reads one ref whole, however long, with no hover', () => {
    const long = 'feature/a-branch-name-longer-than-any-cut';
    expect(scopeChipText([long])).toBe(long);
    expect(scopeTabText([long])).toBe(long);
    expect(scopeHoverText([long])).toBeNull();
  });

  it('joins several — the chip by a bar, the tab by commas — and lists them all in the hover', () => {
    expect(scopeChipText(['HEAD', 'main'])).toBe('HEAD|main');
    expect(scopeTabText(['HEAD', 'main'])).toBe('HEAD, main');
    expect(scopeHoverText(['HEAD', 'main'])).toBe('HEAD\nmain');
  });

  it('cuts a long join to its length with an ellipsis', () => {
    const scope = ['feature/orders-v2', 'fix/probe-timeout', 'origin/main'];
    expect(scopeChipText(scope)).toBe('feature/orders-v2|fix/probe…');
    expect(scopeChipText(['HEAD', 'main', 'origin/main'])).toBe('HEAD|main|origin/main');
    expect(scopeTabText(scope)).toBe('feature/orders-v2, fix/probe-…');
    expect(scopeHoverText(scope)).toBe('feature/orders-v2\nfix/probe-timeout\norigin/main');
  });
});
