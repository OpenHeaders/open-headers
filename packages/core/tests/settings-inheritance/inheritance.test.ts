/**
 * Settings inheritance — THE rule. Pins:
 *   - a request's own defined value wins, even one equal to the
 *     runtime default (explicit wins);
 *   - an absent knob reads the INNERMOST ancestor whose slice of the
 *     kind sets it; a transparent level passes through; nobody = absent;
 *   - the result MERGES across levels, knob by knob;
 *   - a slice never reaches another kind (the per-kind law);
 *   - the proxy trio is one unit under the level that sets the mode;
 *   - `sources` lists only the knobs an ancestor supplied, in key order;
 *   - an empty record, an empty slice and an undefined-valued knob are
 *     transparent;
 *   - `settingProvenanceFor` lists every level's value outer → inner;
 *   - `settingUpdatesBetween` emits set / unset per changed knob only,
 *     each on its kind.
 */

import { describe, expect, it } from 'vitest';
import {
  effectiveSettingsFor,
  inheritedSettingsFor,
  type SettingsCarrier,
  settingProvenanceFor,
  settingUpdatesBetween,
} from '../../src/settings-inheritance';
import type { ContainerSettings } from '../../src/types';

const collection = (settings?: ContainerSettings): SettingsCarrier => ({
  level: 'collection',
  uid: 'col00001',
  name: 'Payments',
  ...(settings !== undefined ? { settings } : {}),
});
const folder = (settings?: ContainerSettings, uid = 'fld00001'): SettingsCarrier => ({
  level: 'folder',
  uid,
  name: 'Cards',
  ...(settings !== undefined ? { settings } : {}),
});

describe('effectiveSettingsFor — the cascade', () => {
  it("a request's own value wins outright", () => {
    const r = effectiveSettingsFor('http', { timeoutMs: 1_000 }, [collection({ http: { timeoutMs: 30_000 } })]);
    expect(r.settings).toEqual({ timeoutMs: 1_000 });
    expect(r.sources).toEqual([]);
  });

  it('an own value equal to the runtime default still wins — explicit wins', () => {
    const r = effectiveSettingsFor('http', { sslVerification: true }, [
      collection({ http: { sslVerification: false } }),
    ]);
    expect(r.settings.sslVerification).toBe(true);
    expect(r.sources).toEqual([]);
  });

  it('an absent knob reads the innermost ancestor that sets it', () => {
    const r = effectiveSettingsFor('http', {}, [
      collection({ http: { timeoutMs: 30_000 } }),
      folder({ http: { timeoutMs: 5_000 } }),
    ]);
    expect(r.settings.timeoutMs).toBe(5_000);
    expect(r.sources).toEqual([{ key: 'timeoutMs', level: 'folder', uid: 'fld00001', name: 'Cards' }]);
  });

  it('a transparent folder passes through to the collection', () => {
    const r = effectiveSettingsFor('http', {}, [
      collection({ http: { timeoutMs: 30_000 } }),
      folder(),
      folder({}, 'fld00002'),
    ]);
    expect(r.settings.timeoutMs).toBe(30_000);
    expect(r.sources[0]?.level).toBe('collection');
  });

  it('the result merges across levels, knob by knob', () => {
    const r = effectiveSettingsFor('http', { maxResponseBytes: 4_096 }, [
      collection({ http: { sslVerification: false, timeoutMs: 30_000 } }),
      folder({ http: { timeoutMs: 5_000 } }),
    ]);
    expect(r.settings).toEqual({ timeoutMs: 5_000, sslVerification: false, maxResponseBytes: 4_096 });
    expect(r.sources).toEqual([
      { key: 'sslVerification', level: 'collection', uid: 'col00001', name: 'Payments' },
      { key: 'timeoutMs', level: 'folder', uid: 'fld00001', name: 'Cards' },
    ]);
  });

  it('nobody sets it = absent, no source; an empty chain resolves to the own knobs', () => {
    expect(effectiveSettingsFor('http', {}, [collection(), folder()])).toEqual({ settings: {}, sources: [] });
    expect(effectiveSettingsFor('http', { timeoutMs: 1 }, [])).toEqual({ settings: { timeoutMs: 1 }, sources: [] });
  });

  it('an empty record, an empty slice and an undefined-valued knob are transparent', () => {
    const r = effectiveSettingsFor('http', {}, [
      collection({ http: { timeoutMs: 30_000 } }),
      folder({}),
      folder({ http: {} }, 'fld00002'),
      folder({ http: { timeoutMs: undefined } }, 'fld00003'),
    ]);
    expect(r.settings.timeoutMs).toBe(30_000);
    expect(r.sources[0]?.level).toBe('collection');
  });
});

describe('effectiveSettingsFor — the per-kind law', () => {
  it("a kind reads its own slice alone — the HTTP slice's TLS floor never reaches a session", () => {
    const chain = [
      collection({
        http: { tlsMinVersion: '1.3', timeoutMs: 30_000 },
        websocket: { timeoutMs: 5_000, maxMessageBytes: 4_096 },
        mqtt: { keepAlive: 30 },
      }),
    ];
    expect(effectiveSettingsFor('http', {}, chain).settings).toEqual({ tlsMinVersion: '1.3', timeoutMs: 30_000 });
    expect(effectiveSettingsFor('websocket', {}, chain).settings).toEqual({ timeoutMs: 5_000, maxMessageBytes: 4_096 });
    expect(effectiveSettingsFor('mqtt', {}, chain).settings).toEqual({ keepAlive: 30 });
    expect(effectiveSettingsFor('grpc', {}, chain)).toEqual({ settings: {}, sources: [] });
  });

  it("a folder's slice of one kind never shadows the collection's slice of another", () => {
    const chain = [collection({ http: { timeoutMs: 30_000 } }), folder({ websocket: { timeoutMs: 5_000 } })];
    expect(effectiveSettingsFor('http', {}, chain).sources[0]?.level).toBe('collection');
    expect(effectiveSettingsFor('websocket', {}, chain).sources[0]?.level).toBe('folder');
  });

  it("a request entity's own knobs ride as `own`", () => {
    const r = effectiveSettingsFor('http', { timeoutMs: 2_000, cookieJar: true }, [
      collection({ http: { timeoutMs: 30_000 } }),
    ]);
    expect(r.settings).toEqual({ timeoutMs: 2_000, cookieJar: true });
  });
});

describe('effectiveSettingsFor — the proxy trio is one unit', () => {
  const proxied = {
    proxyMode: 'url',
    proxyUrl: 'http://proxy.openheaders.io:8080',
    proxyCredentialRef: 'proxy',
  } as const;

  it('the level that sets the mode supplies the URL and the credential ref', () => {
    const r = effectiveSettingsFor('http', {}, [collection({ http: proxied })]);
    expect(r.settings).toEqual(proxied);
    expect(r.sources.map((s) => s.key)).toEqual(['proxyMode', 'proxyUrl', 'proxyCredentialRef']);
  });

  it("a folder's Direct shadows the collection's URL whole — never a mode from one level and a URL from another", () => {
    const r = effectiveSettingsFor('http', {}, [
      collection({ http: proxied }),
      folder({ http: { proxyMode: 'direct' } }),
    ]);
    expect(r.settings).toEqual({ proxyMode: 'direct' });
    expect(r.sources).toEqual([{ key: 'proxyMode', level: 'folder', uid: 'fld00001', name: 'Cards' }]);
  });

  it("the request's own mode owns the unit — an ancestor's credential ref never rides it", () => {
    const r = effectiveSettingsFor('http', { proxyMode: 'url', proxyUrl: 'http://own.openheaders.io:3128' }, [
      collection({ http: proxied }),
    ]);
    expect(r.settings).toEqual({ proxyMode: 'url', proxyUrl: 'http://own.openheaders.io:3128' });
    expect(r.sources).toEqual([]);
  });

  it('a level with a credential ref but no mode owns nothing', () => {
    const r = effectiveSettingsFor('http', {}, [
      collection({ http: { proxyCredentialRef: 'proxy', timeoutMs: 1_000 } }),
    ]);
    expect(r.settings).toEqual({ timeoutMs: 1_000 });
  });
});

describe('inheritedSettingsFor', () => {
  it('is the chain alone — what a surface shows as inherited placeholders', () => {
    const r = inheritedSettingsFor('http', [
      collection({ http: { timeoutMs: 30_000 } }),
      folder({ http: { sslVerification: false } }),
    ]);
    expect(r.settings).toEqual({ timeoutMs: 30_000, sslVerification: false });
    expect(r.sources.map((s) => `${s.key}@${s.level}`)).toEqual(['sslVerification@folder', 'timeoutMs@collection']);
  });
});

describe('settingProvenanceFor — every level, outer → inner', () => {
  it('lists each level that sets a knob with its value; a knob nobody sets is absent', () => {
    const p = settingProvenanceFor('http', [
      collection({ http: { tlsMinVersion: '1.3', timeoutMs: 30_000 } }),
      folder({ http: { tlsMinVersion: '1.2' } }),
      folder({}, 'fld00002'),
    ]);
    expect(p.tlsMinVersion).toEqual([
      { key: 'tlsMinVersion', level: 'collection', uid: 'col00001', name: 'Payments', value: '1.3' },
      { key: 'tlsMinVersion', level: 'folder', uid: 'fld00001', name: 'Cards', value: '1.2' },
    ]);
    expect(p.timeoutMs).toEqual([
      { key: 'timeoutMs', level: 'collection', uid: 'col00001', name: 'Payments', value: 30_000 },
    ]);
    expect(p.sslVerification).toBeUndefined();
  });

  it('reads the kind alone', () => {
    const p = settingProvenanceFor('websocket', [
      collection({ http: { timeoutMs: 30_000 }, websocket: { timeoutMs: 5_000 } }),
    ]);
    expect(p.timeoutMs?.map((l) => l.value)).toEqual([5_000]);
  });

  it('a proxy knob counts through the unit — a level without the mode lists nothing for it', () => {
    const p = settingProvenanceFor('http', [
      collection({ http: { proxyCredentialRef: 'proxy' } }),
      folder({ http: { proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080' } }),
    ]);
    expect(p.proxyCredentialRef).toBeUndefined();
    expect(p.proxyMode?.map((l) => l.level)).toEqual(['folder']);
    expect(p.proxyUrl?.map((l) => l.value)).toEqual(['http://proxy.openheaders.io:8080']);
  });
});

describe('settingUpdatesBetween', () => {
  it('emits a set per changed knob, an unset per cleared knob, nothing for the unchanged — each on its kind', () => {
    const updates = settingUpdatesBetween(
      { http: { timeoutMs: 1_000, cookieJar: true, sslVerification: false }, mqtt: { keepAlive: 30 } },
      { http: { timeoutMs: 2_000, sslVerification: false, httpVersion: '2' }, mqtt: { keepAlive: 30 } },
    );
    expect(updates).toEqual([
      { kind: 'http', key: 'httpVersion', value: '2' },
      { kind: 'http', key: 'cookieJar', value: undefined },
      { kind: 'http', key: 'timeoutMs', value: 2_000 },
    ]);
  });

  it('a first write against no record sets every defined knob; a no-op edit yields nothing', () => {
    expect(settingUpdatesBetween(undefined, { websocket: { timeoutMs: 1_000 } })).toEqual([
      { kind: 'websocket', key: 'timeoutMs', value: 1_000 },
    ]);
    expect(settingUpdatesBetween({ http: { timeoutMs: 1_000 } }, { http: { timeoutMs: 1_000 } })).toEqual([]);
  });

  it('a cleared slice unsets its knobs alone — the other kinds stay', () => {
    expect(
      settingUpdatesBetween({ http: { timeoutMs: 1 }, grpc: { timeoutMs: 2 } }, { grpc: { timeoutMs: 2 } }),
    ).toEqual([{ kind: 'http', key: 'timeoutMs', value: undefined }]);
  });
});
