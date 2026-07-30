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
  // Chunks accumulate uncopied until contiguous bytes are needed (a
  // header split across chunks, or a whole frame ready to slice) —
  // ONE concat per completed frame instead of one per push, so a frame
  // spanning many stdio chunks costs linear copying, never quadratic.
  private chunks: Buffer[] = [];
  private total = 0;

  /** Feed one stdio chunk; returns every frame completed by it. Throws
   *  on a payload past the ceiling — a corrupt stream the caller must
   *  treat as fatal for the whole session. */
  push(chunk: Buffer): H3Frame[] {
    if (chunk.length > 0) {
      this.chunks.push(chunk);
      this.total += chunk.length;
    }
    const frames: H3Frame[] = [];
    while (this.total >= H3_FRAME_HEADER_BYTES) {
      let head = this.chunks[0];
      if (head === undefined) break;
      if (head.length < H3_FRAME_HEADER_BYTES) {
        this.compact();
        head = this.chunks[0] as Buffer;
      }
      const length = head.readUInt32BE(5);
      if (length > H3_MAX_PAYLOAD_BYTES) {
        throw new Error(`Helper frame payload of ${length} bytes exceeds the ${H3_MAX_PAYLOAD_BYTES}-byte ceiling.`);
      }
      const total = H3_FRAME_HEADER_BYTES + length;
      if (this.total < total) break;
      if (head.length < total) {
        this.compact();
        head = this.chunks[0] as Buffer;
      }
      frames.push({
        type: head.readUInt8(0),
        id: head.readUInt32BE(1),
        payload: head.subarray(H3_FRAME_HEADER_BYTES, total),
      });
      this.total -= total;
      const rest = head.subarray(total);
      if (rest.length === 0) {
        this.chunks.shift();
      } else {
        this.chunks[0] = rest;
      }
    }
    return frames;
  }

  private compact(): void {
    this.chunks = [Buffer.concat(this.chunks)];
  }
}
