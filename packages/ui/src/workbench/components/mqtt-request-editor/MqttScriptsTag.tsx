/**
 * MqttScriptsTag — the MQTT session pane's meta-strip scripts
 * attribution: the shared session-scripts tag under the MQTT
 * vocabulary ("Scripts · N", the hooks that ran with their levels).
 */

import type React from 'react';
import SessionScriptsTag from '../session-scripts/SessionScriptsTag';
import { MQTT_SCRIPTS_VOCABULARY, type MqttScriptsDigest } from './mqtt-scripts';

const MqttScriptsTag: React.FC<{ digest: MqttScriptsDigest }> = ({ digest }) => (
  <SessionScriptsTag digest={digest} vocabulary={MQTT_SCRIPTS_VOCABULARY} />
);

export default MqttScriptsTag;
