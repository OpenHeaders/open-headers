/**
 * Add gate — the decision the Trusted Certificates add flow makes over
 * a pasted PEM before the Add button lights up.
 *
 * One PEM blob per row (a chain is ONE root — the S1 chain law); a
 * non-CA leaf is refused because a server certificate in the trust
 * list is a footgun, not a feature. Pure over `summarizeCertificatePem`
 * so the refusal rules pin without a DOM.
 */

import { type CertificateSummary, summarizeCertificatePem } from '@openheaders/core/utils';

export type TrustedRootGate =
  | { ok: true; summary: CertificateSummary }
  | { ok: false; reason: 'empty' }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'not-ca'; summary: CertificateSummary };

export async function gateTrustedRootPem(pem: string): Promise<TrustedRootGate> {
  if (!pem.trim()) return { ok: false, reason: 'empty' };
  let summary: CertificateSummary;
  try {
    summary = await summarizeCertificatePem(pem);
  } catch (err) {
    return { ok: false, reason: 'invalid', message: err instanceof Error ? err.message : String(err) };
  }
  if (!summary.isCa) return { ok: false, reason: 'not-ca', summary };
  return { ok: true, summary };
}

/** The `CN=` attribute of a distinguished name, else the whole name. */
export function subjectCommonName(subject: string): string {
  const match = /(?:^|,\s*)CN=([^,]+)/.exec(subject);
  return match ? match[1].trim() : subject;
}

/** `ab12…` hex → `AB:12:…` — the fingerprint form a browser shows. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{1,2}/g) ?? []).join(':');
}

export function isExpired(notAfter: string, now: number): boolean {
  return new Date(notAfter).getTime() < now;
}
