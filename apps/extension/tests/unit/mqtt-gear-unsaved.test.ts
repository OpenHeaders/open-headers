/**
 * The MQTT gear popovers' per-knob readings — the neutral set on the
 * form shape (a knob off its default), the salmon reading on the
 * projection (knobs differing from the saved request, plus the
 * user-property rows by uid), per gear: the Message / Last Will
 * properties gear and the Topics row's options gear.
 */

import type { MqttMessageProperties, MqttTopicRow, MqttUserPropertyRow } from '@openheaders/core/types';
import { emptyMessagePropertiesDraft } from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import {
  modifiedMessagePropertyKeys,
  modifiedTopicOptionKeys,
  unsavedMessageProperties,
  unsavedTopicOptions,
  unsavedTopicOptionsByRow,
  unsavedUserPropertyRows,
  userPropertyRowModified,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-gear-unsaved';
import { describe, expect, it } from 'vitest';

const row = (overrides: Partial<MqttTopicRow> = {}): MqttTopicRow => ({
  uid: 'mqtp0001',
  topicFilter: 'sensors/+/temp',
  ...overrides,
});

const prop = (uid: string, key: string, value: string): MqttUserPropertyRow => ({ uid, key, value });

describe('user-property rows — the readings', () => {
  it('a row reads neutral once its key is written', () => {
    expect(userPropertyRowModified(prop('u1', '', 'x'))).toBe(false);
    expect(userPropertyRowModified(prop('u1', '  ', 'x'))).toBe(false);
    expect(userPropertyRowModified(prop('u1', 'trace', ''))).toBe(true);
  });

  it('a written row reads salmon while the saved list lacks it or holds it differently; a blank row never', () => {
    const saved = [prop('u1', 'trace', 'on'), prop('u2', 'env', 'prod')];
    expect([...unsavedUserPropertyRows(saved, saved)]).toEqual([]);
    expect([...unsavedUserPropertyRows([prop('u1', 'trace', 'off'), prop('u2', 'env', 'prod')], saved)]).toEqual([
      'u1',
    ]);
    expect([...unsavedUserPropertyRows([...saved, prop('u3', 'new', '1'), prop('u4', '', '')], saved)]).toEqual(['u3']);
    expect([...unsavedUserPropertyRows([prop('u1', 'trace', 'on')], undefined)]).toEqual(['u1']);
  });
});

describe('message properties gear — the readings', () => {
  it('the neutral set holds the knobs off their default; a user property counts once a key is written', () => {
    expect([...modifiedMessagePropertyKeys(emptyMessagePropertiesDraft())]).toEqual([]);
    const draft = {
      ...emptyMessagePropertiesDraft(),
      correlationData: 'ok',
      payloadFormatIndicator: true,
      userProperties: [prop('u1', ' ', 'x')],
    };
    expect([...modifiedMessagePropertyKeys(draft)]).toEqual(['correlationData', 'payloadFormatIndicator']);
    draft.userProperties = [prop('u1', 'trace', 'on')];
    expect(modifiedMessagePropertyKeys(draft).has('userProperties')).toBe(true);
  });

  it('the salmon knobs compare one by one against the saved block; an absent block is all defaults', () => {
    const saved: MqttMessageProperties = { correlationData: 'ok', messageExpiryInterval: 60 };
    expect([...unsavedMessageProperties(saved, saved).knobs]).toEqual([]);
    expect([...unsavedMessageProperties({ correlationData: 'ok' }, saved).knobs]).toEqual(['messageExpiryInterval']);
    expect([...unsavedMessageProperties(undefined, saved).knobs]).toEqual(['correlationData', 'messageExpiryInterval']);
    expect([...unsavedMessageProperties({ contentType: 'text/plain' }, undefined).knobs]).toEqual(['contentType']);
  });

  it('the user properties flag the section knob and name their rows', () => {
    const a: MqttMessageProperties = { userProperties: [prop('u1', 'trace', 'on'), prop('u2', 'env', 'prod')] };
    const b: MqttMessageProperties = { userProperties: [prop('u1', 'trace', 'off'), prop('u2', 'env', 'prod')] };
    const reading = unsavedMessageProperties(a, b);
    expect([...reading.knobs]).toEqual(['userProperties']);
    expect([...reading.rows]).toEqual(['u1']);
    const same = unsavedMessageProperties(a, { userProperties: [...(a.userProperties ?? [])] });
    expect(same.knobs.size + same.rows.size).toBe(0);
  });
});

describe('subscription options gear — the readings', () => {
  it('the neutral set holds the knobs off their default', () => {
    expect([...modifiedTopicOptionKeys(row())]).toEqual([]);
    expect([...modifiedTopicOptionKeys(row({ noLocal: false, retainHandling: 0 }))]).toEqual([]);
    expect([...modifiedTopicOptionKeys(row({ retainHandling: 2, subscriptionId: 7 }))]).toEqual([
      'retainHandling',
      'subscriptionId',
    ]);
  });

  it('the salmon knobs read a flag at its default on both sides, so explicit false equals absent', () => {
    expect([...unsavedTopicOptions(row({ noLocal: false }), row()).knobs]).toEqual([]);
    expect([...unsavedTopicOptions(row({ noLocal: true }), row()).knobs]).toEqual(['noLocal']);
    expect([...unsavedTopicOptions(row(), row({ retainHandling: 1, subscriptionId: 3 })).knobs]).toEqual([
      'retainHandling',
      'subscriptionId',
    ]);
  });

  it('a row the saved request lacks compares against all-default, keyed by uid; its user properties name their rows', () => {
    const drafts = [
      row({ uid: 'a', noLocal: true }),
      row({ uid: 'b', subscriptionId: 9, userProperties: [prop('u1', 'trace', 'on')] }),
      row({ uid: 'c' }),
    ];
    const saved = [row({ uid: 'a', noLocal: true })];
    const byRow = unsavedTopicOptionsByRow(drafts, saved);
    expect(byRow.has('a')).toBe(false);
    expect([...(byRow.get('b')?.knobs ?? [])]).toEqual(['subscriptionId', 'userProperties']);
    expect([...(byRow.get('b')?.rows ?? [])]).toEqual(['u1']);
    expect(byRow.has('c')).toBe(false);
  });
});
