/**
 * Script slots — the storage vocabulary: the kind lists, the sync leaf
 * and sibling file per kind (the HTTP pair frozen, every session kind
 * keyed by itself), the file → kind read, and the carrier helpers.
 */

import {
  GRPC_SCRIPT_KINDS,
  HTTP_SCRIPT_KINDS,
  hasScriptSlots,
  isSessionScriptKind,
  MQTT_SCRIPT_KINDS,
  presentScriptSlots,
  readScriptSlot,
  SCRIPT_KINDS,
  type ScriptSlotCarrier,
  SESSION_SCRIPT_KINDS,
  scriptKindOfFile,
  scriptSlotFile,
  scriptSlotPath,
  WS_SCRIPT_KINDS,
  withScriptSlot,
} from '@openheaders/core/scripts';
import { describe, expect, it } from 'vitest';

describe('the kind lists', () => {
  it('group by request kind and compose into one ordered vocabulary', () => {
    expect(HTTP_SCRIPT_KINDS).toEqual(['pre-request', 'post-response']);
    expect(GRPC_SCRIPT_KINDS).toEqual(['grpc-before-invoke', 'grpc-on-message', 'grpc-after-response']);
    expect(WS_SCRIPT_KINDS).toEqual(['ws-before-connect', 'ws-before-send', 'ws-on-message', 'ws-after-close']);
    expect(MQTT_SCRIPT_KINDS).toEqual([
      'mqtt-before-connect',
      'mqtt-before-publish',
      'mqtt-on-message',
      'mqtt-after-close',
    ]);
    expect(SESSION_SCRIPT_KINDS).toEqual([...GRPC_SCRIPT_KINDS, ...WS_SCRIPT_KINDS, ...MQTT_SCRIPT_KINDS]);
    expect(SCRIPT_KINDS).toEqual([...HTTP_SCRIPT_KINDS, ...SESSION_SCRIPT_KINDS]);
    expect(new Set(SCRIPT_KINDS).size).toBe(SCRIPT_KINDS.length);
  });

  it('tells the session kinds from the HTTP pair', () => {
    expect(isSessionScriptKind('pre-request')).toBe(false);
    expect(isSessionScriptKind('post-response')).toBe(false);
    for (const kind of SESSION_SCRIPT_KINDS) expect(isSessionScriptKind(kind)).toBe(true);
  });
});

describe('storage leaves and sibling files', () => {
  it('keeps the HTTP pair on its frozen fields and files', () => {
    expect(scriptSlotPath('pre-request')).toBe('preRequestScript');
    expect(scriptSlotPath('post-response')).toBe('postResponseScript');
    expect(scriptSlotFile('pre-request')).toBe('pre-request.js');
    expect(scriptSlotFile('post-response')).toBe('post-response.js');
  });

  it('keys every session kind by itself — a scripts leaf and a <kind>.js sibling', () => {
    for (const kind of SESSION_SCRIPT_KINDS) {
      expect(scriptSlotPath(kind)).toBe(`scripts.${kind}`);
      expect(scriptSlotFile(kind)).toBe(`${kind}.js`);
    }
  });

  it('reads a sibling file back to its kind and refuses any other file', () => {
    for (const kind of SCRIPT_KINDS) expect(scriptKindOfFile(scriptSlotFile(kind))).toBe(kind);
    expect(scriptKindOfFile('message.json')).toBeNull();
    expect(scriptKindOfFile('before-connect.js')).toBeNull();
    expect(scriptKindOfFile('ws-before-connect.ts')).toBeNull();
  });
});

describe('carrier helpers', () => {
  const carrier: ScriptSlotCarrier = {
    preRequestScript: 'pre();',
    scripts: { 'ws-before-connect': 'connect();', 'mqtt-on-message': '   ' },
  };

  it('reads a slot off either storage location', () => {
    expect(readScriptSlot(carrier, 'pre-request')).toBe('pre();');
    expect(readScriptSlot(carrier, 'post-response')).toBeUndefined();
    expect(readScriptSlot(carrier, 'ws-before-connect')).toBe('connect();');
    expect(readScriptSlot(carrier, 'grpc-on-message')).toBeUndefined();
    expect(readScriptSlot({}, 'ws-after-close')).toBeUndefined();
  });

  it('writes a slot into its storage location without touching the others', () => {
    const next = withScriptSlot(carrier, 'ws-after-close', 'close();');
    expect(next.scripts).toEqual({
      'ws-before-connect': 'connect();',
      'mqtt-on-message': '   ',
      'ws-after-close': 'close();',
    });
    expect(next.preRequestScript).toBe('pre();');
    expect(withScriptSlot(carrier, 'post-response', 'post();').postResponseScript).toBe('post();');
    expect(withScriptSlot({}, 'grpc-before-invoke', 'invoke();')).toEqual({
      scripts: { 'grpc-before-invoke': 'invoke();' },
    });
    expect(carrier.scripts).toEqual({ 'ws-before-connect': 'connect();', 'mqtt-on-message': '   ' });
  });

  it('lists the non-blank slots in kind order', () => {
    expect(presentScriptSlots(carrier)).toEqual([
      { kind: 'pre-request', source: 'pre();' },
      { kind: 'ws-before-connect', source: 'connect();' },
    ]);
    expect(presentScriptSlots({})).toEqual([]);
  });

  it('answers whether any non-blank slot of the given kinds is present', () => {
    expect(hasScriptSlots(carrier)).toBe(true);
    expect(hasScriptSlots(carrier, WS_SCRIPT_KINDS)).toBe(true);
    expect(hasScriptSlots(carrier, MQTT_SCRIPT_KINDS)).toBe(false);
    expect(hasScriptSlots(carrier, GRPC_SCRIPT_KINDS)).toBe(false);
    expect(hasScriptSlots({ scripts: { 'mqtt-on-message': ' ' } })).toBe(false);
  });
});
