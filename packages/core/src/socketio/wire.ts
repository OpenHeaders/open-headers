/**
 * Socket.IO wire grammar — the hand-rolled engine.io v4 + socket.io v5
 * TEXT framing the WebSocket client's `socketio` flavor rides over the
 * platform socket (the S6 checkpoint: framing lives ABOVE the
 * protocol-blind transport seam, no socket.io runtime dep ever).
 *
 * Pure functions over strings, zero platform deps: the oracle session
 * plane drives the handshake with the encoders, and display surfaces
 * decode captured frames with the parser (the capture law binds the
 * SNAPSHOT to verbatim wire text — decode is display-side, and this
 * module is the single grammar both sides share).
 *
 * Scope is the websocket-only posture ratified for v1: EIO=4 direct
 * websocket dial (no long-polling fallback, no upgrade dance), text
 * frames only — binary attachments (BINARY_EVENT / BINARY_ACK) parse
 * to an honest header so the display can name them, but the client
 * never composes them.
 */

/** Engine.IO protocol revision the client dials with (`EIO=4`). */
export const ENGINE_IO_VERSION = 4;

/** The engine.io endpoint path the stock server mounts when the URL
 *  names none — a bare authority dials `/socket.io/`. */
export const SOCKET_IO_DEFAULT_PATH = '/socket.io/';

/** The client's answer to an engine.io ping — one frame, verbatim. */
export const ENGINE_IO_PONG_FRAME = '3';

/**
 * Socket.IO packet types (the digit following an engine.io `4` message
 * frame). CONNECT/EVENT/ACK are the client's working set; the rest
 * parse so captured frames always decode to an honest name.
 */
export const SOCKET_IO_PACKET_TYPES = {
  connect: 0,
  disconnect: 1,
  event: 2,
  ack: 3,
  connectError: 4,
  binaryEvent: 5,
  binaryAck: 6,
} as const;

/**
 * One decoded socket.io packet header. `dataJson` is the raw JSON text
 * following the header, VERBATIM — whether it parses (and what it
 * means) is the consumer's call, so the grammar never rewrites wire
 * truth.
 */
export interface SocketIoPacket {
  type: number;
  /** Namespace the packet addresses; `/` when the wire named none. */
  namespace: string;
  /** Ack correlation id; `null` when the packet carries none. */
  ackId: number | null;
  /** Raw JSON payload text after the header; `null` when absent. */
  dataJson: string | null;
  /** Binary attachment count (BINARY_EVENT / BINARY_ACK `-` prefix);
   *  0 everywhere else. */
  attachments: number;
}

/**
 * One decoded engine.io text frame. `unknown` keeps the raw text so a
 * malformed or future frame still renders honestly instead of
 * disappearing.
 */
export type EngineIoFrame =
  | { kind: 'open'; dataJson: string }
  | { kind: 'close' }
  | { kind: 'ping' }
  | { kind: 'pong' }
  | { kind: 'packet'; packet: SocketIoPacket }
  | { kind: 'upgrade' }
  | { kind: 'noop' }
  | { kind: 'unknown'; raw: string };

/**
 * Build the engine.io dial URL from the user's session URL: a URL with
 * no path dials the stock `/socket.io/` mount, a typed path IS the
 * engine.io path (trailing slash normalized — the server matches the
 * slash-terminated prefix), and `EIO` + `transport=websocket` join any
 * user query params already appended.
 */
export function buildEngineIoUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.pathname === '/') {
    parsed.pathname = SOCKET_IO_DEFAULT_PATH;
  } else if (!parsed.pathname.endsWith('/')) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  parsed.searchParams.append('EIO', String(ENGINE_IO_VERSION));
  parsed.searchParams.append('transport', 'websocket');
  return parsed.toString();
}

/**
 * Normalize a user-typed namespace to the wire form: empty means the
 * root `/`, and a missing leading slash gains one (`chat` → `/chat`).
 */
export function normalizeNamespace(namespace: string): string {
  const trimmed = namespace.trim();
  if (trimmed === '' || trimmed === '/') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** A namespace is wire-safe when it cannot collide with the packet
 *  grammar — the `,` terminator is the one reserved character. */
export function isValidNamespace(namespace: string): boolean {
  return !namespace.includes(',');
}

/** The non-root namespace segment of a packet header (`/nsp,`), empty
 *  for the root namespace. */
function namespaceSegment(namespace: string): string {
  const normalized = normalizeNamespace(namespace);
  return normalized === '/' ? '' : `${normalized},`;
}

/** Encode the socket.io CONNECT packet for a namespace — the frame the
 *  client sends once the engine.io open packet arrives. `authJson` is
 *  the optional auth payload object as JSON text (`{"token":…}`),
 *  appended verbatim after the header (socket.io v5's CONNECT data —
 *  in-band framing, so it works on every host). */
export function encodeConnectPacket(namespace: string, authJson?: string): string {
  return `4${SOCKET_IO_PACKET_TYPES.connect}${namespaceSegment(namespace)}${authJson ?? ''}`;
}

export type SocketIoEventEncodeResult = { ok: true; frame: string } | { ok: false; error: string };

/**
 * Encode one EVENT packet: `42[/nsp,][ackId]["name", ...args]`.
 * `argsJson` is the compose editor's arguments text — a JSON ARRAY
 * (empty composes no arguments); anything else reports an error so the
 * rider fails alone, never the session.
 */
export function encodeEventPacket(
  namespace: string,
  ackId: number | null,
  eventName: string,
  argsJson: string,
): SocketIoEventEncodeResult {
  if (eventName.trim() === '') return { ok: false, error: 'Event name is empty.' };
  let args: unknown[] = [];
  const trimmed = argsJson.trim();
  if (trimmed !== '') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, error: 'Arguments are not valid JSON.' };
    }
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'Arguments must be a JSON array — one element per argument.' };
    }
    args = parsed;
  }
  const payload = JSON.stringify([eventName, ...args]);
  const id = ackId !== null ? String(ackId) : '';
  return { ok: true, frame: `4${SOCKET_IO_PACKET_TYPES.event}${namespaceSegment(namespace)}${id}${payload}` };
}

/**
 * Decode one engine.io TEXT frame. Binary WebSocket frames (socket.io
 * attachment payloads) never reach this parser — callers gate on the
 * frame type and render those as the binary payloads they are.
 */
export function parseEngineIoFrame(text: string): EngineIoFrame {
  if (text === '') return { kind: 'unknown', raw: text };
  switch (text[0]) {
    case '0':
      return { kind: 'open', dataJson: text.slice(1) };
    case '1':
      return { kind: 'close' };
    case '2':
      return { kind: 'ping' };
    case '3':
      return { kind: 'pong' };
    case '4': {
      const packet = parseSocketIoPacket(text.slice(1));
      return packet !== null ? { kind: 'packet', packet } : { kind: 'unknown', raw: text };
    }
    case '5':
      return { kind: 'upgrade' };
    case '6':
      return { kind: 'noop' };
    default:
      return { kind: 'unknown', raw: text };
  }
}

/**
 * Decode a socket.io packet header (the text after the engine.io `4`):
 * type digit · optional `<attachments>-` (binary types) · optional
 * `/namespace,` · optional ack-id digits · the raw JSON payload.
 * Returns `null` when the header does not scan.
 */
export function parseSocketIoPacket(text: string): SocketIoPacket | null {
  if (text === '') return null;
  const type = text.charCodeAt(0) - 48;
  if (type < 0 || type > 6) return null;
  let i = 1;

  // Binary attachment count — only the binary types carry one.
  let attachments = 0;
  if (type === SOCKET_IO_PACKET_TYPES.binaryEvent || type === SOCKET_IO_PACKET_TYPES.binaryAck) {
    let digits = '';
    while (i < text.length && text[i] >= '0' && text[i] <= '9') {
      digits += text[i];
      i++;
    }
    if (digits === '' || text[i] !== '-') return null;
    attachments = Number(digits);
    i++;
  }

  let namespace = '/';
  if (text[i] === '/') {
    const comma = text.indexOf(',', i);
    if (comma === -1) return null;
    namespace = text.slice(i, comma);
    i = comma + 1;
  }

  let ackDigits = '';
  while (i < text.length && text[i] >= '0' && text[i] <= '9') {
    ackDigits += text[i];
    i++;
  }
  const ackId = ackDigits !== '' ? Number(ackDigits) : null;

  const dataJson = i < text.length ? text.slice(i) : null;
  return { type, namespace, ackId, dataJson, attachments };
}
