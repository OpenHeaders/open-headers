/**
 * mDNS responder decision core (Phase 6 discovery) — pure question →
 * answer evaluation for the `_openheaders._tcp.local` advertisement:
 * service-type PTR with the full rideshare set, meta-query enumeration,
 * instance SRV/TXT, host A, silence on unrelated names, dedup across
 * questions, and the announce/goodbye record sets.
 */

import { describe, expect, it } from 'vitest';
import { DNS_TYPE_A, DNS_TYPE_ANY, DNS_TYPE_PTR, DNS_TYPE_SRV, DNS_TYPE_TXT } from '../../../src/daemon/mdns/dns-wire';
import {
  announcementRecords,
  answerQuestions,
  goodbyeRecords,
  OPENHEADERS_SERVICE_TYPE,
  type ServiceAdvertisement,
} from '../../../src/daemon/mdns/responder-core';

function ad(overrides: Partial<ServiceAdvertisement> = {}): ServiceAdvertisement {
  return {
    instanceLabel: 'studio',
    port: 8137,
    ipv4Addresses: ['192.168.1.20', '10.0.0.5'],
    textEntries: ['v=2026.7.0'],
    ...overrides,
  };
}

describe('answerQuestions', () => {
  it('answers a service-type PTR query with the full record set', () => {
    const answers = answerQuestions([{ name: OPENHEADERS_SERVICE_TYPE, type: DNS_TYPE_PTR }], ad());
    expect(answers.map((a) => a.kind)).toEqual(['PTR', 'SRV', 'TXT', 'A', 'A']);
    const ptr = answers[0];
    expect(ptr).toMatchObject({ name: OPENHEADERS_SERVICE_TYPE, targetName: 'studio._openheaders._tcp.local' });
    const srv = answers[1];
    expect(srv).toMatchObject({ name: 'studio._openheaders._tcp.local', port: 8137, targetName: 'studio.local' });
    expect(answers[3]).toMatchObject({ name: 'studio.local', ipv4: '192.168.1.20' });
  });

  it('answers the DNS-SD meta-query with the service type', () => {
    const answers = answerQuestions([{ name: '_services._dns-sd._udp.local', type: DNS_TYPE_PTR }], ad());
    expect(answers).toEqual([expect.objectContaining({ kind: 'PTR', targetName: OPENHEADERS_SERVICE_TYPE })]);
  });

  it('answers instance SRV with A records riding along, TXT alone without them', () => {
    const srvAnswers = answerQuestions([{ name: 'studio._openheaders._tcp.local', type: DNS_TYPE_SRV }], ad());
    expect(srvAnswers.map((a) => a.kind)).toEqual(['SRV', 'A', 'A']);
    const txtAnswers = answerQuestions([{ name: 'studio._openheaders._tcp.local', type: DNS_TYPE_TXT }], ad());
    expect(txtAnswers.map((a) => a.kind)).toEqual(['TXT']);
    expect(txtAnswers[0]).toMatchObject({ texts: ['v=2026.7.0'] });
  });

  it('answers host A queries and ANY queries', () => {
    const aAnswers = answerQuestions([{ name: 'studio.local', type: DNS_TYPE_A }], ad());
    expect(aAnswers.map((a) => a.kind === 'A' && a.ipv4)).toEqual(['192.168.1.20', '10.0.0.5']);
    const anyAnswers = answerQuestions([{ name: 'studio._openheaders._tcp.local', type: DNS_TYPE_ANY }], ad());
    expect(anyAnswers.map((a) => a.kind)).toEqual(['SRV', 'TXT', 'A', 'A']);
  });

  it('stays silent on unrelated names and mismatched types', () => {
    expect(answerQuestions([{ name: '_ipp._tcp.local', type: DNS_TYPE_PTR }], ad())).toEqual([]);
    expect(answerQuestions([{ name: 'other.local', type: DNS_TYPE_A }], ad())).toEqual([]);
    expect(answerQuestions([{ name: OPENHEADERS_SERVICE_TYPE, type: DNS_TYPE_A }], ad())).toEqual([]);
    expect(answerQuestions([{ name: 'studio.local', type: DNS_TYPE_SRV }], ad())).toEqual([]);
  });

  it('deduplicates records across overlapping questions', () => {
    const answers = answerQuestions(
      [
        { name: OPENHEADERS_SERVICE_TYPE, type: DNS_TYPE_PTR },
        { name: 'studio._openheaders._tcp.local', type: DNS_TYPE_SRV },
        { name: 'studio.local', type: DNS_TYPE_A },
      ],
      ad(),
    );
    expect(answers.map((a) => a.kind)).toEqual(['PTR', 'SRV', 'TXT', 'A', 'A']);
  });
});

describe('announcement and goodbye', () => {
  it('announcement carries the full set with a live TTL', () => {
    const records = announcementRecords(ad());
    expect(records.map((r) => r.kind)).toEqual(['PTR', 'SRV', 'TXT', 'A', 'A']);
    expect(records.every((r) => r.ttlSeconds > 0)).toBe(true);
  });

  it('goodbye repeats the set with TTL 0', () => {
    const records = goodbyeRecords(ad());
    expect(records.map((r) => r.kind)).toEqual(['PTR', 'SRV', 'TXT', 'A', 'A']);
    expect(records.every((r) => r.ttlSeconds === 0)).toBe(true);
  });
});
