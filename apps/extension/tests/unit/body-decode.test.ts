import { describe, expect, it } from 'vitest';
import { materializeBody, toBase64 } from '@/background/modules/request-executor/body-decode';

describe('materializeBody', () => {
  it('keeps valid UTF-8 as text with no encoding marker', () => {
    const out = materializeBody(new TextEncoder().encode('{"host":"openheaders.io","é":"ü"}'), false);
    expect(out.body).toBe('{"host":"openheaders.io","é":"ü"}');
    expect(out.bodyEncoding).toBeUndefined();
  });

  it('stores non-UTF-8 bytes as base64 with the marker, losslessly', () => {
    const wire = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3]);
    const out = materializeBody(wire, false);
    expect(out.bodyEncoding).toBe('base64');
    const decoded = Uint8Array.from(atob(out.body), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(wire));
  });

  it('trims a partial UTF-8 tail on a truncated TEXT body instead of calling it binary', () => {
    const full = new TextEncoder().encode('openheaders.io — ok');
    // Cut inside the multi-byte em-dash: the strict decode fails, but a
    // capped text body must stay text.
    const cut = full.subarray(0, 'openheaders.io '.length + 1);
    const out = materializeBody(cut, true);
    expect(out.bodyEncoding).toBeUndefined();
    expect(out.body).toBe('openheaders.io ');
  });

  it('keeps a truncated BINARY body base64 — trimming cannot make it decode', () => {
    const wire = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa]);
    const out = materializeBody(wire.subarray(0, 4), true);
    expect(out.bodyEncoding).toBe('base64');
    expect(atob(out.body).length).toBe(4);
  });
});

describe('toBase64', () => {
  it('handles payloads larger than one encoding chunk', () => {
    const bytes = new Uint8Array(0x8000 + 21).fill(0x41);
    expect(atob(toBase64(bytes))).toBe('A'.repeat(0x8000 + 21));
  });
});
