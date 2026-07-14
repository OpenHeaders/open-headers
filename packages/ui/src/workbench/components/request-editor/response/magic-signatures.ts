/**
 * File-signature ("magic") detection for the response body's Hex view —
 * the byte ranges that identify a format, so the dump can highlight
 * them the way a person eyeballs `%PDF-` / `%%EOF` in the ASCII column.
 *
 * Headers anchor at offset 0. Trailers anchor at the payload's end,
 * with a small search window where the format tolerates trailing bytes
 * (PDF allows whitespace after `%%EOF`). Detection is byte-based on
 * the captured wire bytes — never the Content-Type, which lies.
 */

export interface MagicMatch {
  /** Format label + which end it marks, e.g. `PDF header`. */
  label: string;
  /** Byte offset of the signature's first byte. */
  start: number;
  /** Byte offset one past the signature's last byte. */
  end: number;
}

interface MagicSpec {
  name: string;
  header: number[];
  /** Trailer bytes + how far from the payload end they may sit. */
  trailer?: { bytes: number[]; window: number };
}

const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0));

/** Deliberately short list — signatures a REST/debug workflow actually
 *  meets. A format is only reported when its HEADER matches, so a
 *  trailer byte pair can't false-positive on its own. */
const MAGIC_SPECS: MagicSpec[] = [
  { name: 'PDF', header: ascii('%PDF-'), trailer: { bytes: ascii('%%EOF'), window: 32 } },
  {
    name: 'PNG',
    header: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    trailer: { bytes: [0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], window: 8 },
  },
  { name: 'JPEG', header: [0xff, 0xd8, 0xff], trailer: { bytes: [0xff, 0xd9], window: 2 } },
  { name: 'GIF', header: ascii('GIF8') },
  { name: 'ZIP', header: ascii('PK') },
  { name: 'GZIP', header: [0x1f, 0x8b] },
  { name: 'RIFF', header: ascii('RIFF') },
];

function matchesAt(bytes: Uint8Array, at: number, pattern: number[]): boolean {
  if (at < 0 || at + pattern.length > bytes.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[at + i] !== pattern[i]) return false;
  }
  return true;
}

/** Find the trailer's LAST occurrence inside the end-of-payload window. */
function findTrailer(bytes: Uint8Array, trailer: { bytes: number[]; window: number }): number {
  const earliest = Math.max(0, bytes.length - trailer.bytes.length - trailer.window);
  for (let at = bytes.length - trailer.bytes.length; at >= earliest; at--) {
    if (matchesAt(bytes, at, trailer.bytes)) return at;
  }
  return -1;
}

export function detectMagicSignatures(bytes: Uint8Array): MagicMatch[] {
  for (const spec of MAGIC_SPECS) {
    if (!matchesAt(bytes, 0, spec.header)) continue;
    const matches: MagicMatch[] = [{ label: `${spec.name} header`, start: 0, end: spec.header.length }];
    if (spec.trailer) {
      const at = findTrailer(bytes, spec.trailer);
      if (at > 0) matches.push({ label: `${spec.name} trailer`, start: at, end: at + spec.trailer.bytes.length });
    }
    return matches;
  }
  return [];
}
