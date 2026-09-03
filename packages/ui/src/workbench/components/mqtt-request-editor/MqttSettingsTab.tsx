/**
 * MqttSettingsTab — the request's Settings tab: the shared MQTT rows
 * (`MqttSettingsRows`, the same rows a container's Settings section
 * renders) over the editor draft, on the ANCESTOR PLANE: the
 * inheritable knobs ride the draft tri-state (`undefined` = inherit /
 * the runtime default, an explicit value = the request's own —
 * explicit wins) and pass straight through; only the request-only
 * client id keeps its '' ↔ absent mapping. The rows read their
 * placeholders, a switch's effective state and the "Inherited from …"
 * line off the view the editor derives from the request's ancestry.
 * There is no saved-baseline (unsaved) plane here; the editor's own
 * dirty fingerprint covers "not saved yet".
 */

import { MQTT_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { type InheritedSettingsView, sliceOf } from '../shared/inherited-settings/inherited-settings';
import type { MqttDraft } from './draft';
import MqttSettingsRows, { type MqttSettingsValue } from './MqttSettingsRows';

interface MqttSettingsTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
  /** The ancestor plane — see the rows. */
  inherited?: InheritedSettingsView;
}

/** The draft as the rows' value: the inheritable keys as they are, the
 *  empty request-only client id as absent. */
function valueOf(draft: MqttDraft): MqttSettingsValue {
  return {
    ...sliceOf(draft, MQTT_INHERITABLE_SETTING_KEYS),
    clientId: draft.clientId === '' ? undefined : draft.clientId,
  };
}

const MqttSettingsTab: React.FC<MqttSettingsTabProps> = ({ draft, setDraft, v5, inherited }) => (
  <MqttSettingsRows
    value={valueOf(draft)}
    onChange={(next) => setDraft((d) => ({ ...d, ...next, clientId: next.clientId ?? '' }))}
    v5={v5}
    inherited={inherited}
  />
);

export default MqttSettingsTab;
