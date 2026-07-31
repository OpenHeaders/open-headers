/**
 * Per-knob unsaved-vs-saved comparison (settings-unsaved.ts) — the
 * saved side of the Settings tab's orange dots. Comparison must run on
 * normalized values (an explicit stored default equals the cleared
 * knob) and must flag a knob reverted to its default but not yet saved
 * (the "orange even without a blue dot" case).
 */

import {
  type RequestSettingsSlice,
  SETTINGS_KNOB_KEYS,
  settingsSlice,
  unsavedSettingKeys,
} from '@openheaders/ui/workbench/components/request-editor/settings-unsaved';
import { describe, expect, it } from 'vitest';

describe('unsavedSettingKeys', () => {
  it('is empty while draft and saved agree', () => {
    const slice: RequestSettingsSlice = { timeoutMs: 15000, sslVerification: false };
    expect(unsavedSettingKeys(slice, { ...slice }).size).toBe(0);
    expect(unsavedSettingKeys({}, {}).size).toBe(0);
  });

  it('flags a knob whose draft value differs from the saved one', () => {
    const out = unsavedSettingKeys({ timeoutMs: 15000 }, { timeoutMs: 30000 });
    expect(out.has('timeoutMs')).toBe(true);
    expect(out.size).toBe(1);
  });

  it('flags every set knob against an empty baseline (create mode)', () => {
    const out = unsavedSettingKeys({ tlsMinVersion: '1.2', proxyMode: 'direct' }, {});
    expect(out.has('tlsMinVersion')).toBe(true);
    expect(out.has('proxyMode')).toBe(true);
    expect(out.size).toBe(2);
  });

  it('flags a knob reverted to its default but not yet saved', () => {
    const out = unsavedSettingKeys({}, { tlsMinVersion: '1.2', cookieJar: true });
    expect(out.has('tlsMinVersion')).toBe(true);
    expect(out.has('cookieJar')).toBe(true);
  });

  it('treats explicit stored defaults as equal to the cleared knob', () => {
    const explicitDefaults: RequestSettingsSlice = {
      credentialsMode: 'omit',
      followRedirects: true,
      sslVerification: true,
      httpVersion: 'auto',
      cookieJar: false,
      followOriginalHttpMethod: false,
      followAuthorizationHeader: false,
    };
    expect(unsavedSettingKeys({}, explicitDefaults).size).toBe(0);
    expect(unsavedSettingKeys(explicitDefaults, {}).size).toBe(0);
  });

  it('still flags genuinely non-default booleans and versions', () => {
    const out = unsavedSettingKeys(
      { followRedirects: false, httpVersion: '2', sslVerification: false },
      { followRedirects: true, httpVersion: 'auto', sslVerification: true },
    );
    expect(out.has('followRedirects')).toBe(true);
    expect(out.has('httpVersion')).toBe(true);
    expect(out.has('sslVerification')).toBe(true);
    expect(out.size).toBe(3);
  });
});

describe('settingsSlice', () => {
  it('projects exactly the knob keys, dropping everything else', () => {
    const source = {
      timeoutMs: 15000,
      proxyMode: 'direct' as const,
      method: 'GET',
      url: 'https://api.openheaders.io',
      headers: [],
    };
    const slice = settingsSlice(source);
    expect(Object.keys(slice).sort()).toEqual([...SETTINGS_KNOB_KEYS].sort());
    expect(slice.timeoutMs).toBe(15000);
    expect(slice.proxyMode).toBe('direct');
  });
});
