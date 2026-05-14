/**
 * useWorkspaceTabTitle — sole owner of `document.title` for the
 * workspace surface. Every route that wants a contextual title (e.g.
 * the active rule name) passes a `base` through {@link composeTitle};
 * no other component writes `document.title` directly.
 *
 * Pulls its ordinal + count from the SW `workspace-tab-registry`:
 *   • one RPC on mount (`getWorkspaceTabOrdinal`) fetches this tab's
 *     ordinal + the global count. The SW derives the tab id from
 *     `sender.tab.id` so the renderer never has to know its own id.
 *     Ordinals are STABLE within a tab's lifetime, so one read is
 *     enough — we only listen for `count` updates after.
 *   • a `workspaceTabsChanged` broadcast subscription carries the
 *     updated `count` whenever the registry assigns/frees a tab.
 *     The renderer recomposes its title with the new count but the
 *     same cached ordinal.
 *
 * Title rule (Phase 9 §5):
 *   • `count <= 1` → `'Open Headers'` (or the composed `base` verbatim)
 *   • `count >= 2` → `'#<ordinal> Open Headers'` (or `'#<ordinal> <base>'`)
 *
 * Ordinals are STABLE within a tab's lifetime — the registry never
 * renumbers on close, so the prefix only disappears when `count`
 * drops to 1 (then shedding the number entirely). Route changes
 * updating `base` recompose through the same helper.
 *
 * Tab-discard swap: if Chrome discards and later restores the tab,
 * the page reloads — the hook re-mounts, the RPC runs again, and the
 * registry's `onReplaced` handler has already transferred the
 * ordinal to the new tab id, so the user sees the same prefix.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_BASE = 'Open Headers';

interface RegistryState {
  ordinal: number | null;
  count: number;
}

/**
 * Compose a `document.title` value for the workspace tab. Exported
 * so route-aware titles (e.g. "rule X — Open Headers") flow through
 * ONE helper and pick up the ordinal prefix uniformly.
 *
 * - `count <= 1` → `base` verbatim (no prefix when there's no
 *   ambiguity to resolve).
 * - `count >= 2` with known ordinal → `#<ordinal> <base>`.
 * - `count >= 2` with unknown ordinal (pre-RPC window) → `base`
 *   verbatim: a placeholder `#? base` would flash worse than the
 *   clean default that the first RPC overwrites within a frame.
 */
export function composeTitle(state: RegistryState, base: string = DEFAULT_BASE): string {
  if (state.count <= 1) return base;
  if (state.ordinal === null) return base;
  return `#${state.ordinal} ${base}`;
}

interface UseWorkspaceTabTitleResult {
  /** `count <= 1 ? null : ordinal` — convenient for surfaces that
   *  want to render "#<n>" inline without the full composed title. */
  ordinal: number | null;
  /** Live count of workspace tabs — useful for conditional chrome. */
  count: number;
  /**
   * Swap the contextual base (e.g. active rule name). Re-composes
   * `document.title` through the same prefix rule. Pass `null` or
   * `undefined` to revert to the default "Open Headers".
   */
  setBase: (base: string | null | undefined) => void;
}

/**
 * Mount ONCE at the workspace root. Mounting twice would install
 * two broadcast subscriptions and race writes to `document.title`;
 * the invariant is enforced by convention, not code, so keep the
 * single call at the top-level shell.
 */
export function useWorkspaceTabTitle(): UseWorkspaceTabTitleResult {
  const [state, setState] = useState<RegistryState>({ ordinal: null, count: 1 });
  // Once the RPC resolves, the ordinal is immutable for this
  // renderer's lifetime (see module docstring). `countRef` mirrors
  // the latest count so `setBase` can recompose against the current
  // state without taking a stale-closure dependency on `state.count`.
  const ordinalRef = useRef<number | null>(null);
  const countRef = useRef<number>(1);
  const baseRef = useRef<string>(DEFAULT_BASE);

  const applyTitle = useCallback((count: number): void => {
    countRef.current = count;
    const snapshot: RegistryState = { ordinal: ordinalRef.current, count };
    document.title = composeTitle(snapshot, baseRef.current);
    setState(snapshot);
  }, []);

  const setBase = useCallback(
    (base: string | null | undefined) => {
      baseRef.current = base && base.trim().length > 0 ? base : DEFAULT_BASE;
      applyTitle(countRef.current);
    },
    [applyTitle],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time setup — `applyTitle` is stable (useCallback with empty deps); re-running the effect would retrigger the RPC and race broadcasts arriving between tear-down and re-subscribe.
  useEffect(() => {
    let cancelled = false;

    hostBridge.call('getWorkspaceTabOrdinal')
      .then((res) => {
        if (cancelled) return;
        ordinalRef.current = res.ordinal;
        applyTitle(res.count);
      })
      .catch(() => {
        // SW asleep / bridge briefly unavailable during extension
        // reload — leave the existing document.title (the HTML
        // default "Open Headers") in place until the next broadcast
        // or a caller-provided re-mount.
      });

    const unsubscribe = hostBridge.subscribe('workspaceTabsChanged', (payload) => {
      if (cancelled) return;
      applyTitle(payload.count);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { ordinal: state.count <= 1 ? null : state.ordinal, count: state.count, setBase };
}
