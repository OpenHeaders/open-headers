/**
 * WsScriptsTag — the WebSocket session pane's meta-strip scripts
 * attribution: the shared session-scripts tag under the WebSocket
 * vocabulary ("Scripts · N", the hooks that ran with their levels).
 */

import type React from 'react';
import SessionScriptsTag from '../session-scripts/SessionScriptsTag';
import { WS_SCRIPTS_VOCABULARY, type WsScriptsDigest } from './ws-scripts';

const WsScriptsTag: React.FC<{ digest: WsScriptsDigest }> = ({ digest }) => (
  <SessionScriptsTag digest={digest} vocabulary={WS_SCRIPTS_VOCABULARY} />
);

export default WsScriptsTag;
