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
 * A run of dump lines for rendering — hex pairs + ASCII only; the
 * offset column ships separately (`offsetsText`) so it can render as
 * its own colored column. Plain pieces batch every unremarkable row
 * into one string (a 512 KB dump is 32k rows — one DOM node each would
 * jank the panel); a magic piece is a single row whose bytes intersect
 * a detected file signature, split before the ASCII column so just
 * that column can carry the highlight.
 */
export type HexDumpPiece =
  | { kind: 'plain'; text: string }
  | { kind: 'magic'; head: string; ascii: string; label: string };

export interface HexDump {
  /** Dump lines joined with newlines: `offset: hex pairs  ascii`. */
  text: string;
  /** The offset column alone (`00000000:` per row, newline-joined) —
   *  rendered beside the pieces as its own colored column. */
  offsetsText: string;
  /** Rendered rows — drives the line-number gutter. */
  rowCount: number;
  /** The dump lines minus the offset column, grouped for rendering —
   *  see {@link HexDumpPiece}. */
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

/** The body as display text for the Raw view — verbatim for text
 *  bodies; a binary body decodes lossily (U+FFFD where bytes aren't
 *  UTF-8), which is exactly what "the wire as text" looks like. The
 *  byte-faithful views are Hex/Base64. */
export function decodeBodyTextLossy(response: Pick<ExecutedRequestSnapshot, 'body' | 'bodyEncoding'>): string {
  return response.bodyEncoding === 'base64' ? new TextDecoder().decode(fromBase64(response.body)) : response.body;
}

/** Base64 wire width for the Base64 view — the classic MIME line. */
export const BASE64_LINE_WIDTH = 76;

/** Reflow one base64 string into fixed-width lines so the view can
 *  carry a line-number gutter. */
export function formatBase64Lines(b64: string, width: number = BASE64_LINE_WIDTH): string[] {
  if (b64 === '') return [''];
  const lines: string[] = [];
  for (let at = 0; at < b64.length; at += width) lines.push(b64.slice(at, at + width));
  return lines;
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
  const offsets: string[] = [];
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
    const offset = `${rowStart.toString(16).padStart(8, '0')}:`;
    const pairs: string[] = [];
    let ascii = '';
    for (const byte of row) {
      pairs.push(byte.toString(16).padStart(2, '0').toUpperCase());
      ascii += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.';
    }
    const head = ` ${pairs.join(' ').padEnd(hexColumnWidth, ' ')}  `;
    offsets.push(offset);
    lines.push(offset + head + ascii);
    const hit = magic.find((m) => m.start < rowEnd && m.end > rowStart);
    if (hit) {
      flushPlain();
      pieces.push({ kind: 'magic', head, ascii, label: hit.label });
    } else {
      plainRun.push(head + ascii);
    }
  }
  flushPlain();
  return {
    text: lines.join('\n'),
    offsetsText: offsets.join('\n'),
    rowCount: offsets.length,
    pieces,
    shownBytes,
    totalBytes: bytes.length,
    capped: shownBytes < bytes.length,
  };
}
