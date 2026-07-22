/**
 * Chrome native-messaging wire framing: every message is a 32-bit
 * native-endian byte length followed by that many bytes of UTF-8 JSON.
 * Both shipping targets (macOS arm64/x64, Windows x64) are
 * little-endian, so LE is the native order here.
 *
 * The decoder is a stateful accumulator because stdin delivers
 * arbitrary chunk boundaries — a length prefix can arrive split across
 * reads. Inbound frames are capped well below Chrome's own limits: the
 * only legitimate message is a tiny bootstrap request, so anything
 * larger is a protocol violation, not a payload to buffer.
 */

const LENGTH_PREFIX_BYTES = 4;

/** Far above any legitimate bootstrap request, far below abuse territory. */
export const MAX_INBOUND_FRAME_BYTES = 64 * 1024;

export function encodeNmMessage(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), 'utf-8');
  const frame = Buffer.allocUnsafe(LENGTH_PREFIX_BYTES + json.length);
  frame.writeUInt32LE(json.length, 0);
  json.copy(frame, LENGTH_PREFIX_BYTES);
  return frame;
}

export interface NmMessageDecoder {
  /** Feed a stdin chunk; fires `onMessage` for each completed frame. */
  push(chunk: Buffer): void;
}

export interface NmMessageDecoderHooks {
  onMessage(value: unknown): void;
  /** A malformed frame (oversize, bad JSON) — the host should exit. */
  onProtocolError(reason: string): void;
}

export function createNmMessageDecoder(hooks: NmMessageDecoderHooks): NmMessageDecoder {
  let buffered: Buffer = Buffer.alloc(0);
  let failed = false;
  const fail = (reason: string): void => {
    failed = true;
    hooks.onProtocolError(reason);
  };
  return {
    push(chunk: Buffer): void {
      if (failed) return;
      buffered = buffered.length === 0 ? chunk : Buffer.concat([buffered, chunk]);
      while (buffered.length >= LENGTH_PREFIX_BYTES) {
        const frameLength = buffered.readUInt32LE(0);
        if (frameLength > MAX_INBOUND_FRAME_BYTES) {
          fail(`frame of ${frameLength} bytes exceeds the ${MAX_INBOUND_FRAME_BYTES}-byte cap`);
          return;
        }
        if (buffered.length < LENGTH_PREFIX_BYTES + frameLength) return;
        const body = buffered.subarray(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + frameLength);
        buffered = buffered.subarray(LENGTH_PREFIX_BYTES + frameLength);
        let value: unknown;
        try {
          value = JSON.parse(body.toString('utf-8'));
        } catch {
          fail('frame body is not valid JSON');
          return;
        }
        hooks.onMessage(value);
        if (failed) return;
      }
    },
  };
}
