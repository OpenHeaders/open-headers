/**
 * Script slot schemas — each record schema's keys ARE its kind list
 * (the literal objects cannot drift from the vocabulary), the
 * containers carry the whole session record, each session request its
 * own kind's, and a foreign kind's key is dropped rather than kept.
 */

import {
  CollectionSchema,
  FolderSchema,
  GrpcRequestSchema,
  GrpcScriptSlotsSchema,
  MqttRequestSchema,
  MqttScriptSlotsSchema,
  SessionScriptSlotsSchema,
  WebSocketRequestSchema,
  WsScriptSlotsSchema,
} from '@openheaders/core/schemas';
import { GRPC_SCRIPT_KINDS, MQTT_SCRIPT_KINDS, SESSION_SCRIPT_KINDS, WS_SCRIPT_KINDS } from '@openheaders/core/scripts';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

describe('the record schemas', () => {
  it('key exactly their kind lists', () => {
    expect(Object.keys(GrpcScriptSlotsSchema.entries)).toEqual([...GRPC_SCRIPT_KINDS]);
    expect(Object.keys(WsScriptSlotsSchema.entries)).toEqual([...WS_SCRIPT_KINDS]);
    expect(Object.keys(MqttScriptSlotsSchema.entries)).toEqual([...MQTT_SCRIPT_KINDS]);
    expect(Object.keys(SessionScriptSlotsSchema.entries)).toEqual([...SESSION_SCRIPT_KINDS]);
  });

  it('accept an empty record and any subset of string slots', () => {
    expect(v.parse(SessionScriptSlotsSchema, {})).toEqual({});
    expect(v.parse(WsScriptSlotsSchema, { 'ws-on-message': 'x' })).toEqual({ 'ws-on-message': 'x' });
    expect(() => v.parse(WsScriptSlotsSchema, { 'ws-on-message': 1 })).toThrow();
  });
});

const base = { schemaVersion: 5, uid: 'ent00001', path: 'requests/x-ent00001', name: 'X' };

describe('the carriers', () => {
  it('a collection and a folder carry the whole session record', () => {
    const scripts = { 'grpc-before-invoke': 'a', 'ws-on-message': 'b', 'mqtt-after-close': 'c' };
    expect(v.parse(CollectionSchema, { ...base, variables: [], scripts }).scripts).toEqual(scripts);
    expect(v.parse(FolderSchema, { ...base, scripts }).scripts).toEqual(scripts);
  });

  it('a session request carries its own kind and drops a foreign kind', () => {
    const ws = v.parse(WebSocketRequestSchema, {
      ...base,
      url: 'wss://events.openheaders.io/live',
      flavor: 'raw',
      subprotocols: [],
      headers: [],
      params: [],
      message: '',
      scripts: { 'ws-before-send': 'send();', 'mqtt-on-message': 'foreign();' },
    });
    expect(ws.scripts).toEqual({ 'ws-before-send': 'send();' });

    const grpc = v.parse(GrpcRequestSchema, {
      ...base,
      url: 'api.openheaders.io:443',
      message: '',
      metadata: [],
      scripts: { 'grpc-on-message': 'frame();' },
    });
    expect(grpc.scripts).toEqual({ 'grpc-on-message': 'frame();' });

    const mqtt = v.parse(MqttRequestSchema, {
      ...base,
      url: 'mqtt://broker.openheaders.io:1883',
      topic: '',
      payload: '',
      topics: [],
      savedMessages: [],
      userProperties: [],
      scripts: { 'mqtt-before-publish': 'publish();' },
    });
    expect(mqtt.scripts).toEqual({ 'mqtt-before-publish': 'publish();' });
  });
});
