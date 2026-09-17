/**
 * The request route's host seam — what a host that answers the
 * workbench HTTP send (`executeRequest`, and `executeGraphqlRequest`
 * compiled into it) contributes to the ONE host-neutral route in
 * `route.ts`: where the send's socket opens, whether its scripts run,
 * and where the live frames go. The route owns everything else — the
 * entity load, the pin rules, the script-capability gate, the
 * interactive-vs-step runner, the mode stamp, the result discipline —
 * so the node hosts (the daemon, the desktop app through the same
 * spine) and the web tab answer the channel through one code path,
 * the session routes' twin.
 *
 * The transport is the host's for a frame naming no place and the
 * delegating one toward the named backend otherwise (the Execution
 * Place plan: the context resolves, the place opens the socket); the
 * web tab has exactly one place by construction and hands the
 * delegating transport toward its serving daemon for every send. The
 * delegating transport carries `executedOn` itself, so the route
 * stamps nothing.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import type { RequestTransport } from '../request-exec/transport';
import type { ResolvedScriptRunner } from '../script-host/capability';

export interface RequestRouteHost {
  /**
   * The request transport for one send — the frame's place (an
   * explicit backend id, or none) and the gate's subject (the
   * workspace the send reads under; the delegating transport's jar
   * and opt-in audit key off it).
   */
  transportFor(placeBackendId: string | undefined, workspaceId: string): RequestTransport;
  /**
   * The send's script capability — the pre-request / post-response
   * chain runs through it; a peer-forwarded send (`forwarded`) runs
   * Safe or not at all. Absent = every send runs scriptless. Asked
   * only when the request's ancestor chain carries a script.
   */
  resolveScriptRunner?(input: { workspaceId: string; forwarded: boolean }): Promise<ResolvedScriptRunner | null>;
  /** The live-frame sink — the host's `requestStreamEvent` broadcast. */
  emitStreamEvent(event: RequestStreamEventWire): void;
}
