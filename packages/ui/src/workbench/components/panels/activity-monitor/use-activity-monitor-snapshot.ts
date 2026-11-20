/**
 * The activity monitor's pull (the activity monitor plan §6, law 2; §7,
 * fork 4): the panel asks the host every two seconds, and ONLY while it
 * is the active tab of its dock in a visible document. The dock keeps a
 * body mounted through tab switches and close/reopen, so nothing here
 * runs on a mount alone — with nobody looking, nothing is asked and the
 * host reads nothing.
 */

import type { ActivityMonitorCursor, ActivityMonitorSnapshot } from '@openheaders/core/activity-monitor';
import { hostBridge } from '@openheaders/core/bridge';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export const ACTIVITY_MONITOR_PULL_MS = 2_000;

function subscribeToVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function isDocumentVisible(): boolean {
  return document.visibilityState === 'visible';
}

export interface ActivityMonitorView {
  /** The host's latest answer; null before the first one and after an ask that went unanswered. */
  snapshot: ActivityMonitorSnapshot | null;
  /** The last ask went unanswered. */
  unreadable: boolean;
}

export function useActivityMonitorSnapshot(active: boolean): ActivityMonitorView {
  const visible = useSyncExternalStore(subscribeToVisibility, isDocumentVisible);
  const viewed = active && visible;
  const [view, setView] = useState<ActivityMonitorView>({ snapshot: null, unreadable: false });
  const cursorRef = useRef<ActivityMonitorCursor | null>(null);

  useEffect(() => {
    if (!viewed) return;
    let stopped = false;
    let asking = false;
    const pull = (): void => {
      if (asking) return;
      asking = true;
      hostBridge.call('oh.activityMonitor.sample', { cursor: cursorRef.current }).then(
        (snapshot) => {
          asking = false;
          if (stopped) return;
          cursorRef.current = snapshot.cursor;
          setView({ snapshot, unreadable: false });
        },
        () => {
          asking = false;
          if (stopped) return;
          setView({ snapshot: null, unreadable: true });
        },
      );
    };
    pull();
    const timer = setInterval(pull, ACTIVITY_MONITOR_PULL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [viewed]);

  return view;
}
