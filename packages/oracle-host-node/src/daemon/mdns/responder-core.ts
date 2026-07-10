/**
 * mDNS responder decision core (Phase 6 discovery) — pure evaluation
 * from parsed questions to the answer records advertising this daemon
 * as one `_openheaders._tcp.local` service instance. DNS-SD layout
 * (RFC 6763): PTR names the instance under the service type, SRV/TXT
 * describe it, A resolves the target host. No sockets — the transport
 * lives in `mdns-advertiser.ts`, same split as the admission matrix.
 *
 * Deliberate non-goals for a single low-churn advertise-only service:
 * probing/conflict resolution (names derive from the OS hostname, whose
 * LAN uniqueness the platform responder already maintains), known-answer
 * suppression, and IPv6 (AAAA) — the pairing surface enumerates IPv4
 * only (`lan-addresses.ts`).
 */

import type { DnsAnswer, DnsQuestion } from './dns-wire';
import { DNS_TYPE_A, DNS_TYPE_ANY, DNS_TYPE_PTR, DNS_TYPE_SRV, DNS_TYPE_TXT } from './dns-wire';

export const OPENHEADERS_SERVICE_TYPE = '_openheaders._tcp.local';

/** DNS-SD meta-query name — "what service types exist here?" (RFC 6763 §9). */
const SERVICE_ENUMERATION_NAME = '_services._dns-sd._udp.local';

/** RFC 6762 §10 recommends 75 minutes for host/service records. */
const RECORD_TTL_SECONDS = 4500;

export interface ServiceAdvertisement {
  /** Single DNS label naming this instance (typically the OS hostname's first label). */
  readonly instanceLabel: string;
  /** The advertised port — whatever the bind supervisor actually bound. */
  readonly port: number;
  /** Non-loopback IPv4 addresses to publish as A records. */
  readonly ipv4Addresses: readonly string[];
  /** TXT entries (`key=value`), e.g. the daemon version. */
  readonly textEntries: readonly string[];
}

function instanceName(ad: ServiceAdvertisement): string {
  return `${ad.instanceLabel}.${OPENHEADERS_SERVICE_TYPE}`;
}

function hostName(ad: ServiceAdvertisement): string {
  return `${ad.instanceLabel}.local`;
}

function ptrRecord(ad: ServiceAdvertisement, ttlSeconds: number): DnsAnswer {
  return { kind: 'PTR', name: OPENHEADERS_SERVICE_TYPE, ttlSeconds, targetName: instanceName(ad) };
}

function srvRecord(ad: ServiceAdvertisement, ttlSeconds: number): DnsAnswer {
  return { kind: 'SRV', name: instanceName(ad), ttlSeconds, port: ad.port, targetName: hostName(ad) };
}

function txtRecord(ad: ServiceAdvertisement, ttlSeconds: number): DnsAnswer {
  return { kind: 'TXT', name: instanceName(ad), ttlSeconds, texts: ad.textEntries };
}

function aRecords(ad: ServiceAdvertisement, ttlSeconds: number): DnsAnswer[] {
  return ad.ipv4Addresses.map((ipv4) => ({ kind: 'A', name: hostName(ad), ttlSeconds, ipv4 }));
}

function fullRecordSet(ad: ServiceAdvertisement, ttlSeconds: number): DnsAnswer[] {
  return [ptrRecord(ad, ttlSeconds), srvRecord(ad, ttlSeconds), txtRecord(ad, ttlSeconds), ...aRecords(ad, ttlSeconds)];
}

/**
 * The unsolicited announcement sent on start (RFC 6762 §8.3 — repeated
 * by the transport): the whole record set, so caches light up without
 * a query round-trip.
 */
export function announcementRecords(ad: ServiceAdvertisement): readonly DnsAnswer[] {
  return fullRecordSet(ad, RECORD_TTL_SECONDS);
}

/**
 * The goodbye sent on stop (RFC 6762 §10.1): the same set with TTL 0,
 * so peer caches drop this instance immediately instead of serving a
 * dead daemon for the remaining TTL.
 */
export function goodbyeRecords(ad: ServiceAdvertisement): readonly DnsAnswer[] {
  return fullRecordSet(ad, 0);
}

/**
 * Answer one incoming query: records for every question that names this
 * service, deduplicated across questions; empty when none match (the
 * transport then stays silent — answering unrelated names is how a
 * responder becomes LAN noise).
 *
 * A service-type PTR question is answered with the full set — SRV, TXT,
 * and A ride along as the additionals RFC 6763 §12.1 tells browsers to
 * expect, saving the follow-up queries.
 */
export function answerQuestions(questions: readonly DnsQuestion[], ad: ServiceAdvertisement): readonly DnsAnswer[] {
  const answers: DnsAnswer[] = [];
  for (const question of questions) {
    for (const answer of answersForQuestion(question, ad)) {
      if (!answers.some((existing) => sameRecord(existing, answer))) answers.push(answer);
    }
  }
  return answers;
}

function answersForQuestion(question: DnsQuestion, ad: ServiceAdvertisement): readonly DnsAnswer[] {
  const name = question.name;
  const wants = (type: number): boolean => question.type === type || question.type === DNS_TYPE_ANY;
  if (name === SERVICE_ENUMERATION_NAME && wants(DNS_TYPE_PTR)) {
    return [
      {
        kind: 'PTR',
        name: SERVICE_ENUMERATION_NAME,
        ttlSeconds: RECORD_TTL_SECONDS,
        targetName: OPENHEADERS_SERVICE_TYPE,
      },
    ];
  }
  if (name === OPENHEADERS_SERVICE_TYPE && wants(DNS_TYPE_PTR)) {
    return fullRecordSet(ad, RECORD_TTL_SECONDS);
  }
  if (name === instanceName(ad).toLowerCase()) {
    const out: DnsAnswer[] = [];
    if (wants(DNS_TYPE_SRV)) out.push(srvRecord(ad, RECORD_TTL_SECONDS));
    if (wants(DNS_TYPE_TXT)) out.push(txtRecord(ad, RECORD_TTL_SECONDS));
    if (out.some((a) => a.kind === 'SRV')) out.push(...aRecords(ad, RECORD_TTL_SECONDS));
    return out;
  }
  if (name === hostName(ad).toLowerCase() && wants(DNS_TYPE_A)) {
    return aRecords(ad, RECORD_TTL_SECONDS);
  }
  return [];
}

function sameRecord(a: DnsAnswer, b: DnsAnswer): boolean {
  if (a.kind !== b.kind || a.name !== b.name) return false;
  if (a.kind === 'A' && b.kind === 'A') return a.ipv4 === b.ipv4;
  return true;
}
