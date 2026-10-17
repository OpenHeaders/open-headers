/**
 * Per-section unsaved-vs-saved comparison behind the MQTT editor's tab
 * labels' dirty (salmon) tones — the HTTP editor's section-unsaved.ts
 * on this host, the per-tab sibling of mqtt-settings-unsaved.ts. Both
 * sides are the SAME projection derived dirty fingerprints
 * (`buildMqttRequestUpdates` / `canonicalMqttRequestProjection`),
 * sliced per tab, so the per-tab tones always sum up to exactly why
 * the Save button is dirty — the URL and the protocol version (the
 * target row) and the spec link (the Spec tab wears no tone) aside,
 * which have no tab here. No extra normalization on purpose: a section
 * reads unsaved precisely when its slice of the whole-document
 * fingerprint differs.
 */

import { MQTT_SCRIPT_KINDS, type MqttScriptKind } from '@openheaders/core/scripts';
import { stableStringify } from '@openheaders/ui/shared/forms';
import type { ScriptSlotFlags } from '../script-editor/script-slots';
import type { MqttRequestUpdates } from './draft';

export interface MqttUnsavedSections {
  docs: boolean;
  /** The compose block AND the Saved-messages rail — the rail lives on
   *  the Message tab and the compose writes through to its selected
   *  row, so a row edit is a Message edit. */
  message: boolean;
  topics: boolean;
  auth: boolean;
  properties: boolean;
  lastWill: boolean;
  /** Per slot, so the Scripts tab's rail rows can carry their own
   *  tone; the tab label ORs the record. */
  scripts: ScriptSlotFlags;
}

/** Shared all-clean value for surfaces rendered without a baseline. */
export const NO_UNSAVED_MQTT_SECTIONS: MqttUnsavedSections = {
  docs: false,
  message: false,
  topics: false,
  auth: false,
  properties: false,
  lastWill: false,
  scripts: {},
};

/** Sections whose slice of the draft projection differs from the saved
 *  one. Scalar slices compare strictly; structured slices via the same
 *  stable stringify the whole-document fingerprint uses. A script slot
 *  compares verbatim — both projections already drop a blank slot, so
 *  an emptied slot flags against a saved source and never against
 *  another blank. */
export function unsavedMqttSections(draft: MqttRequestUpdates, saved: MqttRequestUpdates): MqttUnsavedSections {
  const differs = (pick: (u: MqttRequestUpdates) => unknown): boolean =>
    stableStringify(pick(draft)) !== stableStringify(pick(saved));
  const scripts: Partial<Record<MqttScriptKind, boolean>> = {};
  for (const kind of MQTT_SCRIPT_KINDS) {
    if (draft.scripts[kind] !== saved.scripts[kind]) scripts[kind] = true;
  }
  return {
    docs: draft.description !== saved.description,
    message: differs((u) => [
      u.topic,
      u.payload,
      u.payloadFormat,
      u.qos,
      u.retain,
      u.publishProperties,
      u.savedMessages,
    ]),
    topics: differs((u) => u.topics),
    auth: differs((u) => u.auth),
    properties: differs((u) => u.userProperties),
    lastWill: differs((u) => u.lastWill),
    scripts,
  };
}

/** The tab label's reading of the per-slot record. */
export function anyMqttScriptUnsaved(flags: ScriptSlotFlags): boolean {
  return MQTT_SCRIPT_KINDS.some((kind) => flags[kind] === true);
}
