/**
 * Device-trust store — the certificates THIS machine pins beside the
 * workspace trust list (the Trusted Roots plan, device scope).
 *
 * Host posture, never workspace data: persisted under the host-local
 * `OH.deviceTrust` key (the system-proxy posture — never synced, never
 * exported), held in one in-memory snapshot after `loadDeviceTrust()`
 * so the executors' synchronous read seam (`getDeviceTrustPems`) costs
 * nothing per dial. Mutations persist first, then swap the snapshot;
 * the host's RPC layer owns the change broadcast — this module knows
 * no bridge.
 */

import { DeviceTrustSchema } from '@openheaders/core/schemas';
import { type DeviceTrust, type DeviceTrustedCertificate, EMPTY_DEVICE_TRUST } from '@openheaders/core/types';
import { generateUid, splitPemChain } from '@openheaders/core/utils';
import { hostStorage, OH } from '@openheaders/oracle/storage';
import * as v from 'valibot';

let snapshot: DeviceTrust = EMPTY_DEVICE_TRUST;
let loaded = false;

/** Seed the in-memory snapshot from host storage — once, at host boot. */
export async function loadDeviceTrust(): Promise<void> {
  const persisted = await hostStorage.get(OH.deviceTrust);
  const parsed = persisted === undefined ? undefined : v.safeParse(DeviceTrustSchema, persisted);
  snapshot = parsed?.success ? parsed.output : EMPTY_DEVICE_TRUST;
  loaded = true;
}

export function isDeviceTrustLoaded(): boolean {
  return loaded;
}

export function listDeviceTrustedCertificates(): DeviceTrustedCertificate[] {
  return snapshot.certificates;
}

/** PEM strings of every pinned certificate — the shape the transports take. */
export function getDeviceTrustPems(): string[] {
  return snapshot.certificates.map((certificate) => certificate.certPem);
}

export interface AddDeviceTrustInput {
  certPem: string;
  name: string;
  origin?: string;
}

export type AddDeviceTrustResult =
  | { ok: true; certificate: DeviceTrustedCertificate }
  | { ok: false; error: 'no-certificate' | 'duplicate' };

/**
 * Pin one certificate (or chain, one row). Refuses material without a
 * PEM certificate block and a PEM already pinned byte-for-byte; a
 * self-signed leaf is welcome — pinning the exact certificate is the
 * device scope's point.
 */
export async function addDeviceTrustedCertificate(input: AddDeviceTrustInput): Promise<AddDeviceTrustResult> {
  const certPem = input.certPem.trim();
  if (splitPemChain(certPem).length === 0) return { ok: false, error: 'no-certificate' };
  if (snapshot.certificates.some((certificate) => certificate.certPem.trim() === certPem)) {
    return { ok: false, error: 'duplicate' };
  }
  const certificate: DeviceTrustedCertificate = {
    uid: generateUid(),
    name: input.name.trim() || certPem.slice(0, 24),
    certPem,
    addedAt: new Date().toISOString(),
    ...(input.origin !== undefined ? { origin: input.origin } : {}),
  };
  await commit({ certificates: [...snapshot.certificates, certificate] });
  return { ok: true, certificate };
}

export async function removeDeviceTrustedCertificate(uid: string): Promise<boolean> {
  const next = snapshot.certificates.filter((certificate) => certificate.uid !== uid);
  if (next.length === snapshot.certificates.length) return false;
  await commit({ certificates: next });
  return true;
}

async function commit(next: DeviceTrust): Promise<void> {
  await hostStorage.set(OH.deviceTrust, next);
  snapshot = next;
}

export function __resetDeviceTrustForTests(): void {
  snapshot = EMPTY_DEVICE_TRUST;
  loaded = false;
}
