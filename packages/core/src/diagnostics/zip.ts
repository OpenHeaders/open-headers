/**
 * A minimal ZIP writer (PKWARE APPNOTE 4.4.x: local headers, a central
 * directory, the end record) for the diagnostic bundle. Platform-free
 * by design: the only compression primitive is the Web
 * `CompressionStream('deflate-raw')`, which Chromium, Firefox, Safari
 * and Node all provide, so the one writer serves the desktop renderer
 * and every extension document alike. Where the stream is missing the
 * entries are stored — still a valid archive, just larger.
 *
 * Names are UTF-8 (general-purpose bit 11); sizes stay under 4 GiB by
 * the bundle's nature, so there is no ZIP64 record. The made-by host is
 * Unix, so every entry carries a regular-file mode in its external
 * attributes — a zero there is mode 000 to Info-ZIP's unzip, and the
 * extracted files would open to "Permission denied". Nothing here reads
 * a zip back — the reader is whatever the person opens the file with.
 */

export interface ZipEntry {
  /** The archive path, `/`-separated, no leading slash. */
  name: string;
  data: Uint8Array | string;
  /** ms since epoch; the DOS timestamp is derived from it (two-second resolution, local time). */
  modifiedAt?: number;
}

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_RECORD_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 0x0314;
const FLAG_UTF8_NAMES = 0x0800;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;
/** The Unix mode word readers take from the external attributes: a regular file, `rw-r--r--`. */
const EXTERNAL_ATTRIBUTES_REGULAR_FILE = 0o100644 << 16;

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3) as the zip format expects it. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time words; years before 1980 clamp to the format's epoch. */
export function dosDateTime(at: number): { date: number; time: number } {
  const d = new Date(at);
  const year = Math.max(d.getFullYear(), 1980);
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

class ByteWriter {
  private readonly chunks: Uint8Array[] = [];
  private total = 0;

  get length(): number {
    return this.total;
  }

  push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.total += bytes.length;
  }

  u16(value: number): void {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, value, true);
    this.push(b);
  }

  u32(value: number): void {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value >>> 0, true);
    this.push(b);
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  method: number;
  crc: number;
  compressed: Uint8Array;
  uncompressedSize: number;
  date: number;
  time: number;
  localHeaderOffset: number;
}

/**
 * Build one archive from the entries in order. Each entry deflates when
 * that shrinks it (and the stream exists); otherwise it is stored.
 */
export async function writeZip(entries: ReadonlyArray<ZipEntry>, now: () => number = Date.now): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const out = new ByteWriter();
  const prepared: PreparedEntry[] = [];

  for (const entry of entries) {
    const raw = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
    const deflated = raw.length === 0 ? null : await deflateRaw(raw);
    const useDeflate = deflated !== null && deflated.length < raw.length;
    const { date, time } = dosDateTime(entry.modifiedAt ?? now());
    const item: PreparedEntry = {
      nameBytes: encoder.encode(entry.name),
      method: useDeflate ? METHOD_DEFLATED : METHOD_STORED,
      crc: crc32(raw),
      compressed: useDeflate ? deflated : raw,
      uncompressedSize: raw.length,
      date,
      time,
      localHeaderOffset: out.length,
    };
    prepared.push(item);

    out.u32(LOCAL_HEADER_SIGNATURE);
    out.u16(VERSION_NEEDED);
    out.u16(FLAG_UTF8_NAMES);
    out.u16(item.method);
    out.u16(item.time);
    out.u16(item.date);
    out.u32(item.crc);
    out.u32(item.compressed.length);
    out.u32(item.uncompressedSize);
    out.u16(item.nameBytes.length);
    out.u16(0);
    out.push(item.nameBytes);
    out.push(item.compressed);
  }

  const centralDirectoryOffset = out.length;
  for (const item of prepared) {
    out.u32(CENTRAL_HEADER_SIGNATURE);
    out.u16(VERSION_MADE_BY);
    out.u16(VERSION_NEEDED);
    out.u16(FLAG_UTF8_NAMES);
    out.u16(item.method);
    out.u16(item.time);
    out.u16(item.date);
    out.u32(item.crc);
    out.u32(item.compressed.length);
    out.u32(item.uncompressedSize);
    out.u16(item.nameBytes.length);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u32(EXTERNAL_ATTRIBUTES_REGULAR_FILE);
    out.u32(item.localHeaderOffset);
    out.push(item.nameBytes);
  }
  const centralDirectorySize = out.length - centralDirectoryOffset;

  out.u32(END_RECORD_SIGNATURE);
  out.u16(0);
  out.u16(0);
  out.u16(prepared.length);
  out.u16(prepared.length);
  out.u32(centralDirectorySize);
  out.u32(centralDirectoryOffset);
  out.u16(0);
  return out.bytes();
}
