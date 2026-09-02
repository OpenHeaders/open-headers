/**
 * The MQTT session's scripts as the pane reads them — the shared
 * session-scripts digest (`session-scripts/`) under the MQTT hook order
 * and vocabulary: the live feed's `script` marks while the session is
 * open, the snapshot's `scripts` record once it settled. The marks
 * ride the event log itself (one array with the messages and the
 * subscription facts), so a mark's display index is its position in
 * that log and its stamp the positional host time.
 */

import type { MqttScriptKind } from '@openheaders/core/scripts';
import { MQTT_SCRIPT_KINDS } from '@openheaders/core/scripts';
import type { ExecutedMqttScripts } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import {
  digestFromMarks as digestFromSessionMarks,
  finishDigest,
  foldDigest,
  type SessionHookDigest,
  type SessionScriptMarkItem,
  type SessionScriptsDigest,
  summaryDigest,
} from '../session-scripts/session-scripts-digest';
import type { SessionScriptsVocabulary } from '../session-scripts/session-scripts-vocabulary';
import type { MqttTimelineItem } from './mqtt-timeline-model';

/** A `script` mark as the pane holds it — with its event-log index and,
 *  when observed, its host stamp. */
export type MqttScriptMarkItem = SessionScriptMarkItem<MqttScriptKind>;

export type MqttHookDigest = SessionHookDigest<MqttScriptKind>;
export type MqttScriptsDigest = SessionScriptsDigest<MqttScriptKind>;

/** The hook labels — the Scripts tab's rail vocabulary, verbatim. */
export const MQTT_HOOK_LABEL_KEY: Readonly<Record<MqttScriptKind, MessageKey>> = {
  'mqtt-before-connect': 'workbench.editors.request.scripts.mqttBeforeConnect',
  'mqtt-before-publish': 'workbench.editors.request.scripts.mqttBeforePublish',
  'mqtt-on-message': 'workbench.editors.request.scripts.mqttOnMessage',
  'mqtt-after-close': 'workbench.editors.request.scripts.mqttAfterClose',
};

/** What the MQTT pane hands the shared Scripts tag and view. */
export const MQTT_SCRIPTS_VOCABULARY: SessionScriptsVocabulary<MqttScriptKind> = {
  hookLabelKey: MQTT_HOOK_LABEL_KEY,
  closeHook: 'mqtt-after-close',
  testIdPrefix: 'mqtt',
  keys: {
    tag: 'workbench.editors.mqtt.session.scripts.tag',
    tagTitle: 'workbench.editors.mqtt.session.scripts.tagTitle',
    tagSummary: 'workbench.editors.mqtt.session.scripts.tagSummary',
    tagSummaryFailed: 'workbench.editors.mqtt.session.scripts.tagSummaryFailed',
    runs: 'workbench.editors.mqtt.session.scripts.runs',
    runsOne: 'workbench.editors.mqtt.session.scripts.runsOne',
    failed: 'workbench.editors.mqtt.session.scripts.failed',
    dropped: 'workbench.editors.mqtt.session.scripts.dropped',
    empty: 'workbench.editors.mqtt.session.scripts.empty',
    console: 'workbench.editors.mqtt.session.scripts.console',
    tests: 'workbench.editors.mqtt.session.scripts.tests',
    consoleEmpty: 'workbench.editors.mqtt.session.scripts.consoleEmpty',
    testsEmpty: 'workbench.editors.mqtt.session.scripts.testsEmpty',
    attempt: 'workbench.editors.mqtt.session.scripts.attempt',
    atMessage: 'workbench.editors.mqtt.session.scripts.atMessage',
    marksCapped: 'workbench.editors.mqtt.session.scripts.marksCapped',
  },
};

/** The `script` marks among the event log's items, in order, each
 *  with its log position and positional host stamp. */
export function scriptMarksOf(
  items: readonly MqttTimelineItem[],
  count: number,
  timestamps?: readonly number[],
): MqttScriptMarkItem[] {
  const marks: MqttScriptMarkItem[] = [];
  for (let i = 0; i < count; i++) {
    const item = items[i];
    if (item.kind !== 'script') continue;
    const atMs = timestamps?.[i];
    marks.push({ ...item, atIndex: i, ...(atMs !== undefined ? { atMs } : {}) });
  }
  return marks;
}

/** The live session's digest — off the marks the feed carried so far. */
export function digestFromMarks(marks: readonly MqttScriptMarkItem[]): MqttScriptsDigest {
  return digestFromSessionMarks(marks, MQTT_SCRIPT_KINDS);
}

/** The settled session's digest — off the snapshot's record, whose
 *  tallies outlive the mark cap (the record keeps the LAST dial's
 *  Before connect fold; the dial count is the runs). */
export function digestFromRecord(scripts: ExecutedMqttScripts): MqttScriptsDigest {
  const byHook = new Map<MqttScriptKind, MqttHookDigest>();
  if (scripts.beforeConnect !== undefined) {
    byHook.set(
      'mqtt-before-connect',
      foldDigest('mqtt-before-connect', scripts.beforeConnect, scripts.beforeConnect.dials),
    );
  }
  if (scripts.beforePublish !== undefined) {
    byHook.set(
      'mqtt-before-publish',
      summaryDigest('mqtt-before-publish', scripts.beforePublish, scripts.beforePublish.dropped),
    );
  }
  if (scripts.onMessage !== undefined) {
    byHook.set('mqtt-on-message', summaryDigest('mqtt-on-message', scripts.onMessage, 0));
  }
  if (scripts.afterClose !== undefined) {
    byHook.set('mqtt-after-close', foldDigest('mqtt-after-close', scripts.afterClose, 1));
  }
  return finishDigest(byHook, MQTT_SCRIPT_KINDS, scripts.marksCapped === true);
}
