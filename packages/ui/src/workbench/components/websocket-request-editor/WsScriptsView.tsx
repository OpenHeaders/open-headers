/**
 * WsScriptsView — the WebSocket session pane's Scripts view: the
 * shared session-scripts view (Console per mark under a hook · event
 * heading, Tests across marks) under the WebSocket vocabulary.
 */

import type React from 'react';
import SessionScriptsView from '../session-scripts/SessionScriptsView';
import { WS_SCRIPTS_VOCABULARY, type WsScriptMarkItem } from './ws-scripts';

interface WsScriptsViewProps {
  marks: readonly WsScriptMarkItem[];
  /** The per-event marks stopped at the cap — the tallies kept going. */
  marksCapped?: boolean;
}

const WsScriptsView: React.FC<WsScriptsViewProps> = ({ marks, marksCapped = false }) => (
  <SessionScriptsView marks={marks} marksCapped={marksCapped} vocabulary={WS_SCRIPTS_VOCABULARY} />
);

export default WsScriptsView;
