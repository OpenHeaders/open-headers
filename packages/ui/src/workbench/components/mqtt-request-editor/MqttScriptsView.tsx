/**
 * MqttScriptsView — the MQTT session pane's Scripts view: the shared
 * session-scripts view (Console per mark under a hook · event heading,
 * Tests across marks) under the MQTT vocabulary.
 */

import type React from 'react';
import SessionScriptsView from '../session-scripts/SessionScriptsView';
import { MQTT_SCRIPTS_VOCABULARY, type MqttScriptMarkItem } from './mqtt-scripts';

interface MqttScriptsViewProps {
  marks: readonly MqttScriptMarkItem[];
  /** The per-event marks stopped at the cap — the tallies kept going. */
  marksCapped?: boolean;
}

const MqttScriptsView: React.FC<MqttScriptsViewProps> = ({ marks, marksCapped = false }) => (
  <SessionScriptsView marks={marks} marksCapped={marksCapped} vocabulary={MQTT_SCRIPTS_VOCABULARY} />
);

export default MqttScriptsView;
