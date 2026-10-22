/**
 * The gRPC status pill's vocabulary — the display status the result
 * panes and the examples show (a caller-stopped call whose reply
 * carried no status reads as 1 CANCELLED, a local failure its
 * canonical code; the capture keeps its honest null) and the tone it
 * paints: OK on success, every server status on error, a local
 * failure or a connection lost after the head on error, the user's
 * own Stop neutral (nothing the server said), no status neutral.
 */

import type { PillTone } from '../request-editor/response/response-status';

export interface GrpcStatusFacts {
  /** Wire status; null when the reply carried none. */
  status: number | null;
  /** Cancelled mid-stream by the caller. */
  stopped?: boolean;
  /** The classified LOCAL failure — the call never produced a head. */
  error?: string;
  /** The failure's client-runtime canonical status, beside `error`. */
  localStatus?: number;
  /** The connection died AFTER the head. */
  connectionError?: string;
}

export function grpcDisplayStatus(facts: GrpcStatusFacts): number | null {
  return facts.status ?? facts.localStatus ?? (facts.stopped === true ? 1 : null);
}

export function grpcStatusTone(facts: GrpcStatusFacts): PillTone {
  const display = grpcDisplayStatus(facts);
  if (display === null) return facts.error !== undefined || facts.connectionError !== undefined ? 'error' : 'neutral';
  if (display === 0) return 'success';
  // The caller's own cancel: a Stop after the head, or the local
  // 1 CANCELLED the client runtime assigns to a Stop before it.
  if (facts.status === null && (facts.stopped === true || facts.localStatus === 1)) return 'neutral';
  return 'error';
}
