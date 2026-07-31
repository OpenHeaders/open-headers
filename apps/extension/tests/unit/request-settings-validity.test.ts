/**
 * Save-gate validity for the request Settings tab's free-text knobs —
 * `firstInvalidRequestSetting` mirrors the tab's inline error rows, so
 * a draft the schema would reject keeps the editor dirty instead of
 * persisting (or silently dropping) the invalid value.
 */

import { firstInvalidRequestSetting } from '@openheaders/ui/workbench/components/request-editor/settings-validity';
import { describe, expect, it } from 'vitest';

describe('firstInvalidRequestSetting', () => {
  it('passes an all-default draft and well-formed values', () => {
    expect(firstInvalidRequestSetting({})).toBeNull();
    expect(
      firstInvalidRequestSetting({
        resolveToAddress: '10.0.0.12',
        tlsCipherSuites: 'TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES128-GCM-SHA256',
        proxyMode: 'url',
        proxyUrl: 'http://proxy.openheaders.io:3128',
        unixSocketPath: '/var/run/docker.sock',
      }),
    ).toBeNull();
  });

  it('flags each malformed field by its settings key', () => {
    expect(firstInvalidRequestSetting({ resolveToAddress: 'backend.openheaders.io' })).toBe('resolveToAddress');
    expect(firstInvalidRequestSetting({ tlsCipherSuites: 'has spaces here' })).toBe('tlsCipherSuites');
    expect(firstInvalidRequestSetting({ proxyMode: 'url', proxyUrl: 'socks4://127.0.0.1:1080' })).toBe('proxyUrl');
    expect(firstInvalidRequestSetting({ unixSocketPath: 'not-a-path' })).toBe('unixSocketPath');
  });

  it('treats Custom-URL proxy mode with no URL as invalid — the row flags the missing URL', () => {
    expect(firstInvalidRequestSetting({ proxyMode: 'url' })).toBe('proxyUrl');
    expect(firstInvalidRequestSetting({ proxyMode: 'direct' })).toBeNull();
  });
});
