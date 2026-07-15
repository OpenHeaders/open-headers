import { detectMagicSignatures } from '@openheaders/ui/workbench/components/request-editor/response/magic-signatures';
import {
  buildHexDump,
  encodeBodyBytes,
  type HexDumpPiece,
} from '@openheaders/ui/workbench/components/request-editor/response/response-encoding';
import { describe, expect, it } from 'vitest';

const PDF_BYTES = encodeBodyBytes('%PDF-1.4\nfake body content spanning rows\nstartxref\n420\n%%EOF\n');

describe('detectMagicSignatures', () => {
  it('finds the PDF header at offset 0 and the trailer near the end', () => {
    const matches = detectMagicSignatures(PDF_BYTES);
    expect(matches).toEqual([
      { label: 'PDF header', start: 0, end: 5 },
      { label: 'PDF trailer', start: PDF_BYTES.length - 6, end: PDF_BYTES.length - 1 },
    ]);
  });

  it('tolerates trailing whitespace after the PDF trailer, within the window', () => {
    const padded = encodeBodyBytes(`%PDF-1.4\nx\n%%EOF${'\n'.repeat(10)}`);
    const labels = detectMagicSignatures(padded).map((m) => m.label);
    expect(labels).toContain('PDF trailer');
  });

  it('reports nothing without a matching header — a trailer alone is noise', () => {
    expect(detectMagicSignatures(encodeBodyBytes('plain text mentioning %%EOF'))).toEqual([]);
    expect(detectMagicSignatures(encodeBodyBytes('{"ok":true}'))).toEqual([]);
    expect(detectMagicSignatures(new Uint8Array(0))).toEqual([]);
  });

  it('identifies PNG by its 8-byte header and IEND trailer', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    expect(detectMagicSignatures(png).map((m) => m.label)).toEqual(['PNG header', 'PNG trailer']);
  });

  it('splits RIFF containers by their subtype tag at byte 8', () => {
    const riff = (tag: string) => encodeBodyBytes(`RIFF\u0000\u0000\u0000\u0000${tag}rest of payload`);
    expect(detectMagicSignatures(riff('WEBP'))).toEqual([{ label: 'WEBP header', start: 0, end: 12 }]);
    expect(detectMagicSignatures(riff('WAVE')).map((m) => m.label)).toEqual(['WAV header']);
    expect(detectMagicSignatures(riff('AVI ')).map((m) => m.label)).toEqual(['AVI header']);
    expect(detectMagicSignatures(riff('XXXX')).map((m) => m.label)).toEqual(['RIFF header']);
  });

  it('identifies wasm, fonts, and audio containers at offset 0', () => {
    expect(detectMagicSignatures(new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))).toEqual([
      { label: 'WASM header', start: 0, end: 4 },
    ]);
    expect(detectMagicSignatures(encodeBodyBytes('wOFFrest')).map((m) => m.label)).toEqual(['WOFF header']);
    expect(detectMagicSignatures(encodeBodyBytes('wOF2rest')).map((m) => m.label)).toEqual(['WOFF2 header']);
    expect(detectMagicSignatures(encodeBodyBytes('ID3tag')).map((m) => m.label)).toEqual(['MP3 header']);
    expect(detectMagicSignatures(encodeBodyBytes('OggS\u0000page')).map((m) => m.label)).toEqual(['OGG header']);
  });

  it('identifies MP4 by the ftyp box tag buried at byte 4', () => {
    const mp4 = encodeBodyBytes('\u0000\u0000\u0000\u0018ftypisom rest');
    expect(detectMagicSignatures(mp4)).toEqual([{ label: 'MP4 header', start: 4, end: 8 }]);
  });
});

describe('buildHexDump with magic matches', () => {
  it('splits signature rows into head + highlighted ascii pieces', () => {
    const dump = buildHexDump(PDF_BYTES, undefined, detectMagicSignatures(PDF_BYTES));
    const magicPieces = dump.pieces.filter((p): p is Extract<HexDumpPiece, { kind: 'magic' }> => p.kind === 'magic');
    expect(magicPieces.map((p) => p.label)).toEqual(['PDF header', 'PDF trailer']);
    expect(magicPieces[0]?.ascii.startsWith('%PDF-1.4')).toBe(true);
    expect(magicPieces[1]?.ascii).toContain('%%EOF');
    // Offsets column + pieces reassemble the flat dump text exactly.
    const offsetLines = dump.offsetsText.split('\n');
    const bodyLines = dump.pieces.flatMap((p) => (p.kind === 'plain' ? p.text.split('\n') : [p.head + p.ascii]));
    expect(bodyLines).toHaveLength(dump.rowCount);
    expect(offsetLines.map((o, i) => o + bodyLines[i]).join('\n')).toBe(dump.text);
  });

  it('yields one plain piece and no magic pieces without matches', () => {
    const dump = buildHexDump(PDF_BYTES);
    expect(dump.pieces).toHaveLength(1);
    expect(dump.pieces[0]?.kind).toBe('plain');
  });
});
