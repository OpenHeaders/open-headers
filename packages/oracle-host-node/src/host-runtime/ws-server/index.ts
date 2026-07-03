/**
 * WebSocket server for host-side oracle access — the "extension-as-client
 * of desktop / daemon" pipe (`docs/refactor-status.md` Desktop host #2
 * Stage 2 commit 9; `.notes/oracle-arc.md` Mode 2 / Mode 3).
 *
 * Lives in `@openheaders/oracle-host-node/host-runtime` rather than
 * apps/desktop so any Node host can reuse it — Electron main today, a headless Node
 * daemon tomorrow, the cloud daemon eventually. The Electron-specific
 * glue is just composition (where to listen + how to fan
 * `OracleHostHooks.broadcast*` to both renderers and connected WS
 * clients) and lives in `apps/desktop/src/main/`.
 *
 * Wire shape:
 *
 *   - **Handshake.** First message from each peer is `oh.sync.hello`
 *     carrying `{ protocolVersion, role, nodeId, workspaceId, agent }`.
 *     The server validates against the compatibility band and replies
 *     `oh.sync.welcome` (accept | reject). A successful HELLO produces
 *     a `PeerConnection` bound to this socket; rejected peers
 *     get a `PROTOCOL_INCOMPATIBLE_CLOSE_CODE` (4001) close so the
 *     client surfaces "update extension" instead of generic
 *     disconnect noise.
 *   - **State-vector catch-up.** After WELCOME, the peer sends
 *     `oh.sync.stateVector`; the server streams a SNAPSHOT (cold
 *     receiver) and/or a delta of `oh.sync.mutation` frames against
 *     the peer's vector, terminated by `oh.sync.synced`. See
 *     `handleStateVector` in `./connection`.
 *   - **Keep-alive.** The peer sends `{ type: 'ping', t: <ms> }` on
 *     `backend.pingIntervalMs`. The server replies with
 *     `{ type: 'pong', t: <ms> }` so half-dead sockets get cleaned up
 *     rather than accumulating until idle-timeout disconnects fire.
 *   - **Sync RPCs.** Anything else routes through `dispatchSyncRpc`
 *     (the same dispatcher the IPC handler uses). When the dispatcher
 *     recognizes the channel and returns a response, the server sends
 *     `{ type: '<rpc>:response', ...payload }` back over the same
 *     connection. Channels outside the 22 sync+awareness ones are
 *     silently ignored.
 *   - **Broadcasts.** `broadcast` / `broadcastFrame` fan
 *     an oracle event out to every connected peer past handshake. The
 *     host wires this into `OracleHostHooks.broadcastSyncEvent` /
 *     `broadcastAwareness` so renderers (over IPC) and remote peers
 *     (over WS) see the same stream.
 *
 * Reachability check: the extension does a `fetch(http://…)` with
 * `no-cors` before opening the WS. Any HTTP response satisfies it; we
 * let the `ws` package's default HTTP responder (HTTP 400 for non-
 * upgrade requests) cover that — no separate HTTP server needed.
 *
 * Bind address: defaults to `127.0.0.1` (localhost-only). LAN/tunneled
 * deployments override with `host: '0.0.0.0'`. Auth is mandatory on every
 * connection regardless of bind or remote address: loopback is reachable
 * cross-user on a shared box and TCP blocks OS peer-cred, so
 * trust-by-process isn't a sound floor. Every peer presents a paired
 * token at HELLO.
 */

export type {
  OracleWsServer,
  OracleWsServerOptions,
  PeerChangeEvent,
  PeerChangeKind,
  PeerChangeListener,
  PeerSummary,
} from './contract';
export { startOracleWsServer } from './server';
