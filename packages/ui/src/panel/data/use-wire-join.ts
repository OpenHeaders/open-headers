/**
 * `useWireJoin` — the consume-time wire-join seam
 * (OBSERVABILITY_PLAN.md Phase 6) for a network capture surface.
 *
 * `'browser'` mode (a watched browser-tab partition on a host that runs
 * the wire capture): mounts a SECOND lifecycle client on the local
 * proxy partition, computes the pure {@link computeWireJoin} over the
 * two snapshots, and projects a merged snapshot whose joined rows carry
 * the additive wire layer ({@link WireJoinMerger} keeps row identity
 * stable). Matches are also written into the historical wire-seen
 * record so the Wire source view can annotate its twin rows after a
 * source switch.
 *
 * `'wire'` mode (the Wire source view itself): no second client — the
 * view's own partition IS the wire; the hook surfaces the seen-record
 * labels for the `wire-seen` annotation.
 *
 * `'off'` (the in-browser DevTools panel, hosts without the proxy):
 * everything is inert and the input snapshot passes through untouched.
 *
 * The mode is fixed per mount — capture surfaces remount per source via
 * their `key`, which is what keeps the hook order unconditional.
 */

import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { LifecycleClientSnapshot } from './stores/lifecycle-client-store';
import { useLifecycleClient } from './stores/use-lifecycle-client';
import { computeWireJoin, EMPTY_WIRE_JOIN, WireJoinMerger } from './wire-join';
import { getWireSeenSnapshot, recordWireSeen, subscribeWireSeen } from './wire-seen-store';

export type WireJoinMode = 'browser' | 'wire' | 'off';

/** Source identity of a `'browser'`-mode surface, recorded with each
 *  match so the Wire view can name (and jump back to) the tab. */
export interface WireJoinSourceRef {
  readonly nodeId: string;
  readonly tabId: number;
  readonly label: string | null;
}

export interface UseWireJoinOptions {
  readonly mode: WireJoinMode;
  /** The surface's own partition snapshot (browser rows in `'browser'`
   *  mode, wire rows in `'wire'` mode). */
  readonly snapshot: LifecycleClientSnapshot;
  /** Required in `'browser'` mode for the seen record; omit elsewhere. */
  readonly source?: WireJoinSourceRef;
}

export interface UseWireJoinResult {
  /** Snapshot for the panel pipeline — merged in `'browser'` mode, the
   *  input otherwise. */
  readonly snapshot: LifecycleClientSnapshot;
  /** `'browser'` mode: requestIds carrying a derived wire layer. */
  readonly joinedIds: ReadonlySet<string> | undefined;
  /** `'wire'` mode: wireRequestId → witnessing tab title (null unknown). */
  readonly seenLabels: ReadonlyMap<string, string | null> | undefined;
  /**
   * Route one hop's response-body pull to the wire twin. Returns `true`
   * when the hop is joined and the pull was issued on the wire client
   * (the body lands in the wire store and re-derives the merged row);
   * `false` means the caller should pull on its own client.
   */
  readonly pullWireBody: (browserRequestId: string, hopIndex: number) => boolean;
}

const EMPTY_SEEN: ReadonlyMap<string, string | null> = new Map();

export function useWireJoin({ mode, snapshot, source }: UseWireJoinOptions): UseWireJoinResult {
  // Second client on the LOCAL proxy partition — in-process on the
  // desktop host, so the subscription costs no wire traffic. Inert
  // outside 'browser' mode.
  const wireClient = useLifecycleClient({ tabId: PROXY_LIFECYCLE_TAB_ID, enabled: mode === 'browser' });
  const wireSnapshot = wireClient.snapshot;

  const join = useMemo(
    () => (mode === 'browser' ? computeWireJoin(snapshot.ordered, wireSnapshot.ordered) : EMPTY_WIRE_JOIN),
    [mode, snapshot, wireSnapshot],
  );

  const mergerRef = useRef<WireJoinMerger | null>(null);
  if (mergerRef.current === null) mergerRef.current = new WireJoinMerger();
  const merger = mergerRef.current;

  const merged = useMemo<LifecycleClientSnapshot>(() => {
    if (mode !== 'browser' || join.byBrowserId.size === 0) return snapshot;
    const byRequestId = new Map<string, LifecycleClientSnapshot['ordered'][number]>();
    const ordered = snapshot.ordered.map((row) => {
      const matches = join.byBrowserId.get(row.requestId);
      const next = matches !== undefined ? merger.merge(row, matches, wireSnapshot.byRequestId) : row;
      byRequestId.set(next.requestId, next);
      return next;
    });
    merger.prune(new Set(byRequestId.keys()));
    return { byRequestId, ordered };
  }, [mode, join, snapshot, wireSnapshot, merger]);

  const joinedIds = useMemo<ReadonlySet<string> | undefined>(
    () => (mode === 'browser' && join.byBrowserId.size > 0 ? new Set(join.byBrowserId.keys()) : undefined),
    [mode, join],
  );

  // Historical record: every match is a completed observation of "both
  // witnesses saw this exchange" — the Wire view reads it after the
  // source switch (attribution of history, never live state).
  useEffect(() => {
    if (mode !== 'browser' || source === undefined) return;
    for (const [wireRequestId, back] of join.byWireId) {
      recordWireSeen(wireRequestId, {
        nodeId: source.nodeId,
        tabId: source.tabId,
        browserRequestId: back.browserRequestId,
        label: source.label,
      });
    }
  }, [mode, join, source]);

  const seenSnapshot = useSyncExternalStore(subscribeWireSeen, getWireSeenSnapshot);
  const seenLabels = useMemo<ReadonlyMap<string, string | null> | undefined>(() => {
    if (mode !== 'wire') return undefined;
    if (seenSnapshot.size === 0) return EMPTY_SEEN;
    return new Map([...seenSnapshot].map(([id, record]) => [id, record.label]));
  }, [mode, seenSnapshot]);

  const pullWireBody = useCallback(
    (browserRequestId: string, hopIndex: number): boolean => {
      if (mode !== 'browser') return false;
      const match = join.byBrowserId.get(browserRequestId)?.find((m) => m.hopIndex === hopIndex);
      if (match === undefined) return false;
      const wireRow = wireSnapshot.byRequestId.get(match.wireRequestId);
      if (wireRow === undefined) return false;
      wireClient.requestResponseBody(match.wireRequestId, wireRow.redirectHopCount);
      return true;
    },
    [mode, join, wireSnapshot, wireClient],
  );

  return useMemo(
    () => ({ snapshot: merged, joinedIds, seenLabels, pullWireBody }),
    [merged, joinedIds, seenLabels, pullWireBody],
  );
}
