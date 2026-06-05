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
  if (
    lc.url.includes('/net/slow/3000') ||
    lc.url.includes('/net/redirect') ||
    lc.url.includes('/echo/') ||
    lc.url.includes('/net/status/')
  ) {
    row._requestId = lc.requestId;
    row._harResponseStatus = har?.response?.status;
    row._harResponseError = har?.response?._error;
    row._hasErrorField = lc.error != null;
  }
  return row;
}

declare global {
  interface Window {
    __OH_DUMP_PARITY_ROWS__?: () => ParityRow[];
    __OH_CLEAR_PARITY__?: () => void;
  }
}

export function useParityDebugHook(lifecycles: readonly RequestLifecycle[], clear: () => void): void {
  const lifecyclesRef = useRef(lifecycles);
  lifecyclesRef.current = lifecycles;
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    window.__OH_DUMP_PARITY_ROWS__ = () => lifecyclesRef.current.map((lc, i) => toParityRow(lc, i));
    window.__OH_CLEAR_PARITY__ = () => clearRef.current();
    return () => {
      delete window.__OH_DUMP_PARITY_ROWS__;
      delete window.__OH_CLEAR_PARITY__;
    };
  }, []);
}
