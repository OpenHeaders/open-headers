/**
 * The inbound frame limit of a sync host, and the one test both ends of
 * a wire apply to it.
 *
 * A host closes the connection of a peer that sends a frame over its
 * limit, and the close takes every plane on that wire with it. So the
 * limit is a declared fact: the host states it on its WELCOME
 * (`maxFrameBytes`), and a sender measures a frame against it before
 * the frame leaves — a frame that does not fit is the sender's to cut
 * or to leave out, never the host's to discover.
 */

/**
 * The limit of a host that declares none: every host that predates the
 * WELCOME field enforces this number.
 */
export const DEFAULT_MAX_FRAME_BYTES = 8 * 1024 * 1024;

/**
 * UTF-8 bytes of JSON text. JSON text holds no lone surrogate (a
 * serialiser escapes them), so each surrogate code unit counts as half
 * of a four-byte pair.
 */
export function utf8ByteLength(text: string): number {
  let bytes = text.length;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) continue;
    bytes += unit < 0x800 || (unit & 0xf800) === 0xd800 ? 1 : 2;
  }
  return bytes;
}

/**
 * Whether serialised JSON fits a frame of `maxBytes`. A code unit takes
 * at most three bytes, so text a third of the limit long fits without
 * being counted; only text long enough to be in doubt is walked.
 */
export function fitsFrame(serialized: string, maxBytes: number): boolean {
  if (serialized.length * 3 <= maxBytes) return true;
  if (serialized.length > maxBytes) return false;
  return utf8ByteLength(serialized) <= maxBytes;
}
