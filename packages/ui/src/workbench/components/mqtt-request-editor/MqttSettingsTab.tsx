/**
 * MqttSettingsTab — the request's Settings tab: the shared MQTT rows
 * (`MqttSettingsRows`, the same rows a container's Settings section
 * renders) over the editor draft. The draft keeps its switches
 * concrete and the client id as '' — this seam maps them onto the
 * rows' optional value (a default-equivalent switch reads as absent,
 * so the dots track distance from the protocol defaults) and
 * re-concretizes what the rows hand back. There is no saved-baseline
 * (unsaved) plane here; the editor's own dirty fingerprint covers
 * "not saved yet".
 */

import { MQTT_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { MqttDraft } from './draft';
import MqttSettingsRows, { type MqttSettingsValue } from './MqttSettingsRows';

interface MqttSettingsTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
}

/** The draft as the rows' value: the inheritable keys as they are, the
 *  concrete switches read as absent at their protocol default, the
 *  empty client id as absent. */
function valueOf(draft: MqttDraft): MqttSettingsValue {
  return {
    ...sliceOf(draft, MQTT_INHERITABLE_SETTING_KEYS),
    clientId: draft.clientId === '' ? undefined : draft.clientId,
    cleanStart: draft.cleanStart ? undefined : false,
    requestResponseInformation: draft.requestResponseInformation ? true : undefined,
    requestProblemInformation: draft.requestProblemInformation ? undefined : false,
    sslVerification: draft.sslVerification ? undefined : false,
    autoReconnect: draft.autoReconnect ? true : undefined,
    reconnectBackoff: draft.reconnectBackoff ? undefined : false,
  };
}

const MqttSettingsTab: React.FC<MqttSettingsTabProps> = ({ draft, setDraft, v5 }) => (
  <MqttSettingsRows
    value={valueOf(draft)}
    onChange={(next) =>
      setDraft((d) => ({
        ...d,
        ...next,
        clientId: next.clientId ?? '',
        cleanStart: next.cleanStart !== false,
        requestResponseInformation: next.requestResponseInformation === true,
        requestProblemInformation: next.requestProblemInformation !== false,
        sslVerification: next.sslVerification !== false,
        autoReconnect: next.autoReconnect === true,
        reconnectBackoff: next.reconnectBackoff !== false,
      }))
    }
    v5={v5}
  />
);

export default MqttSettingsTab;
