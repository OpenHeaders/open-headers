/**
 * Byte-level encodings for the response body pane's Hex and Base64
 * views. Both derive from the UTF-8 bytes of the body text the runner
 * captured — for binary payloads that text is already a lossy decode,
 * so these views are honest about what we hold, not a re-fetch.
 */

/** Bytes the Hex view renders before cutting off — a full dump of the
 *  2 MB body cap would be a ~10 MB DOM string. */
export const HEX_VIEW_CAP_BYTES = 512 * 1024;

const BYTES_PER_ROW = 16;

export interface HexDump {
  /** Dump lines joined with newlines: `offset: hex pairs  ascii`. */
  text: string;
  shownBytes: number;
  totalBytes: number;
  /** True when the dump stops at the cap before the body's end. */
  capped: boolean;
}

export function encodeBodyBytes(body: string): Uint8Array {
  return new TextEncoder().encode(body);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return btoa(binary);
}

export function buildHexDump(bytes: Uint8Array, capBytes: number = HEX_VIEW_CAP_BYTES): HexDump {
  const shownBytes = Math.min(bytes.length, capBytes);
  const hexColumnWidth = BYTES_PER_ROW * 3 - 1;
  const lines: string[] = [];
  for (let rowStart = 0; rowStart < shownBytes; rowStart += BYTES_PER_ROW) {
    const row = bytes.subarray(rowStart, Math.min(rowStart + BYTES_PER_ROW, shownBytes));
    const offset = rowStart.toString(16).padStart(8, '0');
    const pairs: string[] = [];
    let ascii = '';
    for (const byte of row) {
      pairs.push(byte.toString(16).padStart(2, '0').toUpperCase());
      ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
    }
    lines.push(`${offset}: ${pairs.join(' ').padEnd(hexColumnWidth, ' ')}  ${ascii}`);
  }
  return { text: lines.join('\n'), shownBytes, totalBytes: bytes.length, capped: shownBytes < bytes.length };
}
