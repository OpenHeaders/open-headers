/**
 * Inspected-tab override for storage surfaces mounted OUTSIDE a
 * DevTools host. On a DevTools panel the inspected tab is ambient
 * (`hostNavigation.inspectedTabId()` — one surface, one tab); the
 * desktop workbench instead mounts the Storage tool window per WATCHED
 * source, so each mount provides its own tab binding here and the
 * ambient read stays the fallback.
 *
 * The provided value is a HOST-SCOPED tab handle: whatever id the
 * installed `StorageInspectorHost` resolves — the extension's real
 * browser tab id, or the workbench host's minted local handle for a
 * `(peer, tab)` pair (browser tab ids collide across browsers, so the
 * workbench never threads raw ones through shared components).
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { createContext, useContext } from 'react';

export const InspectedTabContext = createContext<number | null>(null);

/** The tab this storage surface inspects — the mount's provided handle,
 *  else the ambient DevTools inspected tab (`null` outside both). */
export function useInspectedTabId(): number | null {
  const fromContext = useContext(InspectedTabContext);
  return fromContext ?? hostNavigation.inspectedTabId();
}
