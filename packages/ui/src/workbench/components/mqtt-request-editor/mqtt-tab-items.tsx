/**
 * MQTT request editor tab catalog — the ordered list of editor tabs
 * plus their live labels (count badges + has-content / unsaved dots),
 * the HTTP editor's request-tab-items.tsx on this host. A pure builder:
 * the orchestrator hands it the draft and the two unsaved readings
 * (per section, per settings knob) and renders the result.
 *
 * Tone precedence on every label (the HTTP rule minus its red tier —
 * MQTT has no unresolved plane): salmon unsaved > neutral has-content >
 * nothing. On the grid tabs (Topics / Properties) the count badge
 * itself carries the unsaved tone; a grid whose rows were all removed
 * but not yet saved has no badge, so a bare salmon dot stands in.
 */

import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { TabCount, TabDot } from '../request-editor/request-tab-items';
import SpecTabLabel from '../shared/SpecTabLabel';
import type { MqttDraft } from './draft';
import { anyMqttScriptUnsaved, type MqttUnsavedSections, NO_UNSAVED_MQTT_SECTIONS } from './mqtt-section-unsaved';
import { type MqttSettingsKnobKey, NO_UNSAVED_MQTT_SETTINGS } from './mqtt-settings-unsaved';

export type MqttTabKey =
  | 'docs'
  | 'message'
  | 'topics'
  | 'auth'
  | 'properties'
  | 'lastwill'
  | 'scripts'
  | 'settings'
  | 'spec';

export interface MqttTabItemsInput {
  draft: MqttDraft;
  t: Translate;
  /** Per-section unsaved tones (see mqtt-section-unsaved.ts). */
  unsaved?: MqttUnsavedSections;
  /** Knobs that differ from the saved request (see
   *  mqtt-settings-unsaved.ts) — the Settings label's salmon dot. */
  unsavedSettings?: ReadonlySet<MqttSettingsKnobKey>;
  /** Does the request hold an own value on any knob — the Settings
   *  label's neutral has-content dot. */
  ownSettings: boolean;
}

/** A grid tab's badge: the count wearing the unsaved tone, a bare
 *  salmon dot at zero rows while the slice is unsaved, else nothing. */
function gridMark(count: number, unsaved: boolean): React.ReactNode {
  if (count > 0) return <TabCount n={count} unsaved={unsaved} />;
  return unsaved ? <TabDot tone="unsaved" /> : null;
}

/** Salmon over neutral over nothing. */
function toneMark(unsaved: boolean, hasContent: boolean): React.ReactNode {
  if (unsaved) return <TabDot tone="unsaved" />;
  return hasContent ? <TabDot /> : null;
}

export function buildMqttTabItems({
  draft,
  t,
  unsaved = NO_UNSAVED_MQTT_SECTIONS,
  unsavedSettings = NO_UNSAVED_MQTT_SETTINGS,
  ownSettings,
}: MqttTabItemsInput): { key: MqttTabKey; label: React.ReactNode }[] {
  // The grid badges count the rows the user owns: a topic row with a
  // filter (the grid's trailing ghost never counts), a CONNECT user
  // property that is enabled and keyed (the HTTP header rule).
  const topicCount = draft.topics.filter((row) => row.topicFilter.trim() !== '').length;
  const propertyCount = draft.userProperties.filter((row) => row.enabled && row.key.trim() !== '').length;
  const willConfigured = draft.lastWill.topic.trim() !== '';
  const anyScript = Object.values(draft.scripts).some((source) => source !== undefined && source.trim() !== '');
  // Docs has content once a description is written; Auth once the
  // request holds its OWN auth — here None is the default and Inherit
  // is the chain's value, so neither dots (the Settings rows' explicit-
  // wins reading).
  const hasDocs = draft.description.trim() !== '';
  const ownAuth = draft.auth.type !== 'none' && draft.auth.type !== 'inherit';
  return [
    {
      key: 'docs',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.docs')} {toneMark(unsaved.docs, hasDocs)}
        </span>
      ),
    },
    {
      key: 'message',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.message')} {toneMark(unsaved.message, false)}
        </span>
      ),
    },
    {
      key: 'topics',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.topics')} {gridMark(topicCount, unsaved.topics)}
        </span>
      ),
    },
    {
      key: 'auth',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.auth')} {toneMark(unsaved.auth, ownAuth)}
        </span>
      ),
    },
    {
      key: 'properties',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.properties')} {gridMark(propertyCount, unsaved.properties)}
        </span>
      ),
    },
    {
      key: 'lastwill',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.lastWill')} {toneMark(unsaved.lastWill, willConfigured)}
        </span>
      ),
    },
    {
      key: 'scripts',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.scripts')} {toneMark(anyMqttScriptUnsaved(unsaved.scripts), anyScript)}
        </span>
      ),
    },
    {
      key: 'settings',
      label: (
        <span>
          {t('workbench.editors.mqtt.tab.settings')} {toneMark(unsavedSettings.size > 0, ownSettings)}
        </span>
      ),
    },
    { key: 'spec', label: <SpecTabLabel /> },
  ];
}
