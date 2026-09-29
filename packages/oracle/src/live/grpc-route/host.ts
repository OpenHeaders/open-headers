/**
 * The gRPC route's host seam — what a host that answers the workbench
 * gRPC Invoke (`executeGrpcRequest`) contributes to the ONE
 * host-neutral route in `route.ts`: where the call's HTTP/2 session
 * opens, whether its hooks run, how an OAuth 2.0 bundle renews, and
 * where the live frames go. The route owns everything else — the
 * entity and spec loads, the pin rules, the executor call, the
 * `executedOn` stamp, the result discipline — so the node hosts (the
 * daemon, the desktop app through the same spine) and the web tab
 * answer the channel through one code path, the session routes' twin.
 *
 * The transport is leased per call, the session routes' lease: the
 * host's own HTTP/2 stack when the frame names no place, the
 * delegating gRPC transport toward the named backend otherwise (the
 * Execution Place plan: the context resolves and encodes, the place
 * opens the session); the web tab has exactly one place by
 * construction and leases the delegating transport toward its serving
 * daemon for every call.
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import type { DelegatedGrpcWire } from '../grpc-exec/delegated-wire';
import { createDelegatingGrpcTransport } from '../grpc-exec/delegating-grpc-transport';
import type { GrpcTransport } from '../grpc-exec/transport';
import type { SessionScriptHost } from '../request-exec/script-hooks';
import type { RequestTransport } from '../request-exec/transport';
import type { SessionTransportLease } from '../session-route/host';

export interface GrpcRouteHost {
  /**
   * The gRPC transport for one call — the frame's place (an explicit
   * backend id, or none) and the gate's subject (the workspace the
   * call reads under).
   */
  transportFor(placeBackendId: string | undefined, workspaceId: string): SessionTransportLease<GrpcTransport>;
  /**
   * The call's script capability — the hooks run through it; a
   * peer-forwarded call (`forwarded`) runs Safe or not at all. Absent
   * = every call runs scriptless.
   */
  resolveScriptHost?(input: { workspaceId: string; forwarded: boolean }): Promise<SessionScriptHost | null>;
  /**
   * The request transport an expired OAuth 2.0 bundle renews through
   * before the invoke attaches it — the host's own HTTP leg, keyed by
   * the workspace the call reads under. Absent = the stored bundle
   * attaches as it is.
   */
  refreshTransportFor?(workspaceId: string): RequestTransport;
  /** The live-frame sink — the host's `grpcStreamEvent` broadcast. */
  emitStreamEvent(event: GrpcStreamEventWire): void;
}

/** A call whose HTTP/2 session opens on the place the wire reaches, the executor here. */
export function delegatedGrpcTransportLease(
  wire: DelegatedGrpcWire,
  workspaceId: string,
): SessionTransportLease<GrpcTransport> {
  const transport = createDelegatingGrpcTransport({ wire, workspaceId });
  return { transport, executedOn: () => transport.executedOn() };
}
