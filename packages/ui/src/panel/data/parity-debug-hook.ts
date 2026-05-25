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
  status: number | null;
  statusText: string | null;
  errorCode: string | null;
  errorReason: string | null;
  pending: boolean;
  state: RequestState;
  resourceType: string | null;
}

function toParityRow(entry: InspectorRequest): ParityRow {
  return {
    displayId: entry.displayId,
    arrivalIndex: entry.arrivalIndex,
    method: entry.method,
    url: entry.url,
    status: entry.statusCode ?? null,
    statusText: entry.statusText ?? null,
    errorCode: entry.error?.code ?? null,
    errorReason: entry.error?.reason ?? null,
    pending: isPendingRequest(entry),
    state: classifyRequestState(entry),
    resourceType: entry.resourceType ?? null,
  };
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
