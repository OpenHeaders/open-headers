/**
 * Trusted Certificates add gate — the decision the editor makes over a
 * pasted PEM before Add lights up (the Trusted Roots plan §UI):
 *   - a CA root passes with its summary
 *   - a chain passes as ONE root, `chainLength` counted
 *   - a non-CA leaf is refused with the `not-ca` reason
 *   - empty / malformed input are refused with their own reasons
 *   - the name prefill reads the subject CN; fingerprints render as
 *     colon-separated hex pairs
 *
 * Fixtures are static PEMs minted once with the core summary test's
 * generator (ECDSA P-256, the root valid to 2036, the leaf to 2027 —
 * the expiry pin passes a fixed clock, never the wall clock).
 */

import {
  formatFingerprint,
  gateTrustedRootPem,
  isExpired,
  subjectCommonName,
} from '@openheaders/ui/workbench/components/trusted-roots/add-gate';
import { describe, expect, it } from 'vitest';

const caPem = `-----BEGIN CERTIFICATE-----
MIIBeDCCAR2gAwIBAgIBATAKBggqhkjOPQQDAjA5MR4wHAYDVQQDExVPcGVuSGVh
ZGVycyBUZXN0IFJvb3QxFzAVBgNVBAoTDm9wZW5oZWFkZXJzLmlvMB4XDTI2MDEw
MTAwMDAwMFoXDTM2MDEwMTAwMDAwMFowOTEeMBwGA1UEAxMVT3BlbkhlYWRlcnMg
VGVzdCBSb290MRcwFQYDVQQKEw5vcGVuaGVhZGVycy5pbzBZMBMGByqGSM49AgEG
CCqGSM49AwEHA0IABObZxdfBYTwTirPRwk/4JoUMpSw8lz8eu12yemOtLC0jtuI9
vnEJE7exe08TehZY3PhHJE/NtuMbJE6lk+i5LY6jFjAUMBIGA1UdEwEB/wQIMAYB
Af8CAQAwCgYIKoZIzj0EAwIDSQAwRgIhALw6OnrxEcyEC/Fq3CEgBLXzAoP3UFAe
JUa3RZhmKYPLAiEA+tHsiu/3GrcHhMy0znd6vL/Apd1AGqzIpWbMtZi77+Q=
-----END CERTIFICATE-----`;

const leafPem = `-----BEGIN CERTIFICATE-----
MIIBVjCB/qADAgECAgECMAoGCCqGSM49BAMCMDkxHjAcBgNVBAMTFU9wZW5IZWFk
ZXJzIFRlc3QgUm9vdDEXMBUGA1UEChMOb3BlbmhlYWRlcnMuaW8wHhcNMjYwMTAx
MDAwMDAwWhcNMjcwMTAxMDAwMDAwWjAgMR4wHAYDVQQDExVicm9rZXIub3Blbmhl
YWRlcnMuaW8wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAREf6z5zBe/ncWtQwNj
IirSljPRKfiC+wb4EJCCgddzpAs/NVFS3ny7gaDGRsFQbmW6JoLNthVK66hc3s3+
FLnOoxAwDjAMBgNVHRMBAf8EAjAAMAoGCCqGSM49BAMCA0cAMEQCIENX/9XGL9fQ
nTz0CzuYO/KZGKIXRmCNLgNijTby8/xcAiAhgJ+4aUMDT5LoG25lWzBUii4rzL7Z
NMJ2oOvZWW4xxQ==
-----END CERTIFICATE-----`;

describe('gateTrustedRootPem', () => {
  it('passes a CA root with its summary', async () => {
    const gate = await gateTrustedRootPem(caPem);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.summary.isCa).toBe(true);
    expect(gate.summary.chainLength).toBe(1);
    expect(gate.summary.subject).toContain('CN=OpenHeaders Test Root');
  });

  it('passes a pasted chain as ONE root with the chain length counted', async () => {
    const gate = await gateTrustedRootPem(`${caPem}\n${caPem}`);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.summary.chainLength).toBe(2);
  });

  it('refuses a non-CA leaf with the not-ca reason and the summary that explains it', async () => {
    const gate = await gateTrustedRootPem(leafPem);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe('not-ca');
    if (gate.reason !== 'not-ca') return;
    expect(gate.summary.subject).toBe('CN=broker.openheaders.io');
  });

  it('refuses empty input and malformed PEM with their own reasons', async () => {
    expect(await gateTrustedRootPem('   ')).toEqual({ ok: false, reason: 'empty' });
    const noBlock = await gateTrustedRootPem('hello');
    expect(noBlock.ok).toBe(false);
    if (noBlock.ok) return;
    expect(noBlock.reason).toBe('invalid');
    const garbage = await gateTrustedRootPem('-----BEGIN CERTIFICATE-----\nnot base64 der\n-----END CERTIFICATE-----');
    expect(garbage.ok).toBe(false);
    if (garbage.ok) return;
    expect(garbage.reason).toBe('invalid');
  });
});

describe('projection helpers', () => {
  it('subjectCommonName reads the CN attribute and falls back to the whole name', () => {
    expect(subjectCommonName('CN=OpenHeaders Test Root, O=openheaders.io')).toBe('OpenHeaders Test Root');
    expect(subjectCommonName('O=openheaders.io, CN=Internal CA')).toBe('Internal CA');
    expect(subjectCommonName('O=openheaders.io')).toBe('O=openheaders.io');
  });

  it('formatFingerprint renders colon-separated uppercase pairs', () => {
    expect(formatFingerprint('ab12cd')).toBe('AB:12:CD');
  });

  it('isExpired compares notAfter against now', () => {
    const now = Date.parse('2026-08-27T00:00:00Z');
    expect(isExpired('2026-01-01T00:00:00Z', now)).toBe(true);
    expect(isExpired('2036-01-01T00:00:00Z', now)).toBe(false);
  });
});
