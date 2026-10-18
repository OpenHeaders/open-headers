/**
 * Per-knob readings behind the MQTT gear popovers' row dots — the
 * Settings tab's `mqtt-settings-unsaved.ts` for the Message / Last Will
 * properties gear and the Topics row's options gear. Two orthogonal
 * facts, one dot per row, the S6 palette:
 *   • neutral — the knob holds a value off its default (a fact: "what
 *     did I set here"), read on the FORM shape the popover edits;
 *   • salmon — the knob differs from the SAVED request (this knob's
 *     slice of why Save is dirty), read on the same projection the
 *     dirty fingerprint and the tab tones use, so they never disagree;
 *     salmon wins while both hold.
 * A user-property ROW reads the same way by its uid: neutral once its
 * key is written, salmon while the saved request lacks the row or holds
 * it differently (a blank row is in neither set — the projection trims
 * it, so Save never dirties on it). The gear's own badge wears the
 * stronger of its rows' tones; no gear ever wears red (red is the
 * unresolved tier, which MQTT has none of).
 */

import type { MqttMessageProperties, MqttTopicRow, MqttUserPropertyRow } from '@openheaders/core/types';
import { stableStringify } from '@openheaders/ui/shared/forms';
import type { MqttMessagePropertiesDraft } from './draft';

/** One gear's unsaved reading: its knobs and its user-property rows
 *  (by uid) that differ from the saved request. */
export interface GearUnsaved<K extends string> {
  knobs: ReadonlySet<K>;
  rows: ReadonlySet<string>;
}

const writtenRows = (rows: readonly MqttUserPropertyRow[] | undefined): MqttUserPropertyRow[] =>
  (rows ?? []).filter((row) => row.key.trim() !== '');

/** True once the row's key is written — the row's neutral dot. */
export const userPropertyRowModified = (row: MqttUserPropertyRow): boolean => row.key.trim() !== '';

/** The written draft rows the saved list lacks or holds differently,
 *  matched by uid — the rows' salmon dots. */
export function unsavedUserPropertyRows(
  draft: readonly MqttUserPropertyRow[] | undefined,
  saved: readonly MqttUserPropertyRow[] | undefined,
): ReadonlySet<string> {
  const savedByUid = new Map(writtenRows(saved).map((row) => [row.uid, row]));
  const out = new Set<string>();
  for (const row of writtenRows(draft)) {
    const twin = savedByUid.get(row.uid);
    if (twin === undefined || stableStringify(row) !== stableStringify(twin)) out.add(row.uid);
  }
  return out;
}

// ── The properties gear (Message bar, Last Will bar) ────────────────

export const MESSAGE_PROPERTY_KNOB_KEYS = [
  'responseTopic',
  'correlationData',
  'messageExpiryInterval',
  'contentType',
  'payloadFormatIndicator',
  'userProperties',
] as const;

export type MessagePropertyKnobKey = (typeof MESSAGE_PROPERTY_KNOB_KEYS)[number];

export type MessagePropertiesUnsaved = GearUnsaved<MessagePropertyKnobKey>;

/** Knobs off their default on the form — the neutral dots. The user
 *  properties count once any key is written. */
export function modifiedMessagePropertyKeys(draft: MqttMessagePropertiesDraft): ReadonlySet<MessagePropertyKnobKey> {
  const out = new Set<MessagePropertyKnobKey>();
  if (draft.responseTopic !== '') out.add('responseTopic');
  if (draft.correlationData !== '') out.add('correlationData');
  if (draft.messageExpiryInterval !== undefined) out.add('messageExpiryInterval');
  if (draft.contentType !== '') out.add('contentType');
  if (draft.payloadFormatIndicator) out.add('payloadFormatIndicator');
  if (writtenRows(draft.userProperties).length > 0) out.add('userProperties');
  return out;
}

/** Knobs whose projected value differs from the saved block's — the
 *  salmon dots — plus the rows. Either block absent reads as every
 *  knob at its default, so a block typed before the first save dots
 *  salmon field by field and a cleared saved block does the same. */
export function unsavedMessageProperties(
  draft: MqttMessageProperties | undefined,
  saved: MqttMessageProperties | undefined,
): MessagePropertiesUnsaved {
  const knobs = new Set<MessagePropertyKnobKey>();
  if (draft?.responseTopic !== saved?.responseTopic) knobs.add('responseTopic');
  if (draft?.correlationData !== saved?.correlationData) knobs.add('correlationData');
  if (draft?.messageExpiryInterval !== saved?.messageExpiryInterval) knobs.add('messageExpiryInterval');
  if (draft?.contentType !== saved?.contentType) knobs.add('contentType');
  if (draft?.payloadFormatIndicator !== saved?.payloadFormatIndicator) knobs.add('payloadFormatIndicator');
  if (stableStringify(writtenRows(draft?.userProperties)) !== stableStringify(writtenRows(saved?.userProperties))) {
    knobs.add('userProperties');
  }
  return { knobs, rows: unsavedUserPropertyRows(draft?.userProperties, saved?.userProperties) };
}

// ── The subscription options gear (Topics row) ──────────────────────

export const TOPIC_OPTION_KNOB_KEYS = [
  'noLocal',
  'retainAsPublished',
  'retainHandling',
  'subscriptionId',
  'userProperties',
] as const;

export type TopicOptionKnobKey = (typeof TOPIC_OPTION_KNOB_KEYS)[number];

export type TopicOptionsUnsaved = GearUnsaved<TopicOptionKnobKey>;

/** Knobs off their default on the row — the neutral dots. */
export function modifiedTopicOptionKeys(row: MqttTopicRow): ReadonlySet<TopicOptionKnobKey> {
  const out = new Set<TopicOptionKnobKey>();
  if (row.noLocal === true) out.add('noLocal');
  if (row.retainAsPublished === true) out.add('retainAsPublished');
  if (row.retainHandling !== undefined && row.retainHandling !== 0) out.add('retainHandling');
  if (row.subscriptionId !== undefined) out.add('subscriptionId');
  if (writtenRows(row.userProperties).length > 0) out.add('userProperties');
  return out;
}

/** Knobs whose value differs between the draft row and its saved twin
 *  (matched by uid; a row the saved request lacks compares against
 *  all-default, so a new row's set values dot salmon), plus the rows.
 *  Flags compare at their spec default so an explicit `false` and an
 *  absent flag read the same. */
export function unsavedTopicOptions(draft: MqttTopicRow, saved: MqttTopicRow | undefined): TopicOptionsUnsaved {
  const knobs = new Set<TopicOptionKnobKey>();
  if ((draft.noLocal ?? false) !== (saved?.noLocal ?? false)) knobs.add('noLocal');
  if ((draft.retainAsPublished ?? false) !== (saved?.retainAsPublished ?? false)) knobs.add('retainAsPublished');
  if ((draft.retainHandling ?? 0) !== (saved?.retainHandling ?? 0)) knobs.add('retainHandling');
  if (draft.subscriptionId !== saved?.subscriptionId) knobs.add('subscriptionId');
  if (stableStringify(writtenRows(draft.userProperties)) !== stableStringify(writtenRows(saved?.userProperties))) {
    knobs.add('userProperties');
  }
  return { knobs, rows: unsavedUserPropertyRows(draft.userProperties, saved?.userProperties) };
}

/** Every draft row's unsaved reading, keyed by uid — the Topics tab
 *  hands each gear its own; a clean row has no entry. */
export function unsavedTopicOptionsByRow(
  draftRows: readonly MqttTopicRow[],
  savedRows: readonly MqttTopicRow[],
): ReadonlyMap<string, TopicOptionsUnsaved> {
  const savedByUid = new Map(savedRows.map((row) => [row.uid, row]));
  const out = new Map<string, TopicOptionsUnsaved>();
  for (const row of draftRows) {
    const reading = unsavedTopicOptions(row, savedByUid.get(row.uid));
    if (reading.knobs.size > 0 || reading.rows.size > 0) out.set(row.uid, reading);
  }
  return out;
}
