import {
  buildHexDump,
  encodeBodyBytes,
  HEX_VIEW_CAP_BYTES,
  toBase64,
} from '@openheaders/ui/workbench/components/request-editor/response/response-encoding';
import { describe, expect, it } from 'vitest';

describe('encodeBodyBytes', () => {
  it('encodes ASCII one byte per char and multi-byte UTF-8 faithfully', () => {
    expect(Array.from(encodeBodyBytes('AB'))).toEqual([0x41, 0x42]);
    expect(Array.from(encodeBodyBytes('é'))).toEqual([0xc3, 0xa9]);
  });
});

describe('toBase64', () => {
  it('round-trips against atob', () => {
    const encoded = toBase64(encodeBodyBytes('{"host":"openheaders.io"}'));
    expect(atob(encoded)).toBe('{"host":"openheaders.io"}');
  });

  it('encodes an empty body to an empty string', () => {
    expect(toBase64(new Uint8Array(0))).toBe('');
  });

  it('handles bodies larger than one encoding chunk', () => {
    const big = 'x'.repeat(0x8000 + 17);
    expect(atob(toBase64(encodeBodyBytes(big)))).toBe(big);
  });
});

describe('buildHexDump', () => {
  it('renders offset, hex pairs, and an ASCII column', () => {
    const dump = buildHexDump(encodeBodyBytes('openheaders.io!!'));
    expect(dump.text).toBe('00000000: 6F 70 65 6E 68 65 61 64 65 72 73 2E 69 6F 21 21  openheaders.io!!');
    expect(dump.capped).toBe(false);
    expect(dump.totalBytes).toBe(16);
  });

  it('pads a short final row so the ASCII column stays aligned', () => {
    const dump = buildHexDump(encodeBodyBytes('ab'));
    expect(dump.text).toBe(`00000000: 61 62${' '.repeat(14 * 3)}  ab`);
  });

  it('replaces non-printable bytes with dots', () => {
    const dump = buildHexDump(new Uint8Array([0x7b, 0x0a, 0x09, 0x41]));
    expect(dump.text.endsWith('{..A')).toBe(true);
  });

  it('advances the offset per 16-byte row', () => {
    const dump = buildHexDump(encodeBodyBytes('a'.repeat(33)));
    const lines = dump.text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith('00000010: ')).toBe(true);
    expect(lines[2]?.startsWith('00000020: ')).toBe(true);
  });

  it('caps the dump and reports shown vs total bytes', () => {
    const dump = buildHexDump(encodeBodyBytes('a'.repeat(48)), 32);
    expect(dump.capped).toBe(true);
    expect(dump.shownBytes).toBe(32);
    expect(dump.totalBytes).toBe(48);
    expect(dump.text.split('\n')).toHaveLength(2);
  });

  it('defaults the cap to the exported constant', () => {
    expect(HEX_VIEW_CAP_BYTES).toBe(512 * 1024);
    const dump = buildHexDump(new Uint8Array(0));
    expect(dump.text).toBe('');
    expect(dump.capped).toBe(false);
  });
});
