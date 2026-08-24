/**
 * Incremental MQTT stream decoder — packets span TCP chunks, and
 * WebSocket frame boundaries do not delimit packets either, so BOTH
 * transports feed the same chunk-carrying decoder (the ratified fork-2
 * posture). Push wire chunks as they arrive and collect the packets
 * each push completed.
 *
 * Error split: a body that fails to decode reports a NON-fatal event —
 * the fixed header still framed it, so the stream resynchronizes at
 * the next packet boundary. A fixed header that cannot be trusted (a
 * remaining-length varint past 4 bytes, the forbidden type 0, a packet
 * over the byte ceiling) poisons the framing: it reports one FATAL
 * event and the decoder consumes nothing more.
 */
import { decodeMqttPacketBody, type MqttPacket, type MqttProtocolVersion } from './packets';
import { MqttCodecError } from './wire';

export type MqttStreamEvent =
  | {
      ok: true;
      packet: MqttPacket;
      /** Total frame size on the wire — fixed header included. */
      wireBytes: number;
      /** The fixed header's Remaining Length as framed on the wire —
       *  the observed byte count of the packet past the fixed header,
       *  a framing FACT consumers may record (never recompute). */
      remainingLength: number;
    }
  | { ok: false; error: string; fatal: boolean };

export interface MqttStreamDecoder {
  /** Feed the next wire chunk; returns the events it completed.
   *  Packet payloads are own copies — safe to retain past the push. */
  push(chunk: Uint8Array): MqttStreamEvent[];
  /** Bytes buffered awaiting a complete packet. */
  pendingBytes(): number;
}

export interface MqttStreamDecoderOptions {
  /** Ceiling on one packet's TOTAL wire size (fixed header included);
   *  a packet announcing more is a fatal framing error. Default: none
   *  (the varint's own 268 MB body ceiling still binds). */
  maxPacketBytes?: number;
}

export function createMqttStreamDecoder(
  version: MqttProtocolVersion,
  options?: MqttStreamDecoderOptions,
): MqttStreamDecoder {
  const maxPacketBytes = options?.maxPacketBytes;
  let carry = new Uint8Array(0);
  let dead = false;
  return {
    push(chunk: Uint8Array): MqttStreamEvent[] {
      if (dead) return [];
      let joined: Uint8Array;
      if (carry.byteLength === 0) {
        joined = chunk;
      } else {
        joined = new Uint8Array(carry.byteLength + chunk.byteLength);
        joined.set(carry, 0);
        joined.set(chunk, carry.byteLength);
      }
      const events: MqttStreamEvent[] = [];
      let at = 0;
      while (at < joined.byteLength) {
        // Fixed header: type/flags byte + 1–4 remaining-length bytes.
        let remainingLength = 0;
        let multiplier = 1;
        let lengthBytes = 0;
        let complete = false;
        while (at + 1 + lengthBytes < joined.byteLength) {
          const byte = joined[at + 1 + lengthBytes];
          remainingLength += (byte & 0x7f) * multiplier;
          multiplier *= 128;
          lengthBytes++;
          if ((byte & 0x80) === 0) {
            complete = true;
            break;
          }
          if (lengthBytes === 4) {
            dead = true;
            events.push({ ok: false, error: 'Remaining length varint exceeds 4 bytes.', fatal: true });
            return events;
          }
        }
        if (!complete) break;
        const typeNibble = joined[at] >> 4;
        if (typeNibble === 0) {
          dead = true;
          events.push({ ok: false, error: 'Unknown packet type 0.', fatal: true });
          return events;
        }
        const wireBytes = 1 + lengthBytes + remainingLength;
        if (maxPacketBytes !== undefined && wireBytes > maxPacketBytes) {
          dead = true;
          events.push({
            ok: false,
            error: `Packet of ${wireBytes} bytes exceeds the ${maxPacketBytes} byte ceiling.`,
            fatal: true,
          });
          return events;
        }
        if (at + wireBytes > joined.byteLength) break;
        // Sliced, not subarrayed — the joined buffer is transient.
        const body = joined.slice(at + 1 + lengthBytes, at + wireBytes);
        try {
          events.push({
            ok: true,
            packet: decodeMqttPacketBody(typeNibble, joined[at] & 0x0f, body, version),
            wireBytes,
            remainingLength,
          });
        } catch (error) {
          const message = error instanceof MqttCodecError ? error.message : String(error);
          events.push({ ok: false, error: message, fatal: false });
        }
        at += wireBytes;
      }
      carry = at < joined.byteLength ? joined.slice(at) : new Uint8Array(0);
      return events;
    },
    pendingBytes(): number {
      return carry.byteLength;
    },
  };
}
