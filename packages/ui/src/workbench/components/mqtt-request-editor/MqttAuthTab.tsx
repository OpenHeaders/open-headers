/**
 * MqttAuthTab — the session credential: the shared session tab under
 * the MQTT mask (Basic alone — the CONNECT packet's User Name and
 * Password, which both MQTT versions carry; `{{refs}}` resolve at
 * Connect and saved examples never capture the credential — the rail
 * note names all of it).
 */

import type { MqttAuth } from '@openheaders/core/types';
import type React from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import type { InheritedAuthAttribution } from '../request-editor/inherited-auth';
import { SessionAuthTab } from '../request-editor/SessionAuthTab';

interface MqttAuthTabProps {
  auth: MqttAuth;
  inheritedFrom?: InheritedAuthAttribution;
  ancestry?: RequestAncestry | null;
  /** The broker URL — host-scoped entries resolve against it. */
  url?: string;
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: MqttAuth) => void;
}

const MqttAuthTab: React.FC<MqttAuthTabProps> = (props) => (
  <SessionAuthTab
    kind="mqtt"
    testIdStem="mqtt"
    unsupportedKey="workbench.editors.mqtt.auth.inheritUnsupported"
    ownUnsupportedKey="workbench.editors.mqtt.auth.ownUnsupported"
    ownNoteKey={() => 'workbench.editors.mqtt.auth.help'}
    {...props}
  />
);

export default MqttAuthTab;
