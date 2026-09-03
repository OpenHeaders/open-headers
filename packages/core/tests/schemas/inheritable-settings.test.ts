/**
 * The inheritable settings schema. Pins:
 *   - the key list IS the object's key set, in its order;
 *   - every kind's list is inside the union; the request-only knobs
 *     (namespace, subprotocols, protocolVersion, clientId, lastWill,
 *     tls, authority) are outside it;
 *   - the request field schemas bound every knob; the proxy pair tie
 *     holds on the persisted shape;
 *   - a collection and a folder carry the record; an empty record and
 *     an undefined-valued knob read as transparent.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CollectionSchema, FolderSchema } from '../../src/schemas/collection';
import {
  definedSettingKeys,
  GRPC_INHERITABLE_SETTING_KEYS,
  HTTP_INHERITABLE_SETTING_KEYS,
  hasInheritableSettings,
  INHERITABLE_SETTING_KEYS,
  INHERITABLE_SETTING_KEYS_BY_KIND,
  InheritableSettingsObjectSchema,
  InheritableSettingsSchema,
  MQTT_INHERITABLE_SETTING_KEYS,
  WEBSOCKET_INHERITABLE_SETTING_KEYS,
} from '../../src/schemas/inheritable-settings';

const REQUEST_ONLY = ['namespace', 'subprotocols', 'protocolVersion', 'clientId', 'lastWill', 'tls', 'authority'];

describe('InheritableSettingsSchema — the vocabulary', () => {
  it('the key list is the object key set, in its order', () => {
    expect([...INHERITABLE_SETTING_KEYS]).toEqual(Object.keys(InheritableSettingsObjectSchema.entries));
  });

  it("every kind's list is inside the union and the request-only knobs are outside it", () => {
    const union = new Set<string>(INHERITABLE_SETTING_KEYS);
    for (const list of [
      HTTP_INHERITABLE_SETTING_KEYS,
      WEBSOCKET_INHERITABLE_SETTING_KEYS,
      MQTT_INHERITABLE_SETTING_KEYS,
      GRPC_INHERITABLE_SETTING_KEYS,
    ]) {
      for (const key of list) expect(union.has(key)).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
    for (const key of REQUEST_ONLY) expect(union.has(key)).toBe(false);
    expect(INHERITABLE_SETTING_KEYS_BY_KIND.http).toBe(HTTP_INHERITABLE_SETTING_KEYS);
    expect(INHERITABLE_SETTING_KEYS_BY_KIND.mqtt).toBe(MQTT_INHERITABLE_SETTING_KEYS);
  });

  it('every knob is reachable from at least one kind', () => {
    const reached = new Set<string>([
      ...HTTP_INHERITABLE_SETTING_KEYS,
      ...WEBSOCKET_INHERITABLE_SETTING_KEYS,
      ...MQTT_INHERITABLE_SETTING_KEYS,
      ...GRPC_INHERITABLE_SETTING_KEYS,
    ]);
    for (const key of INHERITABLE_SETTING_KEYS) expect(reached.has(key)).toBe(true);
  });
});

describe('InheritableSettingsSchema — validation', () => {
  it('accepts a record of knobs under the request field bounds', () => {
    const out = v.parse(InheritableSettingsSchema, {
      timeoutMs: 30_000,
      sslVerification: false,
      tlsMinVersion: '1.3',
      keepAlive: 30,
      socketioProtocol: 4,
      proxyMode: 'url',
      proxyUrl: 'socks5://proxy.openheaders.io:1080',
    });
    expect(out.timeoutMs).toBe(30_000);
    expect(out.socketioProtocol).toBe(4);
  });

  it('rejects a knob outside its request bound', () => {
    expect(v.safeParse(InheritableSettingsSchema, { timeoutMs: 10 }).success).toBe(false);
    expect(v.safeParse(InheritableSettingsSchema, { keepAlive: 70_000 }).success).toBe(false);
    expect(v.safeParse(InheritableSettingsSchema, { resolveToAddress: 'not-an-ip' }).success).toBe(false);
    expect(v.safeParse(InheritableSettingsSchema, { proxyUrl: 'http://user:pw@proxy.openheaders.io' }).success).toBe(
      false,
    );
  });

  it('the proxy pair tie holds on the persisted shape, not the object shape', () => {
    expect(v.safeParse(InheritableSettingsSchema, { proxyMode: 'url' }).success).toBe(false);
    expect(
      v.safeParse(InheritableSettingsSchema, { proxyMode: 'direct', proxyUrl: 'http://p.openheaders.io' }).success,
    ).toBe(false);
    expect(v.safeParse(InheritableSettingsSchema, { proxyUrl: 'http://p.openheaders.io' }).success).toBe(false);
    expect(v.safeParse(InheritableSettingsObjectSchema, { proxyMode: 'url' }).success).toBe(true);
  });

  it('a collection and a folder carry the record', () => {
    const collection = v.parse(CollectionSchema, {
      schemaVersion: 5,
      uid: 'rcol0001',
      path: 'requests/api-rcol0001',
      name: 'API',
      variables: [],
      settings: { timeoutMs: 30_000, cookieJar: true },
    });
    expect(collection.settings).toEqual({ timeoutMs: 30_000, cookieJar: true });
    const folder = v.parse(FolderSchema, {
      schemaVersion: 5,
      uid: 'rfold001',
      path: 'requests/api-rcol0001/auth-rfold001',
      name: 'Auth',
      settings: { sslVerification: false },
    });
    expect(folder.settings).toEqual({ sslVerification: false });
    expect(v.safeParse(FolderSchema, { ...folder, settings: { timeoutMs: 1 } }).success).toBe(false);
  });
});

describe('definedSettingKeys / hasInheritableSettings', () => {
  it('lists defined knobs in key order; an empty or undefined-valued record is transparent', () => {
    expect(definedSettingKeys({ cookieJar: true, timeoutMs: 1_000, httpVersion: undefined })).toEqual([
      'cookieJar',
      'timeoutMs',
    ]);
    expect(hasInheritableSettings(undefined)).toBe(false);
    expect(hasInheritableSettings({})).toBe(false);
    expect(hasInheritableSettings({ timeoutMs: undefined })).toBe(false);
    expect(hasInheritableSettings({ timeoutMs: 1_000 })).toBe(true);
  });
});
