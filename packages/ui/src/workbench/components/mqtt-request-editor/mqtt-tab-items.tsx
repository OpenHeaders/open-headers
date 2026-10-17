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
 *
 * Every label closes with the tab's `(i)` — hover-revealed, its slot
 * reserved at rest so the bar never shifts; the popover opens on the
 * glyph's click (the Body tab's mode radios' idiom), which never
 * reaches the tab.
 */

import type React from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { TabCount, TabDot } from '../request-editor/request-tab-items';
import SpecTabLabel from '../shared/SpecTabLabel';
import { draftToLastWill, type MqttDraft } from './draft';
import { anyMqttScriptUnsaved, type MqttUnsavedSections, NO_UNSAVED_MQTT_SECTIONS } from './mqtt-section-unsaved';
import { type MqttSettingsKnobKey, NO_UNSAVED_MQTT_SETTINGS } from './mqtt-settings-unsaved';
import { mqttTabInfo } from './mqtt-tab-info';

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

/** The label is a flex row so the glyph's slot is laid out whether or
 *  not it is visible; the marks keep their own 4px lead. */
const LABEL_STYLE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4 };

/** `title · mark · (i)` — the mark may be nothing; the glyph always is. */
function tabLabel(tab: MqttTabKey, title: React.ReactNode, mark: React.ReactNode, t: Translate): React.ReactNode {
  return (
    <span className="oh-info-hover-host" style={LABEL_STYLE}>
      {title} {mark}
      <InfoTrigger className="oh-info-trigger--hover oh-info-trigger--trailing" content={mqttTabInfo(t, tab)} />
    </span>
  );
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
  // The will has content once its block persists — any field off its
  // default, the save projection's own reading; the wire's topic gate
  // is the executor's, not the label's.
  const willConfigured = draftToLastWill(draft.lastWill) !== undefined;
  const anyScript = Object.values(draft.scripts).some((source) => source !== undefined && source.trim() !== '');
  // Docs has content once a description is written; Auth once the
  // request holds its OWN auth — here None is the default and Inherit
  // is the chain's value, so neither dots (the Settings rows' explicit-
  // wins reading).
  const hasDocs = draft.description.trim() !== '';
  const ownAuth = draft.auth.type !== 'none' && draft.auth.type !== 'inherit';
  return [
    { key: 'docs', label: tabLabel('docs', t('workbench.editors.mqtt.tab.docs'), toneMark(unsaved.docs, hasDocs), t) },
    {
      key: 'message',
      label: tabLabel('message', t('workbench.editors.mqtt.tab.message'), toneMark(unsaved.message, false), t),
    },
    {
      key: 'topics',
      label: tabLabel('topics', t('workbench.editors.mqtt.tab.topics'), gridMark(topicCount, unsaved.topics), t),
    },
    { key: 'auth', label: tabLabel('auth', t('workbench.editors.mqtt.tab.auth'), toneMark(unsaved.auth, ownAuth), t) },
    {
      key: 'properties',
      label: tabLabel(
        'properties',
        t('workbench.editors.mqtt.tab.properties'),
        gridMark(propertyCount, unsaved.properties),
        t,
      ),
    },
    {
      key: 'lastwill',
      label: tabLabel(
        'lastwill',
        t('workbench.editors.mqtt.tab.lastWill'),
        toneMark(unsaved.lastWill, willConfigured),
        t,
      ),
    },
    {
      key: 'scripts',
      label: tabLabel(
        'scripts',
        t('workbench.editors.mqtt.tab.scripts'),
        toneMark(anyMqttScriptUnsaved(unsaved.scripts), anyScript),
        t,
      ),
    },
    {
      key: 'settings',
      label: tabLabel(
        'settings',
        t('workbench.editors.mqtt.tab.settings'),
        toneMark(unsavedSettings.size > 0, ownSettings),
        t,
      ),
    },
    { key: 'spec', label: tabLabel('spec', <SpecTabLabel />, null, t) },
  ];
}
