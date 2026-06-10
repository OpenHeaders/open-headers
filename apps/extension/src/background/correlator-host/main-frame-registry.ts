/**
 * Main-frame registry — per-tab main-frame id for CDP-attached tabs.
 *
 * CDP `Network.requestWillBeSent` reports a `Document` request for both
 * top-level navigations and iframe documents; webRequest-vocabulary
 * consumers (the rule-engine driver) need the `main_frame` / `sub_frame`
 * split. A frame's id is stable for the frame's lifetime (including
 * cross-process navigations), so the tab's main-frame id is one fact:
 * seeded by `Page.getFrameTree` at attach, refreshed by parentless
 * `Page.frameNavigated` events, cleared on detach.
 */

const mainFrameIdByTab = new Map<number, string>();

export function setMainFrameId(tabId: number, frameId: string): void {
  mainFrameIdByTab.set(tabId, frameId);
}

export function clearMainFrameId(tabId: number): void {
  mainFrameIdByTab.delete(tabId);
}

/**
 * Whether `frameId` is the tab's main frame. Unknown registry state (no
 * CDP attachment, or the seed hasn't landed) reads as `false` — consumers
 * treat an unproven document as a sub-frame document, which degrades to
 * the pre-registry behavior (immediate record) instead of stranding a
 * fire in the commit chain buffer.
 */
export function isMainFrame(tabId: number, frameId: string | undefined): boolean {
  if (frameId === undefined) return false;
  return mainFrameIdByTab.get(tabId) === frameId;
}
