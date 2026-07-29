/**
 * Stream the response body, retaining at most `maxBodyBytes` and aborting
 * the read once the upstream overflows the cap. This is the load-bearing
 * memory bound on the always-on main process: `response.text()` would
 * buffer the *entire* upstream body — a multi-gigabyte or chunked-unbounded
 * response from a misconfigured/hostile cadence target OOMs the shared
 * process before any post-read cap could apply. We accumulate at most the
 * cap plus one in-flight chunk, then `cancel()` the stream.
 */

import { materializeBody } from '@openheaders/oracle/live/request-exec/body-decode';
import type { Deadline, HopResponse } from './seam';

/** The streaming leg's slice of the capped read — per-chunk surfacing
 *  plus the merged deadline signal that classifies a read rejection
 *  (signal fired = aborted; anything else = mid-body failure). */
export interface CappedReadStreaming {
  onChunk(bytes: Uint8Array, totalBytes: number): void;
  deadline: Deadline;
}

export async function readCappedBody(
  response: HopResponse,
  maxBodyBytes: number,
  streaming?: CappedReadStreaming,
): Promise<{
  body: string;
  bodyEncoding?: 'base64';
  bodyBytes: number;
  bodyTruncated: boolean;
  endedEarly?: { reason: 'aborted' | 'error'; message?: string };
}> {
  const stream = response.body;
  if (!stream) {
    // No readable stream (empty body / HEAD) — nothing to bound.
    return { body: '', bodyBytes: 0, bodyTruncated: false };
  }
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  let endedEarly: { reason: 'aborted' | 'error'; message?: string } | undefined;
  try {
    while (true) {
      let result: Awaited<ReturnType<typeof reader.read>>;
      try {
        result = await reader.read();
      } catch (err) {
        // Buffered reads keep today's contract — the rejection
        // propagates (deadline expiry maps to the timeout error at the
        // caller). A streaming read materializes the partial instead:
        // an abort (Stop or deadline, told apart by the executor) and a
        // mid-body connection failure both settle with what arrived.
        if (streaming === undefined) throw err;
        const aborted = streaming.deadline?.signal.aborted === true;
        endedEarly = aborted
          ? { reason: 'aborted' }
          : { reason: 'error', message: err instanceof Error ? err.message : String(err) };
        break;
      }
      if (result.done) break;
      const value = result.value;
      if (!value || value.byteLength === 0) continue;
      const before = bytesRead;
      parts.push(value);
      bytesRead += value.byteLength;
      if (streaming !== undefined) {
        // Live chunks carry only cap-bounded bytes, so the tail never
        // shows bytes the materialized body won't keep.
        const allowed = Math.min(value.byteLength, Math.max(0, maxBodyBytes - before));
        if (allowed > 0) {
          streaming.onChunk(
            allowed === value.byteLength ? value : value.subarray(0, allowed),
            Math.min(bytesRead, maxBodyBytes),
          );
        }
      }
      if (bytesRead > maxBodyBytes) {
        truncated = true;
        try {
          await reader.cancel();
        } catch {
          // Upstream already failed — the retained bytes still stand.
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return {
    ...decodeCapped(parts, bytesRead, maxBodyBytes, truncated),
    ...(endedEarly !== undefined ? { endedEarly } : {}),
  };
}

/** Concatenate the retained chunks, cap to `maxBodyBytes`, and
 *  materialize losslessly: valid UTF-8 stays text, anything else goes
 *  base64 with the encoding marked. Shared cap arithmetic so the byte
 *  count + truncation flag stay consistent with what's materialized. */
function decodeCapped(
  parts: ReadonlyArray<Uint8Array>,
  bytesRead: number,
  maxBodyBytes: number,
  truncated: boolean,
): { body: string; bodyEncoding?: 'base64'; bodyBytes: number; bodyTruncated: boolean } {
  const retained = Math.min(bytesRead, maxBodyBytes);
  const buf = new Uint8Array(retained);
  let offset = 0;
  for (const part of parts) {
    if (offset >= retained) break;
    const take = Math.min(part.byteLength, retained - offset);
    buf.set(part.subarray(0, take), offset);
    offset += take;
  }
  return { ...materializeBody(buf, truncated), bodyBytes: retained, bodyTruncated: truncated };
}
