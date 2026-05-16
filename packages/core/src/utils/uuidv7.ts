/**
 * UUIDv7 generator — RFC 9562 §5.7.
 *
 * UUIDv7 prepends a 48-bit unix-millisecond timestamp to 74 bits of
 * randomness, giving an id that is **globally unique** AND **k-orderable
 * by time of mint**. Both properties matter for cross-host identifiers
 * the sync engine touches: workspaceId today, deviceId / mutationId
 * generalizations later.
 *
 * Why not v4: v4 is order-free, so two hosts that mint workspaces
 * offline have no way to break tie when their data merges; sorting
 * "newest workspace first" in a UI requires a separate `createdAt`.
 * Why not v1: leaks MAC; not portable across runtimes.
 *
 * **Format.** Canonical 36-char lowercase form: `tttttttt-tttt-7rrr-yrrr-rrrrrrrrrrrr`.
 *   - bytes 0-5: timestamp_ms (big-endian, 48 bits)
 *   - byte 6 high nibble: version `7`
 *   - byte 6 low nibble: 4 random bits (rand_a)
 *   - byte 7: 8 random bits (rand_a)
 *   - byte 8 high two bits: variant `10` (RFC 9562 §4.1)
 *   - byte 8 low six bits + bytes 9-15: 62 random bits (rand_b)
 *
 * **Monotonicity within the same millisecond.** Counter approach is
 * deliberately skipped: workspace IDs mint once per user gesture (sub-
 * Hz). When a future caller (mutationId, deviceId) needs sub-ms
 * monotonicity, the rand_a region is the natural place to plug a
 * counter without changing this function's signature.
 *
 * **Source of randomness.** `crypto.getRandomValues` — present in every
 * target runtime (SW, browser tab, Node 19+, Electron main, daemon
 * Node host). The Web Crypto API is the cross-platform constant.
 */

/** Length of a canonical UUIDv7 string. */
export const UUIDV7_LENGTH = 36;

const HEX_CHARS = '0123456789abcdef';
const UUIDV7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function getCrypto(): { getRandomValues: (buf: Uint8Array) => Uint8Array } {
  const c = (globalThis as { crypto?: { getRandomValues?: (buf: Uint8Array) => Uint8Array } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('uuidv7: globalThis.crypto.getRandomValues is required');
  }
  return c as { getRandomValues: (buf: Uint8Array) => Uint8Array };
}

function byteToHex(byte: number): string {
  return HEX_CHARS[(byte >> 4) & 0x0f] + HEX_CHARS[byte & 0x0f];
}

/**
 * Mint a fresh UUIDv7. Pure — no module state, no monotonicity counter.
 * Two concurrent calls within the same millisecond return ids whose
 * relative order is determined by their random tails; that's fine for
 * coarse-grained mints (workspaces, devices) but inadequate for hot-
 * path mints (mutationId at gesture rate). Hot-path callers should
 * compose a counter on top.
 */
export function uuidv7(): string {
  const buf = new Uint8Array(16);
  getCrypto().getRandomValues(buf);

  // 48-bit unix-ms big-endian timestamp.
  const ms = Date.now();
  // Date.now is a regular number; ms fits in 53 bits, so the >>> 0
  // dance gives us the low 32 cleanly without BigInt overhead.
  const msHigh = Math.floor(ms / 0x1_0000_0000); // upper 21 bits
  const msLow = ms >>> 0; // lower 32 bits
  buf[0] = (msHigh >> 8) & 0xff;
  buf[1] = msHigh & 0xff;
  buf[2] = (msLow >>> 24) & 0xff;
  buf[3] = (msLow >>> 16) & 0xff;
  buf[4] = (msLow >>> 8) & 0xff;
  buf[5] = msLow & 0xff;

  // Version 7 in the high nibble of byte 6; preserve random low nibble.
  buf[6] = (buf[6] & 0x0f) | 0x70;
  // RFC 4122 variant `10` in the high two bits of byte 8.
  buf[8] = (buf[8] & 0x3f) | 0x80;

  return (
    byteToHex(buf[0]) +
    byteToHex(buf[1]) +
    byteToHex(buf[2]) +
    byteToHex(buf[3]) +
    '-' +
    byteToHex(buf[4]) +
    byteToHex(buf[5]) +
    '-' +
    byteToHex(buf[6]) +
    byteToHex(buf[7]) +
    '-' +
    byteToHex(buf[8]) +
    byteToHex(buf[9]) +
    '-' +
    byteToHex(buf[10]) +
    byteToHex(buf[11]) +
    byteToHex(buf[12]) +
    byteToHex(buf[13]) +
    byteToHex(buf[14]) +
    byteToHex(buf[15])
  );
}

/**
 * True iff `s` is a canonical UUIDv7 string. Validates format AND the
 * version + variant nibbles — so a UUIDv4 string returns `false`.
 * Pure regex; no allocation beyond the regex match.
 */
export function isUuidV7(s: string): boolean {
  return typeof s === 'string' && s.length === UUIDV7_LENGTH && UUIDV7_REGEX.test(s);
}

/**
 * Extract the 48-bit unix-millisecond timestamp from a UUIDv7. Returns
 * `null` for malformed inputs. Useful for displaying createdAt without
 * a separate field, or sorting a list by mint time when the canonical
 * surface lost the explicit timestamp.
 */
export function uuidV7Timestamp(s: string): number | null {
  if (!isUuidV7(s)) return null;
  const hex = s.replace(/-/g, '');
  // Bytes 0-5 = 12 hex chars.
  return parseInt(hex.slice(0, 12), 16);
}
