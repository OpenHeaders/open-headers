/**
 * Protobuf wire primitives — the byte-level substrate under the
 * schema-driven codec: base-128 varints, zigzag transforms, fixed
 * little-endian words, a bounds-checked reader, and a growable writer.
 * 64-bit lanes ride BigInt end to end so int64 values stay exact (the
 * F3 exact-display law's wire-side guarantee — never a JS number
 * round-trip).
 */

/** Codec failure — malformed wire bytes on decode, or a JSON value
 *  that cannot map onto the schema on encode. */
export class ProtoCodecError extends Error {
  /** JSON path of the offending value (`$` = message root); empty for
   *  wire-level failures with no JSON locus. */
  readonly path: string;

  constructor(message: string, path = '') {
    super(path === '' ? message : `${message} (at ${path})`);
    this.name = 'ProtoCodecError';
    this.path = path;
  }
}

/** The wire types the codec speaks — groups (3/4) are rejected. */
export type ProtoWireType = 0 | 1 | 2 | 5;

/** Zigzag-encode a signed 64-bit value to its unsigned wire form. */
export function zigzagEncode64(value: bigint): bigint {
  return BigInt.asUintN(64, (value << 1n) ^ (value >> 63n));
}

/** Zigzag-decode an unsigned wire varint to its signed value. */
export function zigzagDecode64(value: bigint): bigint {
  return (value >> 1n) ^ -(value & 1n);
}

/** Bounds-checked cursor over one message's bytes. Every overrun
 *  throws `ProtoCodecError` — never a silent truncation. */
export class ProtoReader {
  private pos = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get atEnd(): boolean {
    return this.pos >= this.bytes.length;
  }

  private need(count: number): number {
    if (this.pos + count > this.bytes.length) throw new ProtoCodecError('Truncated message.');
    const at = this.pos;
    this.pos += count;
    return at;
  }

  /** Unsigned base-128 varint, 10 bytes max, masked to 64 bits. */
  varint(): bigint {
    let value = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      const byte = this.bytes[this.need(1)];
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return BigInt.asUintN(64, value);
      shift += 7n;
    }
    throw new ProtoCodecError('Varint exceeds 10 bytes.');
  }

  fixed32(): number {
    return this.view.getUint32(this.need(4), true);
  }

  sfixed32(): number {
    return this.view.getInt32(this.need(4), true);
  }

  float(): number {
    return this.view.getFloat32(this.need(4), true);
  }

  fixed64(): bigint {
    return this.view.getBigUint64(this.need(8), true);
  }

  sfixed64(): bigint {
    return this.view.getBigInt64(this.need(8), true);
  }

  double(): number {
    return this.view.getFloat64(this.need(8), true);
  }

  /** A `length` byte window as a subarray view (no copy). */
  window(length: number): Uint8Array {
    const at = this.need(length);
    return this.bytes.subarray(at, at + length);
  }

  /** Varint length prefix + that many bytes. */
  lengthDelimited(): Uint8Array {
    const length = this.varint();
    if (length > BigInt(this.bytes.length - this.pos)) {
      throw new ProtoCodecError('Length-delimited value overruns the message.');
    }
    return this.window(Number(length));
  }
}

/** Growable output buffer for wire encoding. */
export class ProtoWriter {
  private buffer = new Uint8Array(256);
  private length = 0;
  private readonly scratch = new DataView(new ArrayBuffer(8));

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
    this.ensure(1);
    this.buffer[this.length] = value;
    this.length++;
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buffer.set(bytes, this.length);
    this.length += bytes.length;
  }

  /** Unsigned base-128 varint of a value already masked to 64 bits. */
  varint(value: bigint): void {
    let rest = value;
    while (rest > 0x7fn) {
      this.byte(Number(rest & 0x7fn) | 0x80);
      rest >>= 7n;
    }
    this.byte(Number(rest));
  }

  varintNumber(value: number): void {
    this.varint(BigInt(value));
  }

  tag(fieldNumber: number, wireType: ProtoWireType): void {
    this.varint((BigInt(fieldNumber) << 3n) | BigInt(wireType));
  }

  private copyScratch(count: number): void {
    this.ensure(count);
    for (let i = 0; i < count; i++) {
      this.buffer[this.length] = this.scratch.getUint8(i);
      this.length++;
    }
  }

  fixed32(value: number): void {
    this.scratch.setUint32(0, value, true);
    this.copyScratch(4);
  }

  sfixed32(value: number): void {
    this.scratch.setInt32(0, value, true);
    this.copyScratch(4);
  }

  float(value: number): void {
    this.scratch.setFloat32(0, value, true);
    this.copyScratch(4);
  }

  fixed64(value: bigint): void {
    this.scratch.setBigUint64(0, value, true);
    this.copyScratch(8);
  }

  sfixed64(value: bigint): void {
    this.scratch.setBigInt64(0, value, true);
    this.copyScratch(8);
  }

  double(value: number): void {
    this.scratch.setFloat64(0, value, true);
    this.copyScratch(8);
  }

  finish(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}
