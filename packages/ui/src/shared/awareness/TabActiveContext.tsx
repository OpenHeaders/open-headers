/**
 * Tab-active context — propagates "is this part of the surface
 * currently visible/active to the user?" down the React tree.
 *
 * The dock-layout's `TabPanel` sets `display: none` on inactive tabs
 * (one editor mounted per tab, only the active one rendered in
 * layout). Awareness should reflect what the user is actively
 * viewing, not what's merely mounted, so `useAwareness` reads this
 * context and gates publishing on it.
 *
 * Default outside any provider is `true` — surfaces that don't have
 * inner tabs (popup, sidepanel, devpanel) just publish whenever their
 * editor is mounted, which is exactly right for those surfaces.
 *
 * Why a context instead of DOM-based detection (ResizeObserver /
 * IntersectionObserver / `offsetParent`): the layout system already
 * knows the answer authoritatively. A context push is a single,
 * synchronous, type-safe signal; DOM detection is a pile of edge
 * cases (scroll-out-of-view false positives, race against layout
 * commit, observer churn). We reach for DOM-shape detection only
 * when the layout system is opaque to us — here it's not.
 */

import { createContext, useContext } from 'react';

const TabActiveContext = createContext<boolean>(true);

export const TabActiveProvider = TabActiveContext.Provider;

/** Returns whether the calling React subtree is in the active tab of
 *  its enclosing dock-layout slot. `true` when not nested in any
 *  TabActiveProvider — the right default for surfaces without inner
 *  tabs (popup, sidepanel, devpanel). */
export function useTabActive(): boolean {
  return useContext(TabActiveContext);
}
