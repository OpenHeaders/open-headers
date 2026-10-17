/**
 * Per-knob unsaved-vs-saved comparison behind the MQTT Settings tab's
 * salmon dots — the HTTP editor's settings-unsaved.ts on this host.
 * Two orthogonal facts color a knob's accent dot:
 *   • neutral — the knob holds the request's OWN value (explicit wins on
 *     the ancestor plane: a defined value is the request's, whatever
 *     it is; only absence inherits);
 *   • salmon — the knob differs from the SAVED request (this knob's
 *     slice of why Save is dirty), and salmon wins while both hold.
 * A knob cleared back to inherit but not yet saved therefore still
 * dots salmon, and on save every salmon dot either turns neutral (an own
 * value) or disappears (back to inherit).
 *
 * The knob set is the kind's inheritable keys (core's list, the same
 * keys the rows read) plus the two request-only rows a container never
 * carries: the client id and this device's execution place. Comparison
 * runs strictly per knob on the RAW projection values — the client id
 * is a string on both sides ('' = none), so its empty-vs-absent form
 * mapping never bites.
 */

import { MQTT_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type { MqttRequestUpdates } from './draft';

export const MQTT_SETTINGS_KNOB_KEYS = [...MQTT_INHERITABLE_SETTING_KEYS, 'clientId', 'executionPlace'] as const;

export type MqttSettingsKnobKey = (typeof MQTT_SETTINGS_KNOB_KEYS)[number];

/** The settings slice of the projection — both sides of the comparison
 *  fit this shape. */
export type MqttSettingsSlice = Pick<MqttRequestUpdates, MqttSettingsKnobKey>;

/** Shared empty set for surfaces rendered without a saved baseline. */
export const NO_UNSAVED_MQTT_SETTINGS: ReadonlySet<MqttSettingsKnobKey> = new Set();

/** Knobs whose draft value differs from the saved one — one strict
 *  compare per knob, minted fresh per call. */
export function unsavedMqttSettingKeys(
  draft: MqttSettingsSlice,
  saved: MqttSettingsSlice,
): ReadonlySet<MqttSettingsKnobKey> {
  const out = new Set<MqttSettingsKnobKey>();
  for (const key of MQTT_SETTINGS_KNOB_KEYS) {
    if (draft[key] !== saved[key]) out.add(key);
  }
  return out;
}

/** Does the request hold an OWN value on any knob — the Settings tab's
 *  neutral has-content dot (the rows' explicit-wins reading; the client id
 *  counts once it is non-empty). */
export function anyOwnMqttSetting(slice: MqttSettingsSlice): boolean {
  return MQTT_SETTINGS_KNOB_KEYS.some((key) => (key === 'clientId' ? slice.clientId !== '' : slice[key] !== undefined));
}
