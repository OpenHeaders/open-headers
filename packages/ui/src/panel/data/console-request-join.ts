/**
 * Console↔network join — project a request-lifecycle row into the slice a
 * browser console entry renders: method + full URL (the browser's console
 * shows `POST https://… net::ERR_BLOCKED_BY_CLIENT`, not the raw "Failed to
 * load resource" text) and the request's initiator stack (the expandable
 * "who fired this request" ladder, which lives on the request, not on the
 * log entry itself).
 *
 * The join key is exact: a browser network entry carries the same
 * session-namespaced `requestId` the lifecycle rows are keyed by, so there
 * is no heuristic here — only a projection. Pure; the lookup lives with the
 * caller (the panel root owns the row map).
 */

import type { ConsoleStackFrame } from '@openheaders/core/console-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry } from './inspector-row-projection';

export interface ConsoleRequestJoin {
  readonly method: string;
  readonly url: string;
  /** The request's initiator stack, flattened across async parent chains. */
  readonly stack?: readonly ConsoleStackFrame[];
}

export function consoleRequestJoin(lifecycle: RequestLifecycle): ConsoleRequestJoin {
  const stack = initiatorStackFrames(currentHarEntry(lifecycle)?._initiator);
  return {
    method: lifecycle.method,
    url: lifecycle.url,
    ...(stack !== undefined ? { stack } : {}),
  };
}

/** HAR `_initiator.stack` shape (structurally open — read defensively). */
interface RawHarStack {
  readonly callFrames?: ReadonlyArray<{
    readonly functionName?: string;
    readonly url?: string;
    readonly lineNumber?: number;
    readonly columnNumber?: number;
  }>;
  readonly parent?: RawHarStack;
}

/**
 * Flatten the `_initiator` stack (async parent chains included, in order)
 * into {@link ConsoleStackFrame}s. Frames without a url (native/internal)
 * are dropped, mirroring the engine-side stack normalization.
 */
function initiatorStackFrames(initiator: unknown): readonly ConsoleStackFrame[] | undefined {
  if (!initiator || typeof initiator !== 'object') return undefined;
  const frames: ConsoleStackFrame[] = [];
  let stack = (initiator as { stack?: unknown }).stack as RawHarStack | undefined;
  for (; stack !== undefined && typeof stack === 'object'; stack = stack.parent) {
    for (const f of stack.callFrames ?? []) {
      if (typeof f?.url !== 'string' || f.url.length === 0) continue;
      frames.push({
        functionName: typeof f.functionName === 'string' ? f.functionName : '',
        url: f.url,
        lineNumber: typeof f.lineNumber === 'number' ? f.lineNumber : 0,
        columnNumber: typeof f.columnNumber === 'number' ? f.columnNumber : 0,
      });
    }
  }
  return frames.length > 0 ? frames : undefined;
}
