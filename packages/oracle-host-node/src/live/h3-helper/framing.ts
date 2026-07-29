/**
 * Frame codec for the helper protocol: 9-byte big-endian header
 * (u8 type, u32 request id, u32 payload length) followed by the
 * payload. The decoder is incremental — stdio hands back arbitrary
 * chunk boundaries, so frames reassemble across pushes.
 */

export const H3_FRAME_HEADER_BYTES = 9;
export const H3_MAX_PAYLOAD_BYTES = 16 * 1024 * 1024;

export interface H3Frame {
  type: number;
  id: number;
  payload: Buffer;
}

export function encodeH3Frame(type: number, id: number, payload?: Buffer): Buffer {
  const length = payload?.length ?? 0;
  const out = Buffer.allocUnsafe(H3_FRAME_HEADER_BYTES + length);
  out.writeUInt8(type, 0);
  out.writeUInt32BE(id, 1);
  out.writeUInt32BE(length, 5);
  payload?.copy(out, H3_FRAME_HEADER_BYTES);
  return out;
}

export class H3FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  /** Feed one stdio chunk; returns every frame completed by it. Throws
   *  on a payload past the ceiling — a corrupt stream the caller must
   *  treat as fatal for the whole session. */
  push(chunk: Buffer): H3Frame[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const frames: H3Frame[] = [];
    while (this.buffer.length >= H3_FRAME_HEADER_BYTES) {
      const length = this.buffer.readUInt32BE(5);
      if (length > H3_MAX_PAYLOAD_BYTES) {
        throw new Error(`Helper frame payload of ${length} bytes exceeds the ${H3_MAX_PAYLOAD_BYTES}-byte ceiling.`);
      }
      const total = H3_FRAME_HEADER_BYTES + length;
      if (this.buffer.length < total) break;
      frames.push({
        type: this.buffer.readUInt8(0),
        id: this.buffer.readUInt32BE(1),
        payload: this.buffer.subarray(H3_FRAME_HEADER_BYTES, total),
      });
      this.buffer = this.buffer.subarray(total);
    }
    return frames;
  }
}
