/**
 * Transport connection — the WebSocket lifecycle state machine.
 *
 * One instance owns exactly one logical connection to the backend: the
 * reachability probe, the socket, the keep-alive ping, exponential
 * reconnect backoff, and the protocol-incompatibility latch. It is the
 * single authority over "is there a socket, and should there be one" —
 * callers express *intent* (`ensureConnected` / `reconnect`) and the
 * machine coalesces concurrent requests down to one live socket.
 *
 * States
 *
 *   idle ──ensureConnected──▶ probing ──reachable──▶ opening ──open──▶ open
 *    ▲                          │ unreachable          │ fail          │ close
 *    │                          ▼                      ▼               ▼
 *    └──────────────────────── backoff ◀───────────────┴───────────────┘
 *
 * Cancellation. Each probe→open run is a {@link ConnectAttempt}; the
 * machine holds exactly one `currentAttempt`. `reconnect()` supersedes
 * it (marks it cancelled, tears the socket down); the attempt's async
 * callbacks observe the cancellation and abandon quietly. An orphan
 * socket racing the live one is therefore *structurally* impossible —
 * not guarded against after the fact. This is the fix for the
 * double-socket race where a `backend.mode` change opened two sockets
 * and the loser's failed HELLO wedged the shared handshake FSM.
 */

import { PROTOCOL_INCOMPATIBLE_CLOSE_CODE } from '@openheaders/core/protocol';
import { logger } from '@utils/logger';

const SCOPE = 'Transport';

/** Budget between socket construction and the `open` event. */
export const CONNECT_TIMEOUT_MS = 3000;

export type TransportState = 'idle' | 'probing' | 'opening' | 'open' | 'backoff';

/** Reported to {@link TransportConnectionDeps.onClose} on every socket close. */
export interface TransportCloseInfo {
  /** True when the socket had reached `open` before closing. */
  readonly wasOpen: boolean;
  /** True when the peer rejected this build's protocol version. */
  readonly protocolIncompatible: boolean;
  readonly code?: number;
  readonly reason?: string;
}

export interface TransportConnectionDeps {
  /** The `ws://` URL to connect to, or null when settings reject it. */
  readonly getUrl: () => string | null;
  /** Whether a connection is wanted at all (autoConnect on, mode ≠ in-browser). */
  readonly shouldConnect: () => boolean;
  /** Base reconnect backoff; doubled per attempt, capped by the max. */
  readonly getReconnectDelayMs: () => number;
  readonly getMaxReconnectDelayMs: () => number;
  /** Keep-alive ping cadence; ≤ 0 disables the ping. */
  readonly getPingIntervalMs: () => number;
  /** Best-effort reachability probe against the host before opening a socket. */
  readonly probeReachable: (url: string) => Promise<boolean>;
  /** Construct the socket — the seam for Safari URL adaptation + test fakes. */
  readonly createSocket: (url: string) => WebSocket;
  /** Fired once a socket reaches `open`. */
  readonly onOpen: () => void;
  /** Fired on every socket close (regardless of prior state). */
  readonly onClose: (info: TransportCloseInfo) => void;
  /** Fired for each inbound socket message. */
  readonly onMessage: (data: string) => void;
  /** Fired on every state transition — drives status reporting. */
  readonly onStateChange?: (state: TransportState) => void;
  /** Test seam — swap setTimeout / clearTimeout for fake timers. */
  readonly setTimer?: (fn: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

export interface TransportConnection {
  state(): TransportState;
  isConnected(): boolean;
  isConnecting(): boolean;
  reconnectAttempts(): number;
  /**
   * Open a connection if one is wanted and not already live / in
   * flight. Coalesced — a no-op while `probing` / `opening` / `open`;
   * from `backoff` it fast-forwards the pending retry.
   */
  ensureConnected(): void;
  /**
   * Tear down any current socket + in-flight attempt, clear the
   * protocol-incompatibility latch, and start a fresh connection if one
   * is still wanted. Used when `backend.url` / `mode` / `authToken` /
   * `autoConnect` changes at runtime.
   */
  reconnect(): void;
  /** Send a frame. Returns false when there is no open socket. */
  send(data: Record<string, unknown>): boolean;
  /** Restart the ping timer with the current cadence (after a settings change). */
  restartPing(): void;
}

/**
 * One probe→open run. The machine holds exactly one as `currentAttempt`;
 * superseding it flips `cancelled`, after which the attempt's async
 * callbacks abandon without touching machine state.
 */
interface ConnectAttempt {
  cancelled: boolean;
}

export function createTransportConnection(deps: TransportConnectionDeps): TransportConnection {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let state: TransportState = 'idle';
  let socket: WebSocket | null = null;
  let currentAttempt: ConnectAttempt | null = null;
  let reconnectTimer: unknown = null;
  let connectTimeoutTimer: unknown = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectAttempts = 0;
  // Latched when the peer rejects this build's protocol version.
  // Suppresses every retry until `reconnect()` clears it (a url / mode
  // change, or an extension restart).
  let protocolIncompatible = false;

  function setState(next: TransportState): void {
    if (state === next) return;
    logger.debug(SCOPE, `${state} → ${next}`);
    state = next;
    deps.onStateChange?.(next);
  }

  function clearReconnectTimer(): void {
    if (reconnectTimer !== null) {
      clearTimer(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function clearConnectTimeout(): void {
    if (connectTimeoutTimer !== null) {
      clearTimer(connectTimeoutTimer);
      connectTimeoutTimer = null;
    }
  }

  function clearPing(): void {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  function startPing(): void {
    clearPing();
    const interval = deps.getPingIntervalMs();
    if (interval <= 0) return;
    // A periodic application-level ping keeps strict corporate proxies
    // from silently culling an idle socket, and a failed `send` is a
    // fast-fail signal that the pipe is already gone — close it and let
    // `onclose` drive the reconnect.
    pingTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      try {
        socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      } catch (err) {
        logger.debug(SCOPE, 'ping failed, treating as disconnect:', (err as Error).message);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }, interval);
  }

  /** Drop the live socket + in-flight attempt without changing intent. */
  function teardownSocket(): void {
    if (currentAttempt) currentAttempt.cancelled = true;
    currentAttempt = null;
    clearConnectTimeout();
    clearPing();
    if (socket) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      socket = null;
    }
  }

  function scheduleBackoff(): void {
    clearReconnectTimer();
    if (!deps.shouldConnect() || protocolIncompatible) {
      setState('idle');
      return;
    }
    reconnectAttempts++;
    const delay = Math.min(deps.getReconnectDelayMs() * 2 ** (reconnectAttempts - 1), deps.getMaxReconnectDelayMs());
    logger.debug(SCOPE, `reconnect attempt ${reconnectAttempts} in ${delay}ms`);
    setState('backoff');
    reconnectTimer = setTimer(() => {
      reconnectTimer = null;
      beginAttempt();
    }, delay);
  }

  function beginAttempt(): void {
    // Coalesce — a live socket or an attempt already covers this.
    if (state === 'probing' || state === 'opening' || state === 'open') return;
    clearReconnectTimer();
    if (protocolIncompatible || !deps.shouldConnect()) {
      setState('idle');
      return;
    }
    const url = deps.getUrl();
    if (!url) {
      logger.debug(SCOPE, 'no usable backend URL — staying idle');
      setState('idle');
      return;
    }
    const attempt: ConnectAttempt = { cancelled: false };
    currentAttempt = attempt;
    setState('probing');
    deps
      .probeReachable(url)
      .then((reachable) => {
        if (attempt.cancelled) return;
        if (!reachable) {
          logger.debug(SCOPE, 'server not reachable — backing off');
          scheduleBackoff();
          return;
        }
        openSocket(url, attempt);
      })
      .catch((err: unknown) => {
        if (attempt.cancelled) return;
        logger.debug(SCOPE, 'reachability probe threw — backing off', err);
        scheduleBackoff();
      });
  }

  function openSocket(url: string, attempt: ConnectAttempt): void {
    setState('opening');
    let ws: WebSocket;
    try {
      ws = deps.createSocket(url);
    } catch (err) {
      logger.debug(SCOPE, 'socket construction failed — backing off', err);
      scheduleBackoff();
      return;
    }
    socket = ws;

    connectTimeoutTimer = setTimer(() => {
      connectTimeoutTimer = null;
      if (attempt.cancelled) return;
      // `open` never arrived — close the dead socket and let its
      // `onclose` (this same, non-cancelled attempt) drive the backoff.
      logger.debug(SCOPE, 'connection timed out before open');
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      clearConnectTimeout();
      if (attempt.cancelled) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      logger.info(SCOPE, 'connected');
      reconnectAttempts = 0;
      startPing();
      setState('open');
      deps.onOpen();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (attempt.cancelled) return;
      deps.onMessage(event.data as string);
    };

    ws.onerror = () => {
      // `onclose` always follows; just stop the connect-timeout clock.
      clearConnectTimeout();
    };

    ws.onclose = (event?: CloseEvent) => {
      clearConnectTimeout();
      if (attempt.cancelled) return;
      const incompatible = event?.code === PROTOCOL_INCOMPATIBLE_CLOSE_CODE;
      const wasOpen = state === 'open';
      clearPing();
      if (socket === ws) socket = null;
      currentAttempt = null;
      if (incompatible) {
        logger.warn(SCOPE, `peer rejected protocol: ${event?.reason || 'no reason'}`);
        protocolIncompatible = true;
        reconnectAttempts = 0;
        clearReconnectTimer();
        setState('idle');
      }
      deps.onClose({ wasOpen, protocolIncompatible: incompatible, code: event?.code, reason: event?.reason });
      if (!incompatible) scheduleBackoff();
    };
  }

  return {
    state: () => state,
    isConnected: () => state === 'open',
    isConnecting: () => state === 'probing' || state === 'opening',
    reconnectAttempts: () => reconnectAttempts,
    ensureConnected: () => {
      beginAttempt();
    },
    reconnect: () => {
      protocolIncompatible = false;
      teardownSocket();
      clearReconnectTimer();
      reconnectAttempts = 0;
      setState('idle');
      beginAttempt();
    },
    send: (data) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(data));
          return true;
        } catch (err) {
          logger.error(SCOPE, 'send failed:', err);
          return false;
        }
      }
      return false;
    },
    restartPing: () => {
      if (state === 'open') startPing();
    },
  };
}
