/**
 * Per-section unsaved-vs-saved comparison (mqtt-section-unsaved.ts) —
 * the saved side of the MQTT editor's tab labels' dirty (salmon) tones.
 * Sections slice the same projection the derived-dirty fingerprint
 * uses, so a flagged section is exactly a reason the Save button is
 * dirty.
 */

import type { MqttRequest } from '@openheaders/core/types';
import {
  buildMqttRequestUpdates,
  draftFromMqttRequest,
  type MqttDraft,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import {
  anyMqttScriptUnsaved,
  NO_UNSAVED_MQTT_SECTIONS,
  unsavedMqttSections,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-section-unsaved';
import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import { describe, expect, it } from 'vitest';

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: '{"lumens": 1200}',
  topics: [],
  savedMessages: [],
  userProperties: [],
  ...overrides,
});

const baseDraft = (): MqttDraft => draftFromMqttRequest(mqttRequest());
const updates = (overrides: Partial<MqttDraft> = {}) => buildMqttRequestUpdates({ ...baseDraft(), ...overrides });

describe('unsavedMqttSections', () => {
  it('reports all sections clean while draft and saved agree', () => {
    expect(unsavedMqttSections(updates(), updates())).toEqual(NO_UNSAVED_MQTT_SECTIONS);
    const rich: Partial<MqttDraft> = {
      description: 'notes',
      payload: '{"lumens": 900}',
      auth: { type: 'basic', username: 'john', password: 'doe' },
      scripts: { 'mqtt-before-connect': 'oh.log(1)' },
    };
    expect(unsavedMqttSections(updates(rich), updates(rich))).toEqual(NO_UNSAVED_MQTT_SECTIONS);
  });

  it('flags only the section that changed', () => {
    expect(unsavedMqttSections(updates({ description: 'notes' }), updates())).toEqual({
      ...NO_UNSAVED_MQTT_SECTIONS,
      docs: true,
    });
    expect(
      unsavedMqttSections(updates({ auth: { type: 'basic', username: 'john', password: '' } }), updates()),
    ).toEqual({ ...NO_UNSAVED_MQTT_SECTIONS, auth: true });
    const will = { ...baseDraft().lastWill, topic: 'status/offline' };
    expect(unsavedMqttSections(updates({ lastWill: will }), updates())).toEqual({
      ...NO_UNSAVED_MQTT_SECTIONS,
      lastWill: true,
    });
  });

  it('the Message slice covers the compose block and the saved-messages rail', () => {
    expect(unsavedMqttSections(updates({ qos: 1 }), updates())).toEqual({ ...NO_UNSAVED_MQTT_SECTIONS, message: true });
    expect(unsavedMqttSections(updates({ retain: true }), updates())).toEqual({
      ...NO_UNSAVED_MQTT_SECTIONS,
      message: true,
    });
    const row = { uid: 'mqsm0001', name: 'Dim', topic: 'streetlights/1/dim', payload: '{"level": 30}' };
    expect(unsavedMqttSections(updates({ savedMessages: [row] }), updates())).toEqual({
      ...NO_UNSAVED_MQTT_SECTIONS,
      message: true,
    });
  });

  it('flags the grids on row edits, including row removal, and never on the trailing ghost', () => {
    const withTopic = updates({ topics: [{ uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 1 }] });
    expect(unsavedMqttSections(withTopic, updates())).toEqual({ ...NO_UNSAVED_MQTT_SECTIONS, topics: true });
    // Removal is unsaved too — the section can be dirty with zero rows.
    expect(unsavedMqttSections(updates(), withTopic)).toEqual({ ...NO_UNSAVED_MQTT_SECTIONS, topics: true });
    // The grid's unfilled ghost row trims away in the projection.
    const ghost = updates({ topics: [{ uid: 'mqtp0002', topicFilter: '' }] });
    expect(unsavedMqttSections(ghost, updates())).toEqual(NO_UNSAVED_MQTT_SECTIONS);

    const property = makeKvRow({ key: 'x-tenant', value: 'openheaders', description: '', enabled: true });
    expect(unsavedMqttSections(updates({ userProperties: [property] }), updates())).toEqual({
      ...NO_UNSAVED_MQTT_SECTIONS,
      properties: true,
    });
  });

  it('flags each script slot independently, an emptied slot included', () => {
    const before = unsavedMqttSections(updates({ scripts: { 'mqtt-before-connect': 'oh.log(1)' } }), updates());
    expect(before.scripts).toEqual({ 'mqtt-before-connect': true });
    expect(anyMqttScriptUnsaved(before.scripts)).toBe(true);
    const emptied = unsavedMqttSections(
      updates({ scripts: { 'mqtt-on-message': '' } }),
      updates({ scripts: { 'mqtt-on-message': 'oh.log(2)' } }),
    );
    expect(emptied.scripts).toEqual({ 'mqtt-on-message': true });
    // A blank slot against an absent one is the same projection.
    const blank = unsavedMqttSections(updates({ scripts: { 'mqtt-after-close': '   ' } }), updates());
    expect(blank.scripts).toEqual({});
    expect(anyMqttScriptUnsaved(blank.scripts)).toBe(false);
  });

  it('leaves the target row and the spec link to the fingerprint alone', () => {
    expect(unsavedMqttSections(updates({ url: 'mqtts://broker.openheaders.io:8883' }), updates())).toEqual(
      NO_UNSAVED_MQTT_SECTIONS,
    );
    expect(unsavedMqttSections(updates({ protocolVersion: '3.1.1' }), updates())).toEqual(NO_UNSAVED_MQTT_SECTIONS);
    expect(unsavedMqttSections(updates({ specLink: { specUid: 'spec0001' } }), updates())).toEqual(
      NO_UNSAVED_MQTT_SECTIONS,
    );
  });
});
