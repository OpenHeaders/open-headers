/**
 * Read-only DOM storage snapshot for a NON-active area — powers the
 * Storage nav rail's match-count badges while a filter is typed. The
 * active section's data rides `useStorageInspector`; this hook covers
 * the other area with the same poll cadence and token guard, and does
 * nothing at all (`active: false`) while no filter is set, so the idle
 * data-plane cost of the panel is unchanged.
 */

import { useEffect, useRef, useState } from 'react';
import { useInspectedTabId } from '../inspected-tab-context';
import type { DomStorageArea, DomStorageSnapshot } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const POLL_MS = 2000;

export function useDomAreaSnapshot(
  active: boolean,
  frameId: number | null,
  area: DomStorageArea,
): DomStorageSnapshot | null {
  const [snapshot, setSnapshot] = useState<DomStorageSnapshot | null>(null);
  const tokenRef = useRef(0);
  const tabId = useInspectedTabId();

  useEffect(() => {
    const host = getStorageInspectorHost();
    if (!active || host === null || tabId === null || frameId === null) {
      tokenRef.current++;
      setSnapshot(null);
      return;
    }
    const read = async () => {
      const token = ++tokenRef.current;
      const result = await host.readDomStorage(tabId, frameId, area);
      if (token !== tokenRef.current) return;
      if (result !== null) setSnapshot(result);
    };
    void read();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void read();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active, frameId, area, tabId]);

  return snapshot;
}
