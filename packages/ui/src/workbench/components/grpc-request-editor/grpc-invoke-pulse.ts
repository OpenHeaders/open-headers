/**
 * The gRPC result pane's send-pulse drive: a unary invoke is in flight
 * until its snapshot lands; a streaming invoke rests on the STREAMING
 * badge's info tint from the moment the stream begins — a stream is a
 * session, and a looping sweep across a long one would only distract
 * — an upstream message sent on it is flight that keeps its landing
 * (one sweep, no line), and the settled call lands on the status
 * pill's tone. A failed After response assertion paints the landing
 * error (the HTTP pane's rule).
 */

import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import type { PillTone } from '../request-editor/response/response-status';
import type { SendPulseDrive } from '../request-editor/response/send-pulse';
import { grpcStatusTone } from './grpc-status-tone';
import type { LiveGrpcStream } from './useLiveGrpcStream';

export function grpcInvokeTone(snapshot: ExecutedGrpcSnapshot): PillTone {
  const assertions = snapshot.scripts?.afterResponse?.assertions ?? [];
  if (assertions.some((a) => !a.passed)) return 'error';
  return grpcStatusTone({
    status: snapshot.grpcStatus,
    ...(snapshot.stopped !== undefined ? { stopped: snapshot.stopped } : {}),
    ...(snapshot.error !== null ? { error: snapshot.error } : {}),
    ...(snapshot.localStatus !== undefined ? { localStatus: snapshot.localStatus } : {}),
    ...(snapshot.connectionError !== undefined ? { connectionError: snapshot.connectionError } : {}),
  });
}

export function grpcInvokePulse(invoke: {
  invoking: boolean;
  response: ExecutedGrpcSnapshot | null;
  responseShape: 'unary' | 'stream';
  live: LiveGrpcStream | null;
  /** An upstream message rider is out on the open stream. */
  sending: boolean;
}): SendPulseDrive {
  if (invoke.response !== null) return { inflight: false, landing: grpcInvokeTone(invoke.response) };
  if (!invoke.invoking) return { inflight: false, landing: null };
  if (invoke.responseShape === 'stream' && invoke.live !== null) return { inflight: invoke.sending, landing: 'info' };
  return { inflight: true, landing: null };
}
