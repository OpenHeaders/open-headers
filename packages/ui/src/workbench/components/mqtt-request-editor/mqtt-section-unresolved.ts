/**
 * The MQTT editor's per-tab unresolved reading — the red tier the tab
 * labels wear over the salmon unsaved one (the HTTP rule), the
 * per-tab sibling of mqtt-section-unsaved.ts. The core scan groups the
 * request's templates by entity field (`collectMqttTemplateGroups`);
 * this is the map from those fields onto the editor's tabs. The URL
 * group has no tab — the target row wears it as the input's error
 * status.
 */

import type { MqttTemplateGroups } from '@openheaders/core/live';

export interface MqttUnresolvedSections {
  message: boolean;
  topics: boolean;
  auth: boolean;
  properties: boolean;
  lastWill: boolean;
  settings: boolean;
}

/** Shared all-clean value for surfaces rendered without a reading. */
export const NO_UNRESOLVED_MQTT_SECTIONS: MqttUnresolvedSections = {
  message: false,
  topics: false,
  auth: false,
  properties: false,
  lastWill: false,
  settings: false,
};

export function mqttUnresolvedSections(groups: ReadonlySet<keyof MqttTemplateGroups>): MqttUnresolvedSections {
  return {
    message: groups.has('message'),
    topics: groups.has('topics'),
    auth: groups.has('auth'),
    properties: groups.has('userProperties'),
    lastWill: groups.has('lastWill'),
    settings: groups.has('settings'),
  };
}
