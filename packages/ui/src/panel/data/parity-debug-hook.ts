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
 *
 * Rows arrive with their attached fires so a capture can assert the
 * fire-evidence plane too: per-fire tiers, per-mod wire verdicts, the
 * producer capture-point stamps, and the marker header values they were
 * judged against (see `parityFireFields`). The fire-evidence probe
 * (playground/scripts/probe-fire-evidence.mjs) joins these against
 * backend-observed truth — a divergence is a fire-evidence bug.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';
import { useEffect, useRef } from 'react';
import {
  capturedHeaderSet,
  deriveFireEvidence,
  type FireDotTier,
  fireTier,
  type ModEvidenceReason,
  type ModEvidenceVerdict,
  rowFireTier,
} from './fire-evidence';
import { currentHarEntry, type InspectorRowWithFires, isPendingLifecycle } from './inspector-row-projection';
import { classifyRequestState, type RequestState } from './request-state';
import type { InspectorFire } from './types';

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

/** One attached fire as the capture sees it — the raw evidence inputs
 *  (`authoritative` / `evidence`) kept separate from the derived tier so
 *  a probe on an unpacked install (where `onRuleMatchedDebug` exists and
 *  everything is authoritative-blue) can still assert wire corroboration
 *  independently. */
interface ParityFire {
  ruleUid: string;
  authoritative: boolean;
  evidence: InspectorFire['evidence'];
  requestId?: string;
  tier: FireDotTier;
  verdict: ModEvidenceVerdict;
}

/** One claimed header mod judged against the captured sets. */
interface ParityModEvidence {
  ruleUid: string;
  direction: 'request' | 'response';
  operation: string;
  headerName: string;
  verdict: ModEvidenceVerdict;
  reason: ModEvidenceReason;
  observed?: readonly string[];
}

/** Header names a fire-evidence capture cares about — the playground's
 *  marker vocabulary plus the auth header its gate keys on. Everything
 *  else is omitted to keep artifacts readable. */
const MARKER_HEADER_NAMES = new Set(['authorization', 'x-forwarded-for', 'vary', 'content-language']);

function isMarkerHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKER_HEADER_NAMES.has(lower) || lower.startsWith('x-oh-');
}

export interface ParityFireFields {
  _fires?: ParityFire[];
  _rowFireTier?: FireDotTier | null;
  _modEvidence?: ParityModEvidence[];
  /** Capture point per direction as the verdicts read it (producer stamp,
   *  or the lifecycle stand-in on the request side). Null when nothing is
   *  held for the direction. */
  _headerCapture?: { request: 'effective' | 'raw' | null; response: 'effective' | 'raw' | null };
  /** Marker-named headers from the same sets the verdicts judged. */
  _markerHeaders?: {
    request: Array<{ name: string; value: string }>;
    response: Array<{ name: string; value: string }>;
  };
}

/**
 * Fire-evidence fields for one row. Pure — same inputs as the dot/badge
 * derivations (`fireTier` / `deriveFireEvidence` / `capturedHeaderSet`),
 * so the capture artifact can never disagree with what the panel renders.
 */
export function parityFireFields(lifecycle: RequestLifecycle, fires: readonly InspectorFire[]): ParityFireFields {
  const request = capturedHeaderSet(lifecycle, 'request');
  const response = capturedHeaderSet(lifecycle, 'response');
  const fields: ParityFireFields = {
    _headerCapture: { request: request?.capture ?? null, response: response?.capture ?? null },
    _markerHeaders: {
      request: (request?.headers ?? []).filter((h) => isMarkerHeader(h.name)),
      response: (response?.headers ?? []).filter((h) => isMarkerHeader(h.name)),
    },
  };
  if (fires.length === 0) return fields;

  const parityFires: ParityFire[] = [];
  const modEvidence: ParityModEvidence[] = [];
  for (const fire of fires) {
    const evidence = deriveFireEvidence(lifecycle, fire);
    parityFires.push({
      ruleUid: fire.ruleUid,
      authoritative: fire.authoritative,
      evidence: fire.evidence,
      ...(fire.requestId !== undefined ? { requestId: fire.requestId } : {}),
      tier: fireTier(lifecycle, fire),
      verdict: evidence.verdict,
    });
    for (const m of evidence.mods) {
      modEvidence.push({
        ruleUid: fire.ruleUid,
        direction: m.mod.direction,
        operation: m.mod.operation,
        headerName: m.mod.headerName,
        verdict: m.verdict,
        reason: m.reason,
        ...(m.observed !== undefined ? { observed: m.observed } : {}),
      });
    }
  }
  fields._fires = parityFires;
  fields._rowFireTier = rowFireTier(lifecycle, fires);
  fields._modEvidence = modEvidence;
  return fields;
}

interface ParityRowDebug extends ParityRow, ParityFireFields {
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
  /** The current hop's timing block — exactly what the Timing tab's ladder
   *  derives from (Slice J probe), plus the open-download flag that drives
   *  the not-finished caution. */
  _timings?: InspectorHarEntry['timings'] | null;
  _responseBodyIncomplete?: boolean;
}

/** Top-level navigation document — the rows the footer leg keys off. */
function isDocumentLike(resourceType: string | undefined): boolean {
  return resourceType === 'main_frame' || resourceType === 'document';
}

function toParityRow(rowWithFires: InspectorRowWithFires, arrivalIndex: number): ParityRow {
  const lc = rowWithFires.lifecycle;
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
    ...parityFireFields(lc, rowWithFires.fires),
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
  row._timings = har?.timings ?? null;
  if (har?.response?._responseBodyIncomplete === true) row._responseBodyIncomplete = true;
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
  rows: readonly InspectorRowWithFires[],
  footer: ParityFooter,
  clear: () => void,
): void {
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const footerRef = useRef(footer);
  footerRef.current = footer;
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    window.__OH_DUMP_PARITY_ROWS__ = () => rowsRef.current.map((row, i) => toParityRow(row, i));
    window.__OH_DUMP_PARITY_FOOTER__ = () => footerRef.current;
    window.__OH_CLEAR_PARITY__ = () => clearRef.current();
    return () => {
      delete window.__OH_DUMP_PARITY_ROWS__;
      delete window.__OH_DUMP_PARITY_FOOTER__;
      delete window.__OH_CLEAR_PARITY__;
    };
  }, []);
}
