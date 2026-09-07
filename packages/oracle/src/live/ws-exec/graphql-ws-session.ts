/**
 * GraphQL subscription session controller — the host-neutral protocol
 * driver the WS executor mounts ABOVE the protocol-blind transport
 * seam when a session carries a `graphql` plan (the `socketio-session`
 * sibling for `graphql-transport-ws`). It owns the wire obligations of
 * the ONE subscription a session runs:
 *
 *   - `connection_init` once the handshake settles, the session
 *     credential's minted headers as the payload (the ecosystem's
 *     `connectionParams` convention — a browser cannot set handshake
 *     headers, so the credential rides in-band on every host);
 *   - `subscribe` on the server's `connection_ack`, the resolved
 *     envelope under the session's one id;
 *   - `pong` for every server `ping`, the payload echoed;
 *   - the client's own `complete` on Stop, then the clean close; the
 *     clean close alone once the server said `complete` or `error`.
 *
 * The transitions are the core reducer's (`@openheaders/core/graphql`
 * — the same machine the display replays over the capture); this
 * controller only materializes its symbolic effects onto the
 * executor's captured write path, so every protocol frame lands on
 * the timeline verbatim like any other ↑ message (the capture law).
 */

import {
  encodeGraphqlWsMessage,
  GRAPHQL_WS_INITIAL_STATE,
  GRAPHQL_WS_SUBSCRIPTION_ID,
  type GraphqlWsClientEffect,
  type GraphqlWsClientInput,
  type GraphqlWsClientState,
  type GraphqlWsSubscribePayload,
  reduceGraphqlWsClient,
} from '@openheaders/core/graphql';

export interface GraphqlWsSessionController {
  /** The handshake settled — `connection_init` leaves. */
  start(): void;
  /** Feed one inbound TEXT frame — the ack subscribes, a ping pongs,
   *  the server's complete / error closes. */
  handleFrame(text: string): void;
  /** Stop — the client's `complete` while subscribed, then the close. */
  stop(): void;
}

export interface GraphqlWsSessionOptions {
  /** The resolved envelope the `subscribe` frame carries. */
  subscribe: GraphqlWsSubscribePayload;
  /** The `connection_init` payload, read when the frame leaves (the
   *  credential mints per dial); undefined = no payload. */
  connectionParams: () => Record<string, unknown> | undefined;
}

export function createGraphqlWsSessionController(
  sendFrame: (text: string) => void,
  closeSocket: () => void,
  options: GraphqlWsSessionOptions,
): GraphqlWsSessionController {
  let state: GraphqlWsClientState = GRAPHQL_WS_INITIAL_STATE;

  const run = (effect: GraphqlWsClientEffect): void => {
    switch (effect.kind) {
      case 'init': {
        const payload = options.connectionParams();
        sendFrame(
          encodeGraphqlWsMessage(
            payload === undefined ? { type: 'connection_init' } : { type: 'connection_init', payload },
          ),
        );
        return;
      }
      case 'subscribe':
        sendFrame(
          encodeGraphqlWsMessage({ type: 'subscribe', id: GRAPHQL_WS_SUBSCRIPTION_ID, payload: options.subscribe }),
        );
        return;
      case 'pong':
        sendFrame(
          encodeGraphqlWsMessage(
            effect.payload === undefined ? { type: 'pong' } : { type: 'pong', payload: effect.payload },
          ),
        );
        return;
      case 'complete':
        sendFrame(encodeGraphqlWsMessage({ type: 'complete', id: GRAPHQL_WS_SUBSCRIPTION_ID }));
        return;
      case 'close':
        closeSocket();
        return;
    }
  };

  const apply = (input: GraphqlWsClientInput): void => {
    const step = reduceGraphqlWsClient(state, input);
    state = step.state;
    for (const effect of step.effects) run(effect);
  };

  return {
    start() {
      apply({ kind: 'open' });
    },
    handleFrame(text) {
      apply({ kind: 'message', text });
    },
    stop() {
      apply({ kind: 'stop' });
    },
  };
}
