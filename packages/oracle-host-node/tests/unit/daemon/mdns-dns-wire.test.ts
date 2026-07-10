/**
 * DNS wire codec (Phase 6 discovery) — query parsing (header gates,
 * label decoding, compression pointers, malformed-packet refusal) and
 * response encoding (record layouts, cache-flush classes, TTLs) for
 * the mDNS responder's PTR/SRV/TXT/A vocabulary.
 */

import { describe, expect, it } from 'vitest';
import {
  DNS_TYPE_A,
  DNS_TYPE_PTR,
  DNS_TYPE_SRV,
  type DnsAnswer,
  encodeDnsResponse,
  parseDnsQuery,
} from '../../../src/daemon/mdns/dns-wire';

function encodeName(name: string): Buffer {
  const parts: Buffer[] = [];
  for (const label of name.split('.').filter((l) => l.length > 0)) {
    parts.push(Buffer.from([label.length]), Buffer.from(label, 'utf8'));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

function queryPacket(questions: readonly { name: string; type: number }[]): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(questions.length, 4);
  const body = questions.map((q) => {
    const fixed = Buffer.alloc(4);
    fixed.writeUInt16BE(q.type, 0);
    fixed.writeUInt16BE(1, 2);
    return Buffer.concat([encodeName(q.name), fixed]);
  });
  return Buffer.concat([header, ...body]);
}

describe('parseDnsQuery', () => {
  it('parses a single-question PTR query', () => {
    const questions = parseDnsQuery(queryPacket([{ name: '_openheaders._tcp.local', type: DNS_TYPE_PTR }]));
    expect(questions).toEqual([{ name: '_openheaders._tcp.local', type: DNS_TYPE_PTR }]);
  });

  it('lower-cases names and parses multiple questions', () => {
    const questions = parseDnsQuery(
      queryPacket([
        { name: '_OpenHeaders._TCP.local', type: DNS_TYPE_PTR },
        { name: 'studio.local', type: DNS_TYPE_A },
      ]),
    );
    expect(questions).toEqual([
      { name: '_openheaders._tcp.local', type: DNS_TYPE_PTR },
      { name: 'studio.local', type: DNS_TYPE_A },
    ]);
  });

  it('decodes compression pointers in question names', () => {
    // Question 1 carries `_openheaders._tcp.local` inline; question 2's
    // name is a bare pointer back to it.
    const header = Buffer.alloc(12);
    header.writeUInt16BE(2, 4);
    const q1Name = encodeName('_openheaders._tcp.local');
    const q1Fixed = Buffer.alloc(4);
    q1Fixed.writeUInt16BE(DNS_TYPE_PTR, 0);
    q1Fixed.writeUInt16BE(1, 2);
    const pointer = Buffer.from([0xc0, 12]); // offset of q1's name
    const q2Fixed = Buffer.alloc(4);
    q2Fixed.writeUInt16BE(DNS_TYPE_SRV, 0);
    q2Fixed.writeUInt16BE(1, 2);
    const packet = Buffer.concat([header, q1Name, q1Fixed, pointer, q2Fixed]);
    expect(parseDnsQuery(packet)).toEqual([
      { name: '_openheaders._tcp.local', type: DNS_TYPE_PTR },
      { name: '_openheaders._tcp.local', type: DNS_TYPE_SRV },
    ]);
  });

  it('refuses responses, non-query opcodes, and empty question sections', () => {
    const response = queryPacket([{ name: 'studio.local', type: DNS_TYPE_A }]);
    response.writeUInt16BE(0x8400, 2);
    expect(parseDnsQuery(response)).toBeNull();

    const update = queryPacket([{ name: 'studio.local', type: DNS_TYPE_A }]);
    update.writeUInt16BE(5 << 11, 2); // UPDATE opcode
    expect(parseDnsQuery(update)).toBeNull();

    expect(parseDnsQuery(Buffer.alloc(12))).toBeNull();
  });

  it('refuses truncated and pointer-looping packets instead of throwing', () => {
    const truncated = queryPacket([{ name: '_openheaders._tcp.local', type: DNS_TYPE_PTR }]).subarray(0, 20);
    expect(parseDnsQuery(truncated)).toBeNull();

    const header = Buffer.alloc(12);
    header.writeUInt16BE(1, 4);
    const loop = Buffer.concat([header, Buffer.from([0xc0, 12, 0, DNS_TYPE_PTR, 0, 1])]);
    expect(parseDnsQuery(loop)).toBeNull();

    expect(parseDnsQuery(Buffer.alloc(3))).toBeNull();
  });
});

describe('encodeDnsResponse', () => {
  function record(
    buf: Buffer,
    offset: number,
  ): { name: Buffer; type: number; cls: number; ttl: number; rdata: Buffer; next: number } {
    let end = offset;
    while (buf[end] !== 0) end += 1 + (buf[end] as number);
    end += 1;
    const type = buf.readUInt16BE(end);
    const cls = buf.readUInt16BE(end + 2);
    const ttl = buf.readUInt32BE(end + 4);
    const rdlength = buf.readUInt16BE(end + 8);
    const rdata = buf.subarray(end + 10, end + 10 + rdlength);
    return { name: buf.subarray(offset, end), type, cls, ttl, rdata, next: end + 10 + rdlength };
  }

  it('encodes an authoritative response with the answer count', () => {
    const answers: DnsAnswer[] = [
      { kind: 'PTR', name: '_openheaders._tcp.local', ttlSeconds: 4500, targetName: 'studio._openheaders._tcp.local' },
      { kind: 'A', name: 'studio.local', ttlSeconds: 4500, ipv4: '192.168.1.20' },
    ];
    const buf = encodeDnsResponse(answers);
    expect(buf.readUInt16BE(2)).toBe(0x8400); // QR + AA
    expect(buf.readUInt16BE(4)).toBe(0); // no questions
    expect(buf.readUInt16BE(6)).toBe(2); // answers
  });

  it('PTR stays shared-class while unique records carry cache-flush', () => {
    const buf = encodeDnsResponse([
      { kind: 'PTR', name: '_openheaders._tcp.local', ttlSeconds: 4500, targetName: 'studio._openheaders._tcp.local' },
      { kind: 'A', name: 'studio.local', ttlSeconds: 4500, ipv4: '192.168.1.20' },
    ]);
    const first = record(buf, 12);
    const second = record(buf, first.next);
    expect(first.type).toBe(DNS_TYPE_PTR);
    expect(first.cls).toBe(1);
    expect(second.type).toBe(DNS_TYPE_A);
    expect(second.cls).toBe(0x8001);
    expect(second.rdata).toEqual(Buffer.from([192, 168, 1, 20]));
  });

  it('encodes SRV port/target and TXT character-strings', () => {
    const buf = encodeDnsResponse([
      { kind: 'SRV', name: 'studio._openheaders._tcp.local', ttlSeconds: 0, port: 8137, targetName: 'studio.local' },
      { kind: 'TXT', name: 'studio._openheaders._tcp.local', ttlSeconds: 4500, texts: ['v=2026.7.0'] },
      { kind: 'TXT', name: 'studio._openheaders._tcp.local', ttlSeconds: 4500, texts: [] },
    ]);
    const srv = record(buf, 12);
    expect(srv.ttl).toBe(0);
    expect(srv.rdata.readUInt16BE(4)).toBe(8137);
    expect(srv.rdata.subarray(6)).toEqual(encodeName('studio.local'));
    const txt = record(buf, srv.next);
    expect(txt.rdata).toEqual(Buffer.concat([Buffer.from([10]), Buffer.from('v=2026.7.0')]));
    const emptyTxt = record(buf, txt.next);
    expect(emptyTxt.rdata).toEqual(Buffer.from([0])); // one empty character-string
  });

  it('refuses malformed rdata inputs loudly', () => {
    expect(() => encodeDnsResponse([{ kind: 'A', name: 'studio.local', ttlSeconds: 1, ipv4: 'not-an-ip' }])).toThrow(
      /IPv4/,
    );
    expect(() =>
      encodeDnsResponse([
        { kind: 'TXT', name: 'studio._openheaders._tcp.local', ttlSeconds: 1, texts: ['x'.repeat(256)] },
      ]),
    ).toThrow(/255/);
  });
});
