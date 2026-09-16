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
 * shapes derive from the request transport seam and live beside it in
 * `@openheaders/oracle` (`live/request-exec/delegated-wire`).
 */

/** Delegate one resolved HTTP exchange; the caller-minted `sendId`
 *  tags the live `requestStreamEvent` frames and is the
 *  `abortRequestSend` handle — the same registry as a context send. */
export const DELEGATE_REQUEST_CHANNEL = 'delegateRequest';

/** Refusal for a delegated frame that names no workspace — the gate
 *  needs one (the opt-in audit and the per-workspace capability). */
export const DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE = 'A delegated send must name its workspace.';
