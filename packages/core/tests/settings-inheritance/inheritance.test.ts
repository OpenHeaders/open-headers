/**
 * Settings inheritance — THE rule. Pins:
 *   - a request's own defined value wins, even one equal to the
 *     runtime default (explicit wins);
 *   - an absent knob reads the INNERMOST ancestor that sets it; a
 *     transparent level passes through; nobody = absent;
 *   - the result MERGES across levels, knob by knob;
 *   - the proxy trio is one unit under the level that sets the mode;
 *   - `sources` lists only the knobs an ancestor supplied, in key order;
 *   - a kind reads its own key list and nothing else;
 *   - an empty or undefined-valued record is transparent;
 *   - `settingUpdatesBetween` emits set / unset per changed knob only.
 */

import { describe, expect, it } from 'vitest';
import {
  effectiveKindSettingsFor,
  effectiveSettingsFor,
  inheritedSettingsFor,
  type SettingsCarrier,
  settingUpdatesBetween,
} from '../../src/settings-inheritance';
import type { InheritableSettings } from '../../src/types';

const collection = (settings?: InheritableSettings): SettingsCarrier => ({
  level: 'collection',
  uid: 'col00001',
  name: 'Payments',
  ...(settings !== undefined ? { settings } : {}),
});
const folder = (settings?: InheritableSettings, uid = 'fld00001'): SettingsCarrier => ({
  level: 'folder',
  uid,
  name: 'Cards',
  ...(settings !== undefined ? { settings } : {}),
});

const KEYS = ['timeoutMs', 'sslVerification', 'maxResponseBytes'] as const;

describe('effectiveSettingsFor — the cascade', () => {
  it("a request's own value wins outright", () => {
    const r = effectiveSettingsFor({ timeoutMs: 1_000 }, [collection({ timeoutMs: 30_000 })], KEYS);
    expect(r.settings).toEqual({ timeoutMs: 1_000 });
    expect(r.sources).toEqual([]);
  });

  it('an own value equal to the runtime default still wins — explicit wins', () => {
    const r = effectiveSettingsFor({ sslVerification: true }, [collection({ sslVerification: false })], KEYS);
    expect(r.settings.sslVerification).toBe(true);
    expect(r.sources).toEqual([]);
  });

  it('an absent knob reads the innermost ancestor that sets it', () => {
    const r = effectiveSettingsFor({}, [collection({ timeoutMs: 30_000 }), folder({ timeoutMs: 5_000 })], KEYS);
    expect(r.settings.timeoutMs).toBe(5_000);
    expect(r.sources).toEqual([{ key: 'timeoutMs', level: 'folder', uid: 'fld00001', name: 'Cards' }]);
  });

  it('a transparent folder passes through to the collection', () => {
    const r = effectiveSettingsFor({}, [collection({ timeoutMs: 30_000 }), folder(), folder({}, 'fld00002')], KEYS);
    expect(r.settings.timeoutMs).toBe(30_000);
    expect(r.sources[0]?.level).toBe('collection');
  });

  it('the result merges across levels, knob by knob', () => {
    const r = effectiveSettingsFor(
      { maxResponseBytes: 4_096 },
      [collection({ sslVerification: false, timeoutMs: 30_000 }), folder({ timeoutMs: 5_000 })],
      KEYS,
    );
    expect(r.settings).toEqual({ timeoutMs: 5_000, sslVerification: false, maxResponseBytes: 4_096 });
    expect(r.sources).toEqual([
      { key: 'timeoutMs', level: 'folder', uid: 'fld00001', name: 'Cards' },
      { key: 'sslVerification', level: 'collection', uid: 'col00001', name: 'Payments' },
    ]);
  });

  it('nobody sets it = absent, no source; an empty chain resolves to the own knobs', () => {
    expect(effectiveSettingsFor({}, [collection(), folder()], KEYS)).toEqual({ settings: {}, sources: [] });
    expect(effectiveSettingsFor({ timeoutMs: 1 }, [], KEYS)).toEqual({ settings: { timeoutMs: 1 }, sources: [] });
  });

  it('an empty record and an undefined-valued knob are transparent', () => {
    const r = effectiveSettingsFor(
      {},
      [collection({ timeoutMs: 30_000 }), folder({}), folder({ timeoutMs: undefined }, 'fld00002')],
      KEYS,
    );
    expect(r.settings.timeoutMs).toBe(30_000);
    expect(r.sources[0]?.level).toBe('collection');
  });

  it('only the asked keys resolve', () => {
    const r = effectiveSettingsFor({}, [collection({ timeoutMs: 30_000, cookieJar: true })], ['timeoutMs']);
    expect(r.settings).toEqual({ timeoutMs: 30_000 });
    expect(r.sources).toHaveLength(1);
  });
});

const PROXY_KEYS = ['proxyMode', 'proxyUrl', 'proxyCredentialRef', 'timeoutMs'] as const;

describe('effectiveSettingsFor — the proxy trio is one unit', () => {
  it('the level that sets the mode supplies the URL and the credential ref', () => {
    const r = effectiveSettingsFor(
      {},
      [collection({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080', proxyCredentialRef: 'proxy' })],
      PROXY_KEYS,
    );
    expect(r.settings).toEqual({
      proxyMode: 'url',
      proxyUrl: 'http://proxy.openheaders.io:8080',
      proxyCredentialRef: 'proxy',
    });
    expect(r.sources.map((s) => s.key)).toEqual(['proxyMode', 'proxyUrl', 'proxyCredentialRef']);
  });

  it("a folder's Direct shadows the collection's URL whole — never a mode from one level and a URL from another", () => {
    const r = effectiveSettingsFor(
      {},
      [
        collection({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080', proxyCredentialRef: 'proxy' }),
        folder({ proxyMode: 'direct' }),
      ],
      PROXY_KEYS,
    );
    expect(r.settings).toEqual({ proxyMode: 'direct' });
    expect(r.sources).toEqual([{ key: 'proxyMode', level: 'folder', uid: 'fld00001', name: 'Cards' }]);
  });

  it("the request's own mode owns the unit — an ancestor's credential ref never rides it", () => {
    const r = effectiveSettingsFor(
      { proxyMode: 'url', proxyUrl: 'http://own.openheaders.io:3128' },
      [collection({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080', proxyCredentialRef: 'proxy' })],
      PROXY_KEYS,
    );
    expect(r.settings).toEqual({ proxyMode: 'url', proxyUrl: 'http://own.openheaders.io:3128' });
    expect(r.sources).toEqual([]);
  });

  it('a level with a credential ref but no mode owns nothing', () => {
    const r = effectiveSettingsFor({}, [collection({ proxyCredentialRef: 'proxy', timeoutMs: 1_000 })], PROXY_KEYS);
    expect(r.settings).toEqual({ timeoutMs: 1_000 });
  });
});

describe('effectiveKindSettingsFor — the per-kind key list', () => {
  it('a session kind never reads an HTTP-only knob; a kind-only knob reaches its kind alone', () => {
    const chain = [collection({ httpVersion: '2', timeoutMs: 30_000, keepAlive: 30, maxMessageBytes: 4_096 })];
    expect(effectiveKindSettingsFor('mqtt', {}, chain).settings).toEqual({ timeoutMs: 30_000, keepAlive: 30 });
    expect(effectiveKindSettingsFor('websocket', {}, chain).settings).toEqual({
      timeoutMs: 30_000,
      maxMessageBytes: 4_096,
    });
    expect(effectiveKindSettingsFor('grpc', {}, chain).settings).toEqual({ timeoutMs: 30_000 });
    expect(effectiveKindSettingsFor('http', {}, chain).settings).toEqual({ httpVersion: '2', timeoutMs: 30_000 });
  });

  it("a request entity's own knobs ride as `own`", () => {
    const r = effectiveKindSettingsFor('http', { timeoutMs: 2_000, cookieJar: true }, [
      collection({ timeoutMs: 30_000 }),
    ]);
    expect(r.settings).toEqual({ timeoutMs: 2_000, cookieJar: true });
  });
});

describe('inheritedSettingsFor', () => {
  it('is the chain alone — what a surface shows as inherited placeholders', () => {
    const r = inheritedSettingsFor([collection({ timeoutMs: 30_000 }), folder({ sslVerification: false })], KEYS);
    expect(r.settings).toEqual({ timeoutMs: 30_000, sslVerification: false });
    expect(r.sources.map((s) => `${s.key}@${s.level}`)).toEqual(['timeoutMs@collection', 'sslVerification@folder']);
  });
});

describe('settingUpdatesBetween', () => {
  it('emits a set per changed knob, an unset per cleared knob, nothing for the unchanged', () => {
    const updates = settingUpdatesBetween(
      { timeoutMs: 1_000, cookieJar: true, sslVerification: false },
      { timeoutMs: 2_000, sslVerification: false, httpVersion: '2' },
    );
    expect(updates).toEqual([
      { key: 'httpVersion', value: '2' },
      { key: 'cookieJar', value: undefined },
      { key: 'timeoutMs', value: 2_000 },
    ]);
  });

  it('a first write against no record sets every defined knob; a no-op edit yields nothing', () => {
    expect(settingUpdatesBetween(undefined, { timeoutMs: 1_000 })).toEqual([{ key: 'timeoutMs', value: 1_000 }]);
    expect(settingUpdatesBetween({ timeoutMs: 1_000 }, { timeoutMs: 1_000 })).toEqual([]);
  });

  it('an explicit key list narrows the diff', () => {
    expect(settingUpdatesBetween({ timeoutMs: 1 }, { timeoutMs: 2, cookieJar: true }, ['cookieJar'])).toEqual([
      { key: 'cookieJar', value: true },
    ]);
  });
});
