/**
 * Debug hook for network-panel parity diffing.
 *
 * Exposes `window.__OH_DUMP_PARITY_ROWS__()` returning a JSON-serializable
 * row list shaped to be diffed against the playground capture script's
 * Chrome ground-truth rows (see playground/scripts/capture-parity.mjs).
 */

import { useEffect, useRef } from 'react';
import { classifyRequestState, type RequestState } from './request-state';
import { isPendingRequest, type InspectorRequest } from './types';

interface ParityRow {
  displayId: number;
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
   *  Matches Chrome's Network panel convention. Use this for parity diffs
   *  against Chrome's panel view. */
  displayStatus: number | null;
  statusText: string | null;
  errorCode: string | null;
  errorReason: string | null;
  pending: boolean;
  state: RequestState;
  resourceType: string | null;
}

interface ParityRowDebug extends ParityRow {
  _chromeRequestId?: string;
  _harResponseStatus?: number;
  _harResponseError?: string;
  _hasErrorField?: boolean;
}

function toParityRow(entry: InspectorRequest): ParityRow {
  const state = classifyRequestState(entry);
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
  const row: ParityRowDebug = {
    displayId: entry.displayId,
    arrivalIndex: entry.arrivalIndex,
    method: entry.method,
    url: entry.url,
    status: entry.statusCode ?? null,
    displayStatus,
    statusText: entry.statusText ?? null,
    errorCode: entry.error?.code ?? null,
    errorReason: entry.error?.reason ?? null,
    pending: isPendingRequest(entry),
    state,
    resourceType: entry.resourceType ?? null,
  };
  if (
    entry.url.includes('/net/slow/3000') ||
    entry.url.includes('/net/redirect') ||
    entry.url.includes('/echo/') ||
    entry.url.includes('/net/status/')
  ) {
    row._chromeRequestId = entry.chromeRequestId;
    row._harResponseStatus = entry.harEntry?.response?.status;
    row._harResponseError = entry.harEntry?.response?._error;
    row._hasErrorField = entry.error != null;
  }
  return row;
}

declare global {
  interface Window {
    __OH_DUMP_PARITY_ROWS__?: () => ParityRow[];
    __OH_CLEAR_PARITY__?: () => void;
  }
}

export function useParityDebugHook(
  entries: readonly InspectorRequest[],
  clear: () => void,
): void {
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    window.__OH_DUMP_PARITY_ROWS__ = () => entriesRef.current.map(toParityRow);
    window.__OH_CLEAR_PARITY__ = () => clearRef.current();
    return () => {
      delete window.__OH_DUMP_PARITY_ROWS__;
      delete window.__OH_CLEAR_PARITY__;
    };
  }, []);
}
