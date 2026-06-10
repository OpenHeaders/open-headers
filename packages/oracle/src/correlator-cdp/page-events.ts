/**
 * Typed CDP **Page-domain** event variants — the subset the page
 * correlator consumes to reconstruct HAR `log.pages[]` timings.
 *
 * Field names match the CDP protocol verbatim. Source:
 * https://chromedevtools.github.io/devtools-protocol/tot/Page/
 *
 * Why these four:
 *   - `frameNavigated` is the navigation-commit signal. The main frame
 *     (no `parentId`) committing is the page boundary; its `loaderId` ties
 *     the page to its document `Network.requestWillBeSent` (whose timing is
 *     the page's start baseline, exactly as Chrome's `PageLoad.startTime =
 *     mainRequest.startTime`).
 *   - `domContentEventFired` / `loadEventFired` carry the monotonic
 *     timestamps of the DOMContentLoaded / load events — HAR
 *     `pageTimings.onContentLoad` / `onLoad`, as offsets from the page
 *     start. Chrome reads the same CDP events (`ResourceTreeModel`).
 *   - `frameStoppedLoading` is the document-teardown signal: a document
 *     canceled mid-stream (a stop() during the body download) gets NO
 *     `Network.loadingFinished` / `loadingFailed` — the frame stop is the
 *     only event that records the interruption. On a clean load the
 *     document's `loadingFinished` precedes the frame stop, so "frame
 *     stopped while the document request is still in flight" is exact.
 *
 * These are page-target (root-session) events for the tab's main frame;
 * the chrome adapter only enables the Page domain on the root target, so
 * out-of-process iframes never surface their own page lifecycle here.
 */

/** One frame of the page frame tree — `Page.Frame` (the subset we read). */
export interface CdpPageFrame {
  readonly id: string;
  /** Absent on the tab's top frame; present on sub-frames. */
  readonly parentId?: string;
  /** The navigation's loader id — ties the frame to its document request. */
  readonly loaderId: string;
  readonly url: string;
}

/** `Page.frameNavigated` — a frame committed a navigation. */
export interface CdpFrameNavigated {
  readonly method: 'Page.frameNavigated';
  readonly tabId: number;
  /** CDP session the event arrived on — the root page target. */
  readonly sessionId: string;
  readonly frame: CdpPageFrame;
}

/** `Page.domContentEventFired` — DOMContentLoaded for the main frame. */
export interface CdpDomContentEventFired {
  readonly method: 'Page.domContentEventFired';
  readonly tabId: number;
  readonly sessionId: string;
  /** Monotonic seconds (CDP `MonotonicTime`) — same base as resource timing. */
  readonly timestamp: number;
}

/** `Page.loadEventFired` — the load event for the main frame. */
export interface CdpLoadEventFired {
  readonly method: 'Page.loadEventFired';
  readonly tabId: number;
  readonly sessionId: string;
  /** Monotonic seconds (CDP `MonotonicTime`). */
  readonly timestamp: number;
}

/** `Page.frameStoppedLoading` — a frame's loading state went idle. */
export interface CdpFrameStoppedLoading {
  readonly method: 'Page.frameStoppedLoading';
  readonly tabId: number;
  readonly sessionId: string;
  readonly frameId: string;
  /**
   * Wall-clock ms stamped by the adapter at event arrival — the protocol
   * event carries no timestamp of its own. Millisecond fidelity is all the
   * consumer needs (the instant marks a fact, it feeds no timing math).
   */
  readonly atWallMs: number;
}

export type CdpPageEvent = CdpFrameNavigated | CdpDomContentEventFired | CdpLoadEventFired | CdpFrameStoppedLoading;
