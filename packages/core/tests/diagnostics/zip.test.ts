/**
 * The zip writer: every structure a reader checks (local headers, the
 * central directory, the end record, CRC-32, sizes, UTF-8 names) read
 * back with an independent parser, and the deflated bodies inflated by
 * Node's own zlib — never by anything in this package.
 */

import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, dosDateTime, writeZip } from '../../src/diagnostics';

interface ParsedEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  flags: number;
  madeByHost: number;
  externalAttributes: number;
  localOffset: number;
  body: Uint8Array;
}

/** A reader's walk: the end record → the central directory → each local header's body. */
function parseZip(bytes: Uint8Array): { entries: ParsedEntry[]; count: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  expect(directoryOffset + directorySize).toBe(end);

  const entries: ParsedEntry[] = [];
  let cursor = directoryOffset;
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50);
    const madeByHost = view.getUint8(cursor + 5);
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength;

    expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
    expect(view.getUint16(localOffset + 8, true)).toBe(method);
    expect(view.getUint32(localOffset + 14, true)).toBe(crc);
    const localNameLength = view.getUint16(localOffset + 26, true);
    expect(localNameLength).toBe(nameLength);
    const bodyStart = localOffset + 30 + localNameLength;
    const body = bytes.subarray(bodyStart, bodyStart + compressedSize);
    entries.push({
      name,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      flags,
      madeByHost,
      externalAttributes,
      localOffset,
      body,
    });
  }
  return { entries, count };
}

function inflate(entry: ParsedEntry): Uint8Array {
  return entry.method === 8 ? new Uint8Array(inflateRawSync(entry.body)) : entry.body;
}

describe('crc32', () => {
  it('matches the IEEE check values', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('dosDateTime', () => {
  it('packs the local date and time at two-second resolution and clamps to 1980', () => {
    const at = new Date(2026, 9, 19, 18, 20, 47).getTime();
    const { date, time } = dosDateTime(at);
    expect(date >> 9).toBe(46);
    expect((date >> 5) & 0xf).toBe(10);
    expect(date & 0x1f).toBe(19);
    expect(time >> 11).toBe(18);
    expect((time >> 5) & 0x3f).toBe(20);
    expect((time & 0x1f) * 2).toBe(46);
    expect(dosDateTime(0).date >> 9).toBe(0);
  });
});

describe('writeZip', () => {
  it('writes a readable archive whose deflated bodies inflate to the inputs', async () => {
    const text = 'the quick brown fox jumps over the lazy dog\n'.repeat(200);
    const bytes = await writeZip([
      { name: 'README.txt', data: 'Open Headers diagnostic bundle\n' },
      { name: 'logs/main.log', data: text },
    ]);
    const { entries, count } = parseZip(bytes);
    expect(count).toBe(2);
    expect(entries.map((e) => e.name)).toEqual(['README.txt', 'logs/main.log']);
    const log = entries[1];
    expect(log.method).toBe(8);
    expect(log.compressedSize).toBeLessThan(log.uncompressedSize);
    expect(new TextDecoder().decode(inflate(log))).toBe(text);
    expect(log.crc).toBe(crc32(new TextEncoder().encode(text)));
    expect(log.uncompressedSize).toBe(new TextEncoder().encode(text).length);
  });

  it('stores what deflate would not shrink, and empty entries', async () => {
    // xorshift32 noise: no run or period deflate can exploit, so the stored branch is the one that wins.
    const noise = new Uint8Array(512);
    let state = 0x9e3779b9;
    for (let i = 0; i < noise.length; i += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      noise[i] = state & 0xff;
    }
    const bytes = await writeZip([
      { name: 'empty.txt', data: '' },
      { name: 'noise.bin', data: noise },
    ]);
    const { entries } = parseZip(bytes);
    expect(entries[0]).toMatchObject({ method: 0, compressedSize: 0, uncompressedSize: 0, crc: 0 });
    expect(entries[1].method).toBe(0);
    expect(inflate(entries[1])).toEqual(noise);
  });

  it('flags names as UTF-8 and keeps the entry order', async () => {
    const bytes = await writeZip([
      { name: 'b/second.json', data: '{}' },
      { name: 'a/première.txt', data: 'é' },
    ]);
    const { entries } = parseZip(bytes);
    expect(entries.map((e) => e.name)).toEqual(['b/second.json', 'a/première.txt']);
    for (const entry of entries) expect(entry.flags & 0x0800).toBe(0x0800);
    expect(new TextDecoder().decode(inflate(entries[1]))).toBe('é');
  });

  it('marks every entry a readable regular file for Unix-aware extractors', async () => {
    const bytes = await writeZip([
      { name: 'README.txt', data: 'read me' },
      { name: 'logs/main.log', data: '' },
    ]);
    for (const entry of parseZip(bytes).entries) {
      expect(entry.madeByHost).toBe(3);
      expect(entry.externalAttributes >>> 16).toBe(0o100644);
    }
  });

  it('stamps each entry with its own modification time, else the clock', async () => {
    const at = new Date(2026, 9, 19, 18, 20, 46).getTime();
    const bytes = await writeZip(
      [
        { name: 'a.txt', data: 'a', modifiedAt: at },
        { name: 'b.txt', data: 'b' },
      ],
      () => at,
    );
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const { entries } = parseZip(bytes);
    const expected = dosDateTime(at);
    for (const entry of entries) {
      expect(view.getUint16(entry.localOffset + 10, true)).toBe(expected.time);
      expect(view.getUint16(entry.localOffset + 12, true)).toBe(expected.date);
    }
  });

  it('writes an empty archive as the bare end record', async () => {
    const bytes = await writeZip([]);
    expect(bytes.length).toBe(22);
    expect(parseZip(bytes).count).toBe(0);
  });
});
