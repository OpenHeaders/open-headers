/**
 * `useNavTiming` — derives the legacy `InspectorNavTiming` shape from
 * the most-recent page in `PageClientSnapshot`.
 *
 * This is the thin compatibility layer for the status-bar / nav-timing
 * UI: the legacy hook returned a flat `{ pageOrigin, dclMs?, loadMs? }`
 * snapshot, and downstream code (PanelStatusBar, etc.) destructures
 * those fields directly. Translating once here keeps the renderer
 * migration mechanical — no per-component branching on the page-stream
 * shape.
 *
 * `null` when no page has been observed yet OR when the latest page
 * has no timing-related data. The status bar interprets `null` as
 * "no metrics available" — matches the legacy behaviour.
 */

import type { InspectorNavTiming } from '@openheaders/core/types';
import { useMemo } from 'react';

import type { PageClientSnapshot } from './page-client-store';

export function useNavTiming(snapshot: PageClientSnapshot): InspectorNavTiming | null {
  return useMemo(() => {
    if (snapshot.pages.length === 0) return null;
    const latest = snapshot.pages[snapshot.pages.length - 1];
    if (latest.url == null && latest.dclMs == null && latest.loadMs == null) return null;
    return {
      pageOrigin: latest.url ?? null,
      ...(latest.dclMs != null ? { dclMs: latest.dclMs } : {}),
      ...(latest.loadMs != null ? { loadMs: latest.loadMs } : {}),
    };
  }, [snapshot]);
}
