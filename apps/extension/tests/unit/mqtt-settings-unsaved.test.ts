/**
 * Per-knob unsaved-vs-saved comparison (mqtt-settings-unsaved.ts) —
 * the saved side of the MQTT Settings tab's salmon dots. The knob set
 * is core's inheritable MQTT keys plus the two request-only rows; the
 * comparison runs on the raw projection values, so a knob cleared back
 * to inherit still reads unsaved until the save echoes.
 */

import { MQTT_INHERITABLE_SETTING_KEYS } from '@openheaders/core/schemas';
import type { MqttRequest } from '@openheaders/core/types';
import {
  buildMqttRequestUpdates,
  draftFromMqttRequest,
  type MqttDraft,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import {
  anyOwnMqttSetting,
  MQTT_SETTINGS_KNOB_KEYS,
  unsavedMqttSettingKeys,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/mqtt-settings-unsaved';
import { describe, expect, it } from 'vitest';

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: '',
  topics: [],
  savedMessages: [],
  userProperties: [],
  ...overrides,
});

const updates = (overrides: Partial<MqttDraft> = {}) =>
  buildMqttRequestUpdates({ ...draftFromMqttRequest(mqttRequest()), ...overrides });

describe('unsavedMqttSettingKeys', () => {
  it('the knob set is the inheritable keys plus the client id and the execution place', () => {
    expect(MQTT_SETTINGS_KNOB_KEYS).toEqual([...MQTT_INHERITABLE_SETTING_KEYS, 'clientId', 'executionPlace']);
  });

  it('reports no knob while draft and saved agree, own values included', () => {
    expect(unsavedMqttSettingKeys(updates(), updates()).size).toBe(0);
    const own: Partial<MqttDraft> = { keepAlive: 30, cleanStart: false, clientId: 'lamp-1', executionPlace: 'here' };
    expect(unsavedMqttSettingKeys(updates(own), updates(own)).size).toBe(0);
  });

  it('flags exactly the knobs that differ', () => {
    const keys = unsavedMqttSettingKeys(updates({ keepAlive: 30, sslVerification: false }), updates());
    expect([...keys]).toEqual(['sslVerification', 'keepAlive']);
  });

  it('flags the request-only rows — the client id on the string plane, the execution place', () => {
    expect([...unsavedMqttSettingKeys(updates({ clientId: 'lamp-1' }), updates())]).toEqual(['clientId']);
    // '' on both sides is the same (no client id) — never a phantom dot.
    expect(unsavedMqttSettingKeys(updates({ clientId: '' }), updates({ clientId: '' })).size).toBe(0);
    expect([...unsavedMqttSettingKeys(updates({ executionPlace: 'here' }), updates())]).toEqual(['executionPlace']);
  });

  it('a knob cleared back to inherit stays unsaved until the save echoes', () => {
    expect([...unsavedMqttSettingKeys(updates(), updates({ timeoutMs: 5_000 }))]).toEqual(['timeoutMs']);
    expect([...unsavedMqttSettingKeys(updates(), updates({ cleanStart: true }))]).toEqual(['cleanStart']);
  });
});

describe('anyOwnMqttSetting', () => {
  it('reads an own value on any knob — explicit wins, the client id once non-empty', () => {
    expect(anyOwnMqttSetting(updates())).toBe(false);
    expect(anyOwnMqttSetting(updates({ clientId: '' }))).toBe(false);
    expect(anyOwnMqttSetting(updates({ clientId: 'lamp-1' }))).toBe(true);
    expect(anyOwnMqttSetting(updates({ cleanStart: true }))).toBe(true);
    expect(anyOwnMqttSetting(updates({ executionPlace: 'here' }))).toBe(true);
  });
});
