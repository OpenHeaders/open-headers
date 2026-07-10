/**
 * Minimal DNS wire codec for the mDNS responder (Phase 6 discovery) —
 * just enough of RFC 1035/6762 to parse incoming multicast queries and
 * encode the responder's answers. Hand-rolled over Buffer because the
 * static-bundling law makes a dependency unattractive for one service
 * type; anything this module can't parse is silently ignored by the
 * caller (mDNS is a broadcast medium — most traffic is other people's).
 *
 * Scope: queries in (header + question section, with name-compression
 * pointers decoded — multi-question queries from platform responders
 * compress), responses out (uncompressed names, which every parser must
 * accept; compression is an encoder option, not a contract). Record
 * types limited to what service advertising needs: PTR, SRV, TXT, A.
 *
 * Pure functions over bytes — no sockets, unit-testable without a
 * network (same split as `admission-matrix.ts` vs `admission-control.ts`).
 */

export const DNS_TYPE_A = 1;
export const DNS_TYPE_PTR = 12;
export const DNS_TYPE_TXT = 16;
export const DNS_TYPE_SRV = 33;
export const DNS_TYPE_ANY = 255;

const DNS_CLASS_IN = 1;
/** mDNS cache-flush bit on answers (RFC 6762 §10.2) — set on unique record sets. */
const CACHE_FLUSH_BIT = 0x8000;
/** QR=1 (response) + AA=1 (authoritative) — the only flags an mDNS responder sets. */
const RESPONSE_FLAGS = 0x8400;
const HEADER_BYTES = 12;
/** Compression-pointer marker: top two bits of a length octet. */
const POINTER_MASK = 0xc0;

export interface DnsQuestion {
  /** Lower-cased dotted name without the trailing root dot. */
  readonly name: string;
  readonly type: number;
}

/** The record shapes the responder can answer with. */
export type DnsAnswer =
  | { readonly kind: 'PTR'; readonly name: string; readonly ttlSeconds: number; readonly targetName: string }
  | {
      readonly kind: 'SRV';
      readonly name: string;
      readonly ttlSeconds: number;
      readonly port: number;
      readonly targetName: string;
    }
  | { readonly kind: 'TXT'; readonly name: string; readonly ttlSeconds: number; readonly texts: readonly string[] }
  | { readonly kind: 'A'; readonly name: string; readonly ttlSeconds: number; readonly ipv4: string };

/**
 * Parse one incoming mDNS message into its question list, or null when
 * the message is not a plain query (responses, non-zero opcodes) or is
 * malformed. Answer/authority/additional sections are not parsed — the
 * responder never reads them (known-answer suppression is a deliberate
 * non-goal for a single low-churn service).
 */
export function parseDnsQuery(message: Buffer): readonly DnsQuestion[] | null {
  if (message.length < HEADER_BYTES) return null;
  const flags = message.readUInt16BE(2);
  const isResponse = (flags & 0x8000) !== 0;
  const opcode = (flags >> 11) & 0x0f;
  if (isResponse || opcode !== 0) return null;
  const questionCount = message.readUInt16BE(4);
  if (questionCount === 0) return null;

  const questions: DnsQuestion[] = [];
  let offset = HEADER_BYTES;
  for (let i = 0; i < questionCount; i++) {
    const decoded = decodeName(message, offset);
    if (decoded === null) return null;
    offset = decoded.nextOffset;
    if (offset + 4 > message.length) return null;
    const type = message.readUInt16BE(offset);
    questions.push({ name: decoded.name, type });
    offset += 4;
  }
  return questions;
}

interface DecodedName {
  readonly name: string;
  /** Offset just past the name as it appears at the original position. */
  readonly nextOffset: number;
}

function decodeName(message: Buffer, startOffset: number): DecodedName | null {
  const labels: string[] = [];
  let offset = startOffset;
  let nextOffset = -1;
  let jumps = 0;
  // A name is a run of length-prefixed labels ending in 0, where any
  // length octet may instead be a two-byte pointer to an earlier name.
  // The jump cap breaks pointer loops in hostile packets.
  while (true) {
    if (offset >= message.length || jumps > 32) return null;
    const length = message[offset] as number;
    if (length === 0) {
      if (nextOffset === -1) nextOffset = offset + 1;
      break;
    }
    if ((length & POINTER_MASK) === POINTER_MASK) {
      if (offset + 1 >= message.length) return null;
      if (nextOffset === -1) nextOffset = offset + 2;
      offset = ((length & 0x3f) << 8) | (message[offset + 1] as number);
      jumps += 1;
      continue;
    }
    if ((length & POINTER_MASK) !== 0) return null;
    if (offset + 1 + length > message.length) return null;
    labels.push(message.toString('utf8', offset + 1, offset + 1 + length).toLowerCase());
    offset += 1 + length;
  }
  return { name: labels.join('.'), nextOffset };
}

/**
 * Encode an authoritative mDNS response carrying the given answers.
 * Every record is stamped cache-flush except PTR: PTR sets are shared
 * (many instances answer the same service-type name), so flushing would
 * evict other responders' instances from peer caches (RFC 6762 §10.2).
 */
export function encodeDnsResponse(answers: readonly DnsAnswer[]): Buffer {
  const parts: Buffer[] = [];
  const header = Buffer.alloc(HEADER_BYTES);
  header.writeUInt16BE(0, 0); // mDNS responses use id 0
  header.writeUInt16BE(RESPONSE_FLAGS, 2);
  header.writeUInt16BE(0, 4); // no questions echoed
  header.writeUInt16BE(answers.length, 6);
  parts.push(header);
  for (const answer of answers) {
    parts.push(encodeAnswer(answer));
  }
  return Buffer.concat(parts);
}

function encodeAnswer(answer: DnsAnswer): Buffer {
  const rdata = encodeRdata(answer);
  const name = encodeName(answer.name);
  const fixed = Buffer.alloc(10);
  const recordClass = answer.kind === 'PTR' ? DNS_CLASS_IN : DNS_CLASS_IN | CACHE_FLUSH_BIT;
  fixed.writeUInt16BE(typeOf(answer), 0);
  fixed.writeUInt16BE(recordClass, 2);
  fixed.writeUInt32BE(answer.ttlSeconds, 4);
  fixed.writeUInt16BE(rdata.length, 8);
  return Buffer.concat([name, fixed, rdata]);
}

function typeOf(answer: DnsAnswer): number {
  switch (answer.kind) {
    case 'PTR':
      return DNS_TYPE_PTR;
    case 'SRV':
      return DNS_TYPE_SRV;
    case 'TXT':
      return DNS_TYPE_TXT;
    case 'A':
      return DNS_TYPE_A;
  }
}

function encodeRdata(answer: DnsAnswer): Buffer {
  switch (answer.kind) {
    case 'PTR':
      return encodeName(answer.targetName);
    case 'SRV': {
      const head = Buffer.alloc(6);
      head.writeUInt16BE(0, 0); // priority
      head.writeUInt16BE(0, 2); // weight
      head.writeUInt16BE(answer.port, 4);
      return Buffer.concat([head, encodeName(answer.targetName)]);
    }
    case 'TXT': {
      // RFC 1035 requires at least one character-string; an empty entry
      // list encodes as one zero-length string.
      const texts = answer.texts.length > 0 ? answer.texts : [''];
      return Buffer.concat(
        texts.map((text) => {
          const bytes = Buffer.from(text, 'utf8');
          if (bytes.length > 255) throw new Error(`TXT entry exceeds 255 bytes: ${text.slice(0, 40)}…`);
          return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
      );
    }
    case 'A': {
      const octets = answer.ipv4.split('.').map(Number);
      if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
        throw new Error(`not an IPv4 address: ${answer.ipv4}`);
      }
      return Buffer.from(octets);
    }
  }
}

function encodeName(name: string): Buffer {
  const labels = name.split('.').filter((label) => label.length > 0);
  const parts: Buffer[] = [];
  for (const label of labels) {
    const bytes = Buffer.from(label, 'utf8');
    if (bytes.length > 63) throw new Error(`DNS label exceeds 63 bytes: ${label}`);
    parts.push(Buffer.from([bytes.length]), bytes);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}
