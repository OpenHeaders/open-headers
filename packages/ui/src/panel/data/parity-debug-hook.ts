/**
 * Debug hook for network-panel parity diffing.
 *
 * Exposes `window.__OH_DUMP_PARITY_ROWS__()` returning a JSON-serializable
 * row list shaped to be diffed against the playground capture script's
 * ground-truth Chrome rows (see playground/scripts/capture-parity.mjs).
 *
 * Lifecycle objects carry per-hop attribution + structured error data
 * that the denormalized legacy row erased — strictly better signal for
 * the parity capture loop.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useEffect, useRef } from 'react';
import { currentHarEntry, isPendingLifecycle } from './inspector-row-projection';
import { classifyRequestState, type RequestState } from './request-state';

/** The footer projection a parity capture asserts the panel computes: the
 *  re-anchored DCL / Load / Finish the status bar shows, plus the
 *  root-anchored page inputs they derive from — so a capture sees both ends
 *  of the redirect-leg math without rerunning the projection. */
export interface ParityFooter {
  /** Which correlator fed the panel — `'cdp'` (deep request inspection) vs
   *  the heuristic webRequest path. A footer capture asserts the path it
   *  meant to exercise actually ran. */
  source: string;
  footerDclMs: number | null;
  footerLoadMs: number | null;
  finishTimeMs: number;
  /** Aggregate (whole-timeline) milestones the status bar shows by default —
   *  the per-page `footer*` values shifted to the earliest navigation's
   *  anchor. Equal to `footer*` for a single navigation. */
  aggregateDclMs: number | null;
  aggregateLoadMs: number | null;
  aggregateFinishMs: number;
  /** The footer's zero — the final document's network start in wall ms (the
   *  browser's `baseTime`). A capture asserts this equals the final doc's
   *  network start (issue + queueing), not its issue instant. */
  footerAnchorMs: number;
  /** Redirect leg subtracted to re-anchor the milestones; `0` non-redirect.
   *  Should equal Chrome's `finalNetworkStart − rootNetworkStart`. */
  legMs: number;
  pages: Array<{ id: string; url: string | null; startedAtMs: number; dclMs: number | null; loadMs: number | null }>;
}

interface ParityRow {
  arrivalIndex: number;
  method: string;
  url: string;
  /** Raw wire status (HTTP response status that reached the wire), or null
   *  when no response landed. Independent of error classification — a
   *  CORS-blocked POST can have status:200 here even when the renderer
   *  rejected the response. Useful for diffs that care about wire reality. */
  status: number | null;
  /** What the panel's Status column displays. Null when the row is blocked
   *  / failed / pending (column shows an error label, not the status code).
   *  Use this for parity diffs against Chrome's panel view. */
  displayStatus: number | null;
  statusText: string | null;
  errorCode: string | null;
  errorReason: string | null;
  pending: boolean;
  state: RequestState;
  resourceType: string | null;
}

interface ParityRowDebug extends ParityRow {
  _requestId?: string;
  _harResponseStatus?: number;
  _harResponseError?: string | null;
  _hasErrorField?: boolean;
  /** Redirect / timing fields for document rows — the footer-leg inputs.
   *  Lets a capture see whether a top-level redirect folded into the
   *  lifecycle (`redirectHopCount` > 0, two `har` hops) or arrived
   *  un-folded (CDP mid-attach: count 0, the 3xx hop absent). */
  _redirectHopCount?: number;
  _startedAtMs?: number;
  _hopStartedAtMs?: number;
  /** Current hop's network start (issue + queueing), the footer anchor source.
   *  `null` until the hop's timing/HAR has landed — then it should sit ~one
   *  queueing leg after `_hopStartedAtMs` (the issue instant). */
  _hopNetworkStartMs?: number | null;
  _harHops?: Array<{ status: number | null; startedDateTime: string | null } | null>;
  /** Lifecycle-clock probe (Slice AB): `completedAtMs` and the clamped
   *  `completedAtMs − startedAtMs` the Finish math consumes. A negative raw
   *  delta (monotonic completed vs wall started) clamps to 0 here, which is
   *  the bug this probe confirms. */
  _completedAtMs?: number | null;
  _lifecycleDurationMs?: number;
}

/** Top-level navigation document — the rows the footer leg keys off. */
function isDocumentLike(resourceType: string | undefined): boolean {
  return resourceType === 'main_frame' || resourceType === 'document';
}

function toParityRow(lc: RequestLifecycle, arrivalIndex: number): ParityRow {
  const state = classifyRequestState(lc);
  let displayStatus: number | null = null;
  switch (state.kind) {
    case 'success':
    case 'redirect':
    case 'httpError':
    case 'cached':
      displayStatus = state.status;
      break;
    case 'pending':
    case 'blocked':
    case 'failed':
      displayStatus = null;
      break;
  }
  const har = currentHarEntry(lc);
  const row: ParityRowDebug = {
    arrivalIndex,
    method: lc.method,
    url: lc.url,
    status: lc.statusCode ?? null,
    displayStatus,
    statusText: lc.statusText ?? null,
    errorCode: lc.error?.code ?? null,
    errorReason: lc.error?.reason ?? null,
    pending: isPendingLifecycle(lc),
    state,
    resourceType: lc.resourceType || null,
  };
  // Identity + HAR-join probes on every row — a capture must be able to
  // tell a real lifecycle from a synthesized one (`oh-mem:` prefix) and
  // see which HAR landed, regardless of which site the scenario targets.
  row._requestId = lc.requestId;
  row._harResponseStatus = har?.response?.status;
  row._harResponseError = har?.response?._error;
  row._hasErrorField = lc.error != null;
  row._startedAtMs = lc.startedAtMs;
  row._completedAtMs = lc.completedAtMs ?? null;
  row._lifecycleDurationMs = lc.completedAtMs == null ? 0 : Math.max(0, lc.completedAtMs - lc.startedAtMs);
  if (isDocumentLike(lc.resourceType)) {
    row._redirectHopCount = lc.redirectHopCount;
    row._startedAtMs = lc.startedAtMs;
    row._hopStartedAtMs = lc.hopStartedAtMs;
    row._hopNetworkStartMs = lc.hopNetworkStartMs ?? null;
    row._harHops = lc.har.map((h) =>
      h == null ? null : { status: h.response?.status ?? null, startedDateTime: h.startedDateTime ?? null },
    );
  }
  return row;
}

declare global {
  interface Window {
    __OH_DUMP_PARITY_ROWS__?: () => ParityRow[];
    __OH_DUMP_PARITY_FOOTER__?: () => ParityFooter;
    __OH_CLEAR_PARITY__?: () => void;
  }
}

export function useParityDebugHook(
  lifecycles: readonly RequestLifecycle[],
  footer: ParityFooter,
  clear: () => void,
): void {
  const lifecyclesRef = useRef(lifecycles);
  lifecyclesRef.current = lifecycles;
  const footerRef = useRef(footer);
  footerRef.current = footer;
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    window.__OH_DUMP_PARITY_ROWS__ = () => lifecyclesRef.current.map((lc, i) => toParityRow(lc, i));
    window.__OH_DUMP_PARITY_FOOTER__ = () => footerRef.current;
    window.__OH_CLEAR_PARITY__ = () => clearRef.current();
    return () => {
      delete window.__OH_DUMP_PARITY_ROWS__;
      delete window.__OH_DUMP_PARITY_FOOTER__;
      delete window.__OH_CLEAR_PARITY__;
    };
  }, []);
}
