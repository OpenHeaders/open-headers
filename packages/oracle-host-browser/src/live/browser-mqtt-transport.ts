/**
 * Browser MQTT byte-stream transport — the browser host's
 * implementation of the engine's {@link MqttByteTransport} seam, the
 * `node-mqtt-transport.ts` twin for surfaces that execute the session
 * IN the page realm (the extension workbench, the `mqttPageSession`
 * capability).
 *
 * Only the ws(s):// wire family exists here: MQTT-over-WebSocket rides
 * the proven {@link createBrowserWsTransport} with the `mqtt`
 * subprotocol offered and packets crossing as BINARY frames (the
 * node twin's `connectWs` shape). Frame boundaries carry no packet
 * meaning — the executor's incremental decoder reassembles either way,
 * so the seam just forwards bytes. mqtt(s):// dial a raw TCP socket no
 * browser page can open — the editor's Connect gate names that limit
 * up front, and a tcp URL that still reaches this seam (a template
 * resolving to one at Connect) settles with the same honest message,
 * never a silent downgrade to ws.
 *
 * The TLS verification policy CANNOT apply on a platform socket — the
 * knob is not forwarded, and the calling surface names it in its
 * Connect-side honesty notice (the wsPageSession discipline). The
 * connect deadline IS honored, and abort semantics are the underlying
 * transport's: settle-with-error before the stream establishes,
 * immediate `onEnd()` after it.
 */

import type {
  MqttByteTransport,
  MqttStreamCallbacks,
  MqttStreamWriter,
  MqttTransportRequest,
} from '@openheaders/oracle/live/mqtt-exec/transport';
import { MqttTransportError } from '@openheaders/oracle/live/mqtt-exec/transport';
import { createBrowserWsTransport } from './browser-ws-transport';

const TCP_SCHEME_MESSAGE =
  'mqtt:// and mqtts:// dial a raw TCP socket, which a browser page cannot open. Use ws:// or wss:// here, or run the session on the desktop app or server.';

export function createBrowserMqttTransport(): MqttByteTransport {
  return {
    connect(request: MqttTransportRequest, callbacks: MqttStreamCallbacks, signal?: AbortSignal): MqttStreamWriter {
      if (!/^wss?:\/\//i.test(request.url)) {
        queueMicrotask(() => callbacks.onEnd(new MqttTransportError(TCP_SCHEME_MESSAGE)));
        return { write: () => {}, end: () => {} };
      }
      const wsTransport = createBrowserWsTransport();
      const writer = wsTransport.connect(
        {
          url: request.url,
          headers: [],
          // The MQTT-over-WebSocket contract: the client MUST offer the
          // `mqtt` subprotocol, and packets ride binary frames.
          subprotocols: ['mqtt'],
          ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
        },
        {
          // No proxy route — the browser owns egress in this realm.
          onOpen: () => callbacks.onConnect(),
          onMessage: ({ data }) => callbacks.onData(data),
          // The Close accounting has no MQTT meaning — the byte
          // stream's end is the fact the executor consumes.
          onClose: () => {},
          onEnd: (error) => callbacks.onEnd(error !== undefined ? new MqttTransportError(error.message) : undefined),
        },
        signal,
      );
      return {
        write(bytes: Uint8Array): void {
          writer.sendBinary?.(bytes);
        },
        end(): void {
          writer.close(1000, '');
        },
      };
    },
  };
}
