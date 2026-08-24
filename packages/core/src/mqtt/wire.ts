/**
 * MQTT wire primitives — the byte-level substrate under the packet
 * grammar: the 1–4 byte base-128 variable byte integer (remaining
 * length and the 5.0 varint lanes), big-endian two/four-byte integers,
 * the length-prefixed UTF-8 string with the spec's character rules,
 * length-prefixed binary data, a bounds-checked reader, and a growable
 * writer. The packet codec, the 5.0 property block, and the incremental
 * stream decoder all share this one module so byte order and string
 * rules never fork.
 */

/** Codec failure — malformed wire bytes on decode, or a packet model
 *  the target protocol version cannot carry on encode. Internal to the
 *  grammar: the public encode/decode APIs catch it and report a
 *  result, never throw. */
export class MqttCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MqttCodecError';
  }
}

/** Largest value a variable byte integer encodes (4 bytes × 7 bits). */
export const MQTT_VARINT_MAX = 268_435_455;

/** Byte ceiling of every UTF-8 string and binary field (the two-byte
 *  length prefix's range). */
export const MQTT_STRING_MAX_BYTES = 65_535;

const UTF8_ENCODER = new TextEncoder();
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });

/** UTF-8 byte length of a string — the wire size its field will carry
 *  (topic validation checks the ceiling before encode does). */
export function utf8ByteLength(text: string): number {
  return UTF8_ENCODER.encode(text).byteLength;
}

/** Bounds-checked cursor over one packet body's bytes. Every overrun
 *  throws `MqttCodecError` — never a silent truncation. */
export class MqttReader {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get atEnd(): boolean {
    return this.pos >= this.bytes.length;
  }

  get remaining(): number {
    return this.bytes.length - this.pos;
  }

  private need(count: number): number {
    if (this.pos + count > this.bytes.length) throw new MqttCodecError('Truncated packet.');
    const at = this.pos;
    this.pos += count;
    return at;
  }

  byte(): number {
    return this.bytes[this.need(1)];
  }

  /** Big-endian two-byte integer. */
  twoByteInt(): number {
    const at = this.need(2);
    return (this.bytes[at] << 8) | this.bytes[at + 1];
  }

  /** Big-endian four-byte integer. */
  fourByteInt(): number {
    const at = this.need(4);
    return ((this.bytes[at] << 24) | (this.bytes[at + 1] << 16) | (this.bytes[at + 2] << 8) | this.bytes[at + 3]) >>> 0;
  }

  /** Variable byte integer — base-128, low group first, 4 bytes max. */
  varint(): number {
    let value = 0;
    let multiplier = 1;
    for (let i = 0; i < 4; i++) {
      const byte = this.bytes[this.need(1)];
      value += (byte & 0x7f) * multiplier;
      if ((byte & 0x80) === 0) return value;
      multiplier *= 128;
    }
    throw new MqttCodecError('Variable byte integer exceeds 4 bytes.');
  }

  /** A `length` byte window as a subarray view (no copy). */
  window(length: number): Uint8Array {
    const at = this.need(length);
    return this.bytes.subarray(at, at + length);
  }

  /** Two-byte length prefix + that many bytes. */
  binary(): Uint8Array {
    return this.window(this.twoByteInt());
  }

  /** Length-prefixed UTF-8 string under the spec's rules: well-formed
   *  UTF-8 (surrogate byte sequences included) and no U+0000. */
  utf8String(): string {
    const bytes = this.binary();
    let text: string;
    try {
      text = UTF8_STRICT.decode(bytes);
    } catch {
      throw new MqttCodecError('String is not well-formed UTF-8.');
    }
    if (text.includes('\u0000')) throw new MqttCodecError('String contains U+0000.');
    return text;
  }

  /** Every remaining byte as a subarray view — the PUBLISH payload. */
  rest(): Uint8Array {
    const at = this.pos;
    this.pos = this.bytes.length;
    return this.bytes.subarray(at);
  }
}

/** Growable output buffer for packet encoding. Range checks live on
 *  the write methods so an out-of-range model value reports as a codec
 *  error instead of silently truncating on the wire. */
export class MqttWriter {
  private buffer = new Uint8Array(256);
  private length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }

  get size(): number {
    return this.length;
  }

  byte(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new MqttCodecError(`Byte value out of range: ${value}.`);
    }
    this.ensure(1);
    this.buffer[this.length] = value;
    this.length++;
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  twoByteInt(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new MqttCodecError(`Two-byte integer out of range: ${value}.`);
    }
    this.ensure(2);
    this.buffer[this.length] = value >>> 8;
    this.buffer[this.length + 1] = value & 0xff;
    this.length += 2;
  }

  fourByteInt(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
      throw new MqttCodecError(`Four-byte integer out of range: ${value}.`);
    }
    this.ensure(4);
    this.buffer[this.length] = value >>> 24;
    this.buffer[this.length + 1] = (value >>> 16) & 0xff;
    this.buffer[this.length + 2] = (value >>> 8) & 0xff;
    this.buffer[this.length + 3] = value & 0xff;
    this.length += 4;
  }

  varint(value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > MQTT_VARINT_MAX) {
      throw new MqttCodecError(`Variable byte integer out of range: ${value}.`);
    }
    let rest = value;
    do {
      let byte = rest % 128;
      rest = Math.floor(rest / 128);
      if (rest > 0) byte |= 0x80;
      this.byte(byte);
    } while (rest > 0);
  }

  binary(bytes: Uint8Array): void {
    if (bytes.byteLength > MQTT_STRING_MAX_BYTES) {
      throw new MqttCodecError(`Binary field of ${bytes.byteLength} bytes exceeds ${MQTT_STRING_MAX_BYTES}.`);
    }
    this.twoByteInt(bytes.byteLength);
    this.raw(bytes);
  }

  utf8String(text: string): void {
    if (text.includes('\u0000')) throw new MqttCodecError('String contains U+0000.');
    const bytes = UTF8_ENCODER.encode(text);
    if (bytes.byteLength > MQTT_STRING_MAX_BYTES) {
      throw new MqttCodecError(`String of ${bytes.byteLength} bytes exceeds ${MQTT_STRING_MAX_BYTES}.`);
    }
    this.twoByteInt(bytes.byteLength);
    this.raw(bytes);
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}
