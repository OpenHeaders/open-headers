/**
 * Coverage for the sidebar speed-search subsystem:
 *   1. `useTreeSearch` — the state machine's mode-gated derivations
 *      (filterText hides only in filter mode, revealAll/highlightQuery
 *      exist only in search mode, close clears the query).
 *   2. `useTreeSearchMatches` — match derivation over the flat item
 *      list (placeholders excluded), first-match auto-navigation,
 *      wrap-around cycling, and Enter's open-active dispatch.
 *   3. `highlightLabel` — case-insensitive multi-occurrence label
 *      splitting into warning-tinted hit spans.
 */

import { act, render, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { highlightLabel } from '@openheaders/ui/workbench/components/sidebar/search-highlight';
import type { TreeNode } from '@openheaders/ui/workbench/components/sidebar/types';
import {
  type TreeSearch,
  useTreeSearch,
  useTreeSearchMatches,
} from '@openheaders/ui/workbench/components/sidebar/useTreeSearch';

function makeNode(overrides: Partial<TreeNode> & { id: string }): TreeNode {
  return {
    kind: 'leaf',
    label: overrides.id,
    depth: 0,
    expandable: false,
    icon: null,
    canRename: false,
    canDelete: false,
    canAddChild: false,
    ...overrides,
  };
}

function makeSearch(overrides: Partial<TreeSearch>): TreeSearch {
  return {
    open: true,
    mode: 'search',
    query: '',
    filterText: '',
    revealAll: false,
    highlightQuery: '',
    focusNonce: 0,
    openBar: () => {},
    closeBar: () => {},
    setQuery: () => {},
    setMode: () => {},
    ...overrides,
  };
}

describe('useTreeSearch state machine', () => {
  it('defaults to search mode, closed, empty derivations', () => {
    const { result } = renderHook(() => useTreeSearch());
    expect(result.current.open).toBe(false);
    expect(result.current.mode).toBe('search');
    expect(result.current.filterText).toBe('');
    expect(result.current.revealAll).toBe(false);
    expect(result.current.highlightQuery).toBe('');
  });

  it('search mode: query drives revealAll + highlightQuery, never filterText', () => {
    const { result } = renderHook(() => useTreeSearch());
    act(() => result.current.openBar());
    act(() => result.current.setQuery('openheaders'));
    expect(result.current.filterText).toBe('');
    expect(result.current.revealAll).toBe(true);
    expect(result.current.highlightQuery).toBe('openheaders');
  });

  it('filter mode: query drives filterText only', () => {
    const { result } = renderHook(() => useTreeSearch());
    act(() => result.current.openBar());
    act(() => result.current.setMode('filter'));
    act(() => result.current.setQuery('api'));
    expect(result.current.filterText).toBe('api');
    expect(result.current.revealAll).toBe(false);
    expect(result.current.highlightQuery).toBe('');
  });

  it('closeBar clears the query; openBar bumps the focus nonce', () => {
    const { result } = renderHook(() => useTreeSearch());
    act(() => result.current.openBar());
    const nonceAfterOpen = result.current.focusNonce;
    act(() => result.current.setQuery('x'));
    act(() => result.current.closeBar());
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe('');
    act(() => result.current.openBar());
    expect(result.current.focusNonce).toBeGreaterThan(nonceAfterOpen);
  });
});

describe('useTreeSearchMatches', () => {
  const items: TreeNode[] = [
    makeNode({ id: 'col-a', kind: 'group', label: 'API openheaders.io' }),
    makeNode({ id: 'col-a-empty', kind: 'placeholder', label: 'openheaders placeholder' }),
    makeNode({ id: 'req-1', label: 'GET openheaders.io/users' }),
    makeNode({ id: 'req-2', label: 'Auth token refresh' }),
    makeNode({ id: 'req-3', label: 'POST openheaders.dev/login' }),
  ];

  function setup(query: string) {
    const setFocusedId = vi.fn();
    const containerRef = { current: document.createElement('div') };
    const search = makeSearch({ query });
    const hook = renderHook(() => useTreeSearchMatches({ search, allFlatItems: items, containerRef, setFocusedId }));
    return { hook, setFocusedId };
  }

  it('matches label substrings case-insensitively, excluding placeholders', () => {
    const { hook } = setup('OPENheaders');
    expect(hook.result.current.matchIds).toEqual(['col-a', 'req-1', 'req-3']);
  });

  it('auto-navigates to the first match (cursor follows for Esc resume)', () => {
    const { hook, setFocusedId } = setup('openheaders');
    expect(hook.result.current.activeMatchId).toBe('col-a');
    expect(setFocusedId).toHaveBeenCalledWith('col-a');
  });

  it('cycles matches with wrap-around in both directions', () => {
    const { hook } = setup('openheaders');
    act(() => hook.result.current.goNext());
    expect(hook.result.current.activeMatchId).toBe('req-1');
    act(() => hook.result.current.goNext());
    expect(hook.result.current.activeMatchId).toBe('req-3');
    act(() => hook.result.current.goNext());
    expect(hook.result.current.activeMatchId).toBe('col-a');
    act(() => hook.result.current.goPrev());
    expect(hook.result.current.activeMatchId).toBe('req-3');
  });

  it('openActive fires the active match onOpen', () => {
    const onOpen = vi.fn();
    const setFocusedId = vi.fn();
    const containerRef = { current: document.createElement('div') };
    const search = makeSearch({ query: 'token' });
    const withOpen = items.map((n) => (n.id === 'req-2' ? { ...n, onOpen } : n));
    const { result } = renderHook(() =>
      useTreeSearchMatches({ search, allFlatItems: withOpen, containerRef, setFocusedId }),
    );
    expect(result.current.activeMatchId).toBe('req-2');
    let opened = false;
    act(() => {
      opened = result.current.openActive();
    });
    expect(opened).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('no matches → empty ids, null active, openActive is a no-op', () => {
    const { hook } = setup('no-such-row');
    expect(hook.result.current.matchIds).toEqual([]);
    expect(hook.result.current.activeMatchId).toBeNull();
    let opened = true;
    act(() => {
      opened = hook.result.current.openActive();
    });
    expect(opened).toBe(false);
  });
});

describe('highlightLabel', () => {
  it('wraps every case-insensitive occurrence in a hit span', () => {
    const { container } = render(<span>{highlightLabel('OpenHeaders opens openheaders.io', 'open')}</span>);
    const hits = container.querySelectorAll('.rules-sidebar-search-hit');
    expect(hits).toHaveLength(3);
    expect(hits[0]?.textContent).toBe('Open');
    expect(hits[1]?.textContent).toBe('open');
    expect(hits[2]?.textContent).toBe('open');
    expect(container.textContent).toBe('OpenHeaders opens openheaders.io');
  });

  it('returns the plain label when the query misses or is empty', () => {
    const missed = render(<span>{highlightLabel('Auth token', 'zzz')}</span>);
    expect(missed.container.querySelectorAll('.rules-sidebar-search-hit')).toHaveLength(0);
    const empty = render(<span>{highlightLabel('Auth token', '')}</span>);
    expect(empty.container.querySelectorAll('.rules-sidebar-search-hit')).toHaveLength(0);
  });
});
