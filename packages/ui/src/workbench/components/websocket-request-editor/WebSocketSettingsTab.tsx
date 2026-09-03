/**
 * WebSocketSettingsTab — the request's Settings tab: the shared
 * WebSocket rows (`WebSocketSettingsRows`, the same rows a container's
 * Settings section renders) over the editor draft. The draft keeps its
 * switches concrete and its request-only strings as '' — this seam
 * maps them onto the rows' optional value (a default-equivalent switch
 * reads as absent, so the dots track distance from the protocol
 * defaults) and re-concretizes what the rows hand back. There is no
 * saved-baseline (unsaved) plane here; the editor's own dirty
 * fingerprint covers "not saved yet".
 */

import { WEBSOCKET_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { WebSocketDraft } from './draft';
import WebSocketSettingsRows, { type WebSocketSettingsValue } from './WebSocketSettingsRows';

interface WebSocketSettingsTabProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
}

/** The draft as the rows' value: the inheritable keys as they are, the
 *  concrete switches read as absent at their protocol default, the
 *  empty request-only strings as absent. */
function valueOf(draft: WebSocketDraft): WebSocketSettingsValue {
  return {
    ...sliceOf(draft, WEBSOCKET_INHERITABLE_SETTING_KEYS),
    subprotocols: draft.subprotocols,
    namespace: draft.namespace === '' ? undefined : draft.namespace,
    handshakePath: draft.handshakePath === '' ? undefined : draft.handshakePath,
    sslVerification: draft.sslVerification ? undefined : false,
    followRedirects: draft.followRedirects ? true : undefined,
    autoReconnect: draft.autoReconnect ? true : undefined,
    reconnectBackoff: draft.reconnectBackoff ? undefined : false,
  };
}

const WebSocketSettingsTab: React.FC<WebSocketSettingsTabProps> = ({ draft, setDraft, socketioFlavor }) => (
  <WebSocketSettingsRows
    value={valueOf(draft)}
    onChange={(next) =>
      setDraft((d) => ({
        ...d,
        ...next,
        subprotocols: next.subprotocols ?? [],
        namespace: next.namespace ?? '',
        handshakePath: next.handshakePath ?? '',
        sslVerification: next.sslVerification !== false,
        followRedirects: next.followRedirects === true,
        autoReconnect: next.autoReconnect === true,
        reconnectBackoff: next.reconnectBackoff !== false,
      }))
    }
    flavor={socketioFlavor ? 'socketio' : 'raw'}
  />
);

export default WebSocketSettingsTab;
