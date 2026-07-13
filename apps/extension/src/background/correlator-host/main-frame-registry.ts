/**
 * Frame registry — per-tab frame facts for CDP-attached tabs.
 *
 * Two facts, both keyed by the stable frame id (stable for the frame's
 * lifetime, including cross-process navigations):
 *
 *   - The tab's MAIN-frame id. CDP `Network.requestWillBeSent` reports a
 *     `Document` request for both top-level navigations and iframe
 *     documents; webRequest-vocabulary consumers (the rule-engine driver)
 *     need the `main_frame` / `sub_frame` split.
 *   - Every frame's document URL. The JS-contexts selector titles frame
 *     contexts by the frame URL's last path segment, the way the browser
 *     labels frames (`frame.html`) — the context wire carries only the
 *     `frameId`.
 *
 * Seeded by `Page.getFrameTree` at attach (root session, and each kept
 * OOPIF child), refreshed by `Page.frameNavigated` events (parentless ones
 * also refresh the main-frame id), cleared on detach.
 */

const mainFrameIdByTab = new Map<number, string>();
const frameUrlsByTab = new Map<number, Map<string, string>>();

export function setMainFrameId(tabId: number, frameId: string): void {
  mainFrameIdByTab.set(tabId, frameId);
}

export function setFrameUrl(tabId: number, frameId: string, url: string): void {
  let frames = frameUrlsByTab.get(tabId);
  if (frames === undefined) {
    frames = new Map();
    frameUrlsByTab.set(tabId, frames);
  }
  frames.set(frameId, url);
}

/** The frame's last known document URL; `undefined` while unseen. */
export function frameUrlOf(tabId: number, frameId: string | undefined): string | undefined {
  if (frameId === undefined) return undefined;
  return frameUrlsByTab.get(tabId)?.get(frameId);
}

/**
 * The tab's current main-frame document URL; `undefined` until the attach
 * seed (or the first `Page.frameNavigated`) lands. Consumers treating the
 * URL as a match input must handle `undefined` as "unknown", not "any".
 */
export function mainFrameUrlOf(tabId: number): string | undefined {
  const frameId = mainFrameIdByTab.get(tabId);
  if (frameId === undefined) return undefined;
  return frameUrlsByTab.get(tabId)?.get(frameId);
}

export function clearFrameRegistry(tabId: number): void {
  mainFrameIdByTab.delete(tabId);
  frameUrlsByTab.delete(tabId);
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
