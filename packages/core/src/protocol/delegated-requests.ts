/**
 * The DELEGATED request family — channel names (the Execution Place
 * plan, "Execution context and reach"). A delegated send is the other
 * family beside the context sends (`executeRequest` and its siblings,
 * where the answering host resolves against ITS workspace): the
 * sending surface resolves everything it holds and hands the answering
 * host a fully resolved wire request; the host opens the socket and
 * streams the raw response back, stamping `executedOn`. Nothing is
 * resolved at the place. Additive to the wire — the protocol integer
 * stays where it is.
 *
 * Names only live here (the vocabulary is host-agnostic); the frame
 * shapes derive from the request transport seams and live beside them
 * in `@openheaders/oracle` (`live/request-exec/delegated-wire` for the
 * HTTP exchange, `live/grpc-exec/delegated-wire` for the gRPC one).
 */

/** Delegate one resolved HTTP exchange; the caller-minted `sendId`
 *  tags the live `requestStreamEvent` frames and is the
 *  `abortRequestSend` handle — the same registry as a context send. */
export const DELEGATE_REQUEST_CHANNEL = 'delegateRequest';

/** Delegate one resolved UNARY gRPC call — the message encoded by the
 *  context against the spec it holds, the place opening the HTTP/2
 *  session and answering the raw framed reply. The caller-minted
 *  `sendId` is the `abortRequestSend` handle, the HTTP exchange's law;
 *  unary emits no live frames (the answer carries the whole reply).
 *  The streaming shapes ride the socket half (`delegateGrpcOpen`). */
export const DELEGATE_GRPC_INVOKE_CHANNEL = 'delegateGrpcInvoke';

/** Refusal for a delegated frame that names no workspace — the gate
 *  needs one (the opt-in audit and the per-workspace capability). */
export const DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE = 'A delegated send must name its workspace.';
