/**
 * Live-canonical scheduler for storage document editors.
 *
 * The document editors (cookie / DOM entry / IDB record) fetch their
 * canonical one-shot at mount, so quick edits from the tool window and
 * changes made in the browser's own storage (page JS, native DevTools,
 * network Set-Cookie) never reach an open tab. This hook gives every
 * editor the same catch-up cadence; the MERGE stays in the editor —
 * shapes differ per document kind and the conflict tier's adapters
 * slot in there later without touching this scheduler.
 *
 * `sync()` runs on three signals:
 *
 *   1. A per-kind feed notify (`subscribe`) — debounced to coalesce
 *      invalidation storms (the Cookies section's poll invalidates the
 *      jar cache every tick while the tool window is open). Active for
 *      background tabs too: notifies are event-driven and cheap, and a
 *      hidden document should be current the moment it's shown.
 *   2. A fixed poll while this editor is the ACTIVE tab of its group
 *      and DevTools is visible. The sections' polls gate on the tool
 *      window being open, so the editor polling itself is what lets
 *      page-originated writes flow in while only the tab is open.
 *   3. Once on tab activation — a background tab that missed poll
 *      ticks catches up the moment the user focuses it.
 *
 * The caller's `sync` must be a SILENT refetch: token-guarded, never
 * flipping the document into its loading state.
 */

import { useTabActive } from '@openheaders/ui/shared/awareness/TabActiveContext';
import { useEffect, useRef } from 'react';

const SYNC_POLL_MS = 2000;
const NOTIFY_DEBOUNCE_MS = 200;

export interface UseDocumentSyncArgs {
  /** Gate for every signal — callers pass false until the document
   *  loaded (nothing to merge into) and while a save is in flight
   *  (the save path refetches itself; a mid-save merge would race it). */
  enabled: boolean;
  /** Silent canonical refetch + merge. Fire-and-forget from here. */
  sync: () => void;
  /** Per-kind instant feed (jar cache notifies, host invalidation
   *  pushes, the DOM write notifier). Optional — the poll alone still
   *  provides the live tier. */
  subscribe?: (listener: () => void) => () => void;
}

export function useDocumentSync({ enabled, sync, subscribe }: UseDocumentSyncArgs): void {
  // Latest-callback ref so subscription/poll effects don't re-run on
  // every render of the owning editor.
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const tabActive = useTabActive();

  useEffect(() => {
    if (!enabled || !subscribe) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        syncRef.current();
      }, NOTIFY_DEBOUNCE_MS);
    });
    return () => {
      if (timer !== null) clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, subscribe]);

  useEffect(() => {
    if (!enabled || !tabActive) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      syncRef.current();
    }, SYNC_POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, tabActive]);

  const wasActiveRef = useRef(tabActive);
  useEffect(() => {
    if (enabled && tabActive && !wasActiveRef.current) syncRef.current();
    wasActiveRef.current = tabActive;
  }, [enabled, tabActive]);
}
