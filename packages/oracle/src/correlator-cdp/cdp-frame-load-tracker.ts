/**
 * Stateful frame-load tracking for the CDP correlator — the source of the
 * `loadingStoppedAtMs` lifecycle fact.
 *
 * A document canceled mid-stream (a stop() during the body download) gets
 * NO `Network.loadingFinished` / `loadingFailed`: on the CDP plane it is
 * structurally indistinguishable from an active download forever. The one
 * event that records the interruption is `Page.frameStoppedLoading` — on a
 * clean load the document's terminal precedes the frame stop, so "the main
 * frame stopped loading while its document request is still in flight" is
 * an exact teardown fact (probe: `probe-frame-stopped-loading.mjs`).
 *
 * Binding: a main-frame document request's `requestId` equals the
 * navigation's `loaderId`, and `frameNavigated` ties the frame to that
 * loader. Document candidates are tracked from `requestWillBeSent`
 * (`type: 'Document'`), bound at the main-frame commit, and marked
 * terminal by `loadingFinished` / `loadingFailed`. Only the committed
 * main-frame document is ever stamped — subresources that a stop() kills
 * get their own real terminal events, and a long-lived fetch that simply
 * outlives the page load must never read as interrupted.
 *
 * State posture mirrors the sibling stateful helpers ({@link CdpHarBuilder},
 * `CdpPageCorrelator`): scoped by tab, cleared by {@link forgetTab}, the
 * candidate map bounded with oldest-first eviction.
 */

import type { CdpNetworkEvent } from './events';
import type { CdpPageEvent } from './page-events';

/**
 * Per-tab cap on tracked document candidates. One real document request
 * exists per navigation plus a handful of same-process sub-frame
 * documents; the cap bounds the leak from navigations whose commit never
 * arrives. Oldest-inserted evicts first.
 */
export const MAX_FRAME_LOAD_DOC_CANDIDATES_PER_TAB = 64;

/** A document request observed but not yet bound to a frame commit. */
interface DocCandidate {
  readonly sessionId: string;
  readonly requestId: string;
  terminal: boolean;
}

interface TabFrameLoadState {
  /** Document requests by loader id (`requestId === loaderId` for docs). */
  readonly candidatesByLoaderId: Map<string, DocCandidate>;
  /** The committed main frame and its document request. */
  current?: {
    readonly frameId: string;
    readonly loaderId: string;
    readonly doc: DocCandidate;
    /** A frame stop is stamped once; repeats are spent. */
    stamped: boolean;
  };
}

/** The still-in-flight document a frame stop interrupted. */
export interface InterruptedDocument {
  readonly sessionId: string;
  readonly requestId: string;
}

export class CdpFrameLoadTracker {
  private readonly perTab = new Map<number, TabFrameLoadState>();

  /** Track document candidates and their terminals from the network stream. */
  observeNetwork(event: CdpNetworkEvent): void {
    switch (event.method) {
      case 'Network.requestWillBeSent': {
        if (event.type !== 'Document') return;
        const state = this.ensureState(event.tabId);
        // A redirect continuation reuses the same (sessionId, requestId,
        // loaderId) — re-setting keeps the single identity, still non-terminal.
        state.candidatesByLoaderId.set(event.loaderId, {
          sessionId: event.sessionId,
          requestId: event.requestId,
          terminal: false,
        });
        while (state.candidatesByLoaderId.size > MAX_FRAME_LOAD_DOC_CANDIDATES_PER_TAB) {
          const oldest = state.candidatesByLoaderId.keys().next().value;
          if (oldest === undefined) break;
          state.candidatesByLoaderId.delete(oldest);
        }
        return;
      }
      case 'Network.loadingFinished':
      case 'Network.loadingFailed': {
        const state = this.perTab.get(event.tabId);
        if (state === undefined) return;
        const current = state.current;
        if (
          current !== undefined &&
          current.doc.sessionId === event.sessionId &&
          current.doc.requestId === event.requestId
        ) {
          current.doc.terminal = true;
          return;
        }
        const candidate = state.candidatesByLoaderId.get(event.requestId);
        if (candidate !== undefined && candidate.sessionId === event.sessionId) candidate.terminal = true;
        return;
      }
      default:
        return;
    }
  }

  /**
   * Fold one page event. Returns the interrupted document when a main-frame
   * stop caught its committed document request still in flight — the caller
   * emits the `loadingStoppedAtMs` patch for it. `null` otherwise.
   */
  observePage(event: CdpPageEvent): InterruptedDocument | null {
    switch (event.method) {
      case 'Page.frameNavigated': {
        if (event.frame.parentId !== undefined) return null;
        const state = this.ensureState(event.tabId);
        const doc = state.candidatesByLoaderId.get(event.frame.loaderId);
        if (doc === undefined) {
          // Commit with no tracked document (mid-flight attach) — drop any
          // prior binding; there is nothing to stamp for this page.
          state.current = undefined;
          return null;
        }
        state.current = { frameId: event.frame.id, loaderId: event.frame.loaderId, doc, stamped: false };
        // The prior navigation's candidates are spent; the bound doc lives
        // on `current`.
        state.candidatesByLoaderId.clear();
        return null;
      }
      case 'Page.frameStoppedLoading': {
        const current = this.perTab.get(event.tabId)?.current;
        if (current === undefined || current.frameId !== event.frameId) return null;
        if (current.doc.terminal || current.stamped) return null;
        current.stamped = true;
        return { sessionId: current.doc.sessionId, requestId: current.doc.requestId };
      }
      default:
        return null;
    }
  }

  /** Drop all frame-load state for a tab — invariant 2. */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /** Discard all accumulated state. */
  clear(): void {
    this.perTab.clear();
  }

  private ensureState(tabId: number): TabFrameLoadState {
    let state = this.perTab.get(tabId);
    if (state === undefined) {
      state = { candidatesByLoaderId: new Map() };
      this.perTab.set(tabId, state);
    }
    return state;
  }
}
