/**
 * WebSocketAuthTab — the session's auth block: the shared session tab
 * under the WebSocket mask (bearer · basic · api-key in a header or
 * the handshake URL's query · OAuth 2.0 · JWT Bearer · AWS SigV4 as
 * the signed URL). Where a credential rides depends on the flavor —
 * a handshake header for raw (node hosts only), the CONNECT auth
 * payload plus that header for Socket.IO — so the bearer note is per
 * flavor; the other own types share one note naming every leg.
 */

import type { WebSocketAuth } from '@openheaders/core/types';
import type React from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import type { InheritedAuthAttribution } from '../request-editor/inherited-auth';
import { SessionAuthTab } from '../request-editor/SessionAuthTab';

interface WebSocketAuthTabProps {
  auth: WebSocketAuth;
  socketioFlavor: boolean;
  inheritedFrom?: InheritedAuthAttribution;
  ancestry?: RequestAncestry | null;
  /** The session URL — host-scoped entries resolve against it. */
  url?: string;
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: WebSocketAuth) => void;
}

const WebSocketAuthTab: React.FC<WebSocketAuthTabProps> = ({ socketioFlavor, ...props }) => (
  <SessionAuthTab
    kind="websocket"
    testIdStem="ws"
    unsupportedKey="workbench.editors.websocket.auth.inheritUnsupported"
    ownUnsupportedKey="workbench.editors.websocket.auth.ownUnsupported"
    ownNoteKey={(type) =>
      type === 'bearer'
        ? socketioFlavor
          ? 'workbench.editors.websocket.auth.helpSocketio'
          : 'workbench.editors.websocket.auth.helpRaw'
        : 'workbench.editors.websocket.auth.helpOwn'
    }
    {...props}
  />
);

export default WebSocketAuthTab;
