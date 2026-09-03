/**
 * WebSocketSettingsTab — the request's Settings tab: the shared
 * WebSocket rows (`WebSocketSettingsRows`, the same rows a container's
 * Settings section renders) over the editor draft, on the ANCESTOR
 * PLANE: the inheritable knobs ride the draft tri-state (`undefined` =
 * inherit / the runtime default, an explicit value = the request's
 * own — explicit wins) and pass straight through; only the request-
 * only namespace keeps its '' ↔ absent mapping. The rows read their
 * placeholders, a switch's effective state and the "Inherited from …"
 * line off the view the editor derives from the request's ancestry.
 * There is no saved-baseline (unsaved) plane here; the editor's own
 * dirty fingerprint covers "not saved yet".
 */

import { WEBSOCKET_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { type InheritedSettingsView, sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { WebSocketDraft } from './draft';
import WebSocketSettingsRows, { type WebSocketSettingsValue } from './WebSocketSettingsRows';

interface WebSocketSettingsTabProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
  /** The ancestor plane — see the rows. */
  inherited?: InheritedSettingsView;
}

/** The draft as the rows' value: the inheritable keys as they are, the
 *  empty request-only namespace as absent. */
function valueOf(draft: WebSocketDraft): WebSocketSettingsValue {
  return {
    ...sliceOf(draft, WEBSOCKET_INHERITABLE_SETTING_KEYS),
    subprotocols: draft.subprotocols,
    namespace: draft.namespace === '' ? undefined : draft.namespace,
  };
}

const WebSocketSettingsTab: React.FC<WebSocketSettingsTabProps> = ({ draft, setDraft, socketioFlavor, inherited }) => (
  <WebSocketSettingsRows
    value={valueOf(draft)}
    onChange={(next) =>
      setDraft((d) => ({
        ...d,
        ...next,
        subprotocols: next.subprotocols ?? [],
        namespace: next.namespace ?? '',
      }))
    }
    flavor={socketioFlavor ? 'socketio' : 'raw'}
    inherited={inherited}
  />
);

export default WebSocketSettingsTab;
