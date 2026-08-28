/**
 * Text encodings a compose surface authors BINARY bytes in — base64 or
 * hex. One validator and one decoder shared by every editor that
 * offers a binary payload (the MQTT publish compose, the WebSocket
 * binary frame) and by the executors that write the decoded bytes,
 * so the inline gate and the wire agree on what "valid" means:
 * whitespace tolerated, base64 padded to a multiple of four, hex in
 * digit pairs.
 */

import { decodeBase64Bytes } from './base64';

export type BinaryEncoding = 'base64' | 'hex';

/** Base64 alphabet with optional padding — whitespace stripped first. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** The encoding the text fails, or null when it decodes cleanly. */
export function binaryEncodingError(text: string, encoding: BinaryEncoding): BinaryEncoding | null {
  const compact = text.replace(/\s/g, '');
  if (encoding === 'base64') {
    return BASE64_PATTERN.test(compact) && compact.length % 4 === 0 ? null : 'base64';
  }
  return /^[0-9a-fA-F]*$/.test(compact) && compact.length % 2 === 0 ? null : 'hex';
}

/** Decode the text under its encoding; null when it fails the same
 *  gate {@link binaryEncodingError} reports. */
export function decodeBinaryText(text: string, encoding: BinaryEncoding): Uint8Array | null {
  if (binaryEncodingError(text, encoding) !== null) return null;
  const compact = text.replace(/\s/g, '');
  if (encoding === 'base64') return decodeBase64Bytes(compact);
  const bytes = new Uint8Array(compact.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
