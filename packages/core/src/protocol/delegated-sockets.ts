/**
 * The DELEGATED socket family — the session kinds' half of the
 * Execution Place plan's second channel family (`delegated-requests`
 * is the HTTP half). A session's EXECUTOR stays in the context (the
 * surface the user sits at: it resolves the handshake and every
 * rider's text, runs the session's scripts, keeps the timeline and
 * builds the snapshot); only the SOCKET lives on the place. The place
 * opens the transport seam's socket with the resolved dial — the
 * WebSocket handshake or the MQTT byte stream — and relays the raw
 * events back; the context writes into it through riders keyed by the
 * caller-minted socket id. Nothing is resolved at the place. Additive
 * to the wire — the protocol integer stays where it is.
 *
 * Names and the plain event / rider shapes live here (host-agnostic,
 * JSON-safe); the two OPEN frames embed the seams' own request shapes
 * and live beside them in `@openheaders/oracle`
 * (`live/delegated-socket/wire`).
 */

/** Open a WebSocket on the place with the resolved handshake. */
export const DELEGATE_WS_OPEN_CHANNEL = 'delegateWsOpen';
/** Write one message into an open delegated WebSocket. */
export const DELEGATE_WS_SEND_CHANNEL = 'delegateWsSend';
/** Start the Close handshake on an open delegated WebSocket. */
export const DELEGATE_WS_CLOSE_CHANNEL = 'delegateWsClose';
/** Open an MQTT byte stream on the place with the resolved dial. */
export const DELEGATE_MQTT_OPEN_CHANNEL = 'delegateMqttOpen';
/** Write wire bytes into an open delegated MQTT stream. */
export const DELEGATE_MQTT_WRITE_CHANNEL = 'delegateMqttWrite';
/** End an open delegated MQTT stream after pending writes flush. */
export const DELEGATE_MQTT_END_CHANNEL = 'delegateMqttEnd';
/** Tear a delegated socket down at any point — the context's Stop. */
export const DELEGATE_SOCKET_ABORT_CHANNEL = 'delegateSocketAbort';
/** The frame type the place fans a delegated socket's events on. */
export const DELEGATED_SOCKET_EVENT_FRAME = 'delegatedSocketEvent';

export const DELEGATED_SOCKET_RIDER_CHANNELS = [
  DELEGATE_WS_SEND_CHANNEL,
  DELEGATE_WS_CLOSE_CHANNEL,
  DELEGATE_MQTT_WRITE_CHANNEL,
  DELEGATE_MQTT_END_CHANNEL,
  DELEGATE_SOCKET_ABORT_CHANNEL,
] as const;

/** The riders the context writes into an open delegated socket —
 *  authorized by the caller-minted socket id, owned by the opener. */
export type DelegatedSocketRider =
  | { type: typeof DELEGATE_WS_SEND_CHANNEL; socketId: string; text: string }
  | { type: typeof DELEGATE_WS_SEND_CHANNEL; socketId: string; binaryBase64: string }
  | { type: typeof DELEGATE_WS_CLOSE_CHANNEL; socketId: string; code: number; reason: string }
  | { type: typeof DELEGATE_MQTT_WRITE_CHANNEL; socketId: string; bytesBase64: string }
  | { type: typeof DELEGATE_MQTT_END_CHANNEL; socketId: string }
  | { type: typeof DELEGATE_SOCKET_ABORT_CHANNEL; socketId: string };

/** The answer to an OPEN frame — the socket is registered on the
 *  place (its events follow), or the place refused before dialing. */
export type DelegatedSocketOpenResult =
  | { success: true; executedOn: { kind: 'backend'; name: string } }
  | { success: false; error: string; executedOn: { kind: 'backend'; name: string } };

/** A proxy route the place's transport decided — the seams' own shape. */
export interface DelegatedSocketProxyRoute {
  plane: 'request' | 'system';
  proxyUrl?: string;
  source?: 'env' | 'system' | 'manual' | 'pac';
  standDownReason?: 'unix-socket' | 'resolve-to-address';
}

/** A trust remedy the place's transport classified — the seams' own shape. */
export interface DelegatedSocketTrustHint {
  kind: 'trust-certificate';
  host: string;
  port: number;
  servername?: string;
  code: string;
  certificate?: boolean;
  netError?: string;
}

/**
 * One event of a delegated socket, as the place fans it to the
 * opener's peers — the seams' callbacks, plain: a WebSocket's
 * `open` / `message` / `close`, an MQTT stream's `connect` / `data`,
 * and `end` EXACTLY once on every path (with the classified pre-open
 * failure when the socket never opened). `seq` is per-socket
 * monotonic.
 */
export type DelegatedSocketEvent =
  | {
      socketId: string;
      seq: number;
      kind: 'open';
      protocol: string;
      extensions: string;
      proxyRoute?: DelegatedSocketProxyRoute;
    }
  | { socketId: string; seq: number; kind: 'message'; dataBase64: string; binary: boolean }
  | { socketId: string; seq: number; kind: 'close'; code: number; reason: string; wasClean: boolean }
  | { socketId: string; seq: number; kind: 'connect'; proxyRoute?: DelegatedSocketProxyRoute }
  | { socketId: string; seq: number; kind: 'data'; dataBase64: string }
  | { socketId: string; seq: number; kind: 'end'; error?: { message: string; hint?: DelegatedSocketTrustHint } };
