/**
 * Byte-level encodings for the response body pane's Hex and Base64
 * views. The bytes come from the snapshot losslessly: text bodies
 * re-encode their UTF-8, binary bodies (`bodyEncoding: 'base64'`)
 * decode back to the exact wire bytes the executor captured.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { MagicMatch } from './magic-signatures';

/** Bytes the Hex view renders before cutting off — a full dump of the
 *  2 MB body cap would be a ~10 MB DOM string. */
export const HEX_VIEW_CAP_BYTES = 512 * 1024;

const BYTES_PER_ROW = 16;

/**
 * A run of dump lines for rendering. Plain pieces batch every
 * unremarkable row into one string (a 512 KB dump is 32k rows — one
 * DOM node each would jank the panel); a magic piece is a single row
 * whose bytes intersect a detected file signature, split before the
 * ASCII column so just that column can carry the highlight.
 */
export type HexDumpPiece =
  | { kind: 'plain'; text: string }
  | { kind: 'magic'; head: string; ascii: string; label: string };

export interface HexDump {
  /** Dump lines joined with newlines: `offset: hex pairs  ascii`. */
  text: string;
  /** The same lines grouped for rendering — see {@link HexDumpPiece}. */
  pieces: HexDumpPiece[];
  shownBytes: number;
  totalBytes: number;
  /** True when the dump stops at the cap before the body's end. */
  capped: boolean;
}

export function encodeBodyBytes(body: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(body);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The wire bytes the snapshot holds — base64-decoded when the executor
 *  marked the body binary, the UTF-8 bytes of the text otherwise. */
export function snapshotBodyBytes(
  response: Pick<ExecutedRequestSnapshot, 'body' | 'bodyEncoding'>,
): Uint8Array<ArrayBuffer> {
  return response.bodyEncoding === 'base64' ? fromBase64(response.body) : encodeBodyBytes(response.body);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return btoa(binary);
}

export function buildHexDump(
  bytes: Uint8Array,
  capBytes: number = HEX_VIEW_CAP_BYTES,
  magic: MagicMatch[] = [],
): HexDump {
  const shownBytes = Math.min(bytes.length, capBytes);
  const hexColumnWidth = BYTES_PER_ROW * 3 - 1;
  const lines: string[] = [];
  const pieces: HexDumpPiece[] = [];
  let plainRun: string[] = [];
  const flushPlain = () => {
    if (plainRun.length > 0) {
      pieces.push({ kind: 'plain', text: plainRun.join('\n') });
      plainRun = [];
    }
  };
  for (let rowStart = 0; rowStart < shownBytes; rowStart += BYTES_PER_ROW) {
    const rowEnd = Math.min(rowStart + BYTES_PER_ROW, shownBytes);
    const row = bytes.subarray(rowStart, rowEnd);
    const offset = rowStart.toString(16).padStart(8, '0');
    const pairs: string[] = [];
    let ascii = '';
    for (const byte of row) {
      pairs.push(byte.toString(16).padStart(2, '0').toUpperCase());
      ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
    }
    const head = `${offset}: ${pairs.join(' ').padEnd(hexColumnWidth, ' ')}  `;
    lines.push(head + ascii);
    const hit = magic.find((m) => m.start < rowEnd && m.end > rowStart);
    if (hit) {
      flushPlain();
      pieces.push({ kind: 'magic', head, ascii, label: hit.label });
    } else {
      plainRun.push(head + ascii);
    }
  }
  flushPlain();
  return { text: lines.join('\n'), pieces, shownBytes, totalBytes: bytes.length, capped: shownBytes < bytes.length };
}
