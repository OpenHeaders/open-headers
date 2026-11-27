/**
 * A workflow's draft with where its steps were placed on the graph, as
 * one undo history (the workflow runs plan, Decisions log, S31): a node
 * moved is an entry like any edit, taken back and brought back in its
 * turn.
 *
 * The places are beside the draft, never in it — they are this device's
 * (`use-kept-node-places.ts`) — so a move leaves the draft as it was and
 * a workflow reads unsaved by its draft alone. A draft replaced from
 * outside the user's edits empties the history and keeps the places.
 */

import type { WorkflowNodePlaces } from '@openheaders/core/utils';
import { useCallback, useRef } from 'react';
import { type DraftHistoryControls, useDraftHistory } from './use-draft-history';

interface Arranged<D> {
  draft: D;
  /** `null` while the graph follows its computed layout. */
  places: WorkflowNodePlaces | null;
}

export interface ArrangedDraft<D> {
  draft: D;
  places: WorkflowNodePlaces | null;
  /** A user's edit of the draft: an entry of the history. */
  edit: (next: D) => void;
  /** The nodes placed, or their places forgotten (`null`): an entry of the same history. */
  move: (next: WorkflowNodePlaces | null) => void;
  /** The draft replaced from outside the user's edits — see `useDraftHistory`. */
  replace: (update: (current: D) => D) => void;
  /** The places this device kept were read: they are where the graph stood before any move here, and no edit. */
  placesRead: (kept: WorkflowNodePlaces) => void;
  history: DraftHistoryControls;
}

export function useArrangedDraft<D>(initial: () => D): ArrangedDraft<D> {
  const {
    draft: held,
    edit: editEntry,
    replace: replaceEntry,
    restate,
    history,
  } = useDraftHistory<Arranged<D>>(() => ({ draft: initial(), places: null }));
  // An edit of one half keeps the other as it is now, whenever its door was handed out.
  const heldRef = useRef(held);
  heldRef.current = held;

  const edit = useCallback((next: D) => editEntry({ draft: next, places: heldRef.current.places }), [editEntry]);

  const move = useCallback(
    (next: WorkflowNodePlaces | null) => editEntry({ draft: heldRef.current.draft, places: next }),
    [editEntry],
  );

  const replace = useCallback(
    (update: (current: D) => D) =>
      replaceEntry((current) => {
        const next = update(current.draft);
        return next === current.draft ? current : { ...current, draft: next };
      }),
    [replaceEntry],
  );

  const placesRead = useCallback(
    (kept: WorkflowNodePlaces) => restate((entry) => (entry.places === null ? { ...entry, places: kept } : entry)),
    [restate],
  );

  return { draft: held.draft, places: held.places, edit, move, replace, placesRead, history };
}
