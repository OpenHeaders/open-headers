/**
 * Boot seed for the device's system-trust-store opt-in (the Trusted
 * Roots plan, S9) — the headless daemon's config surface (`daemon.json`
 * / `OH_DAEMON_USE_SYSTEM_CA` / `--use-system-ca`) writes the
 * host-local `OH.deviceTrust` posture before the spine loads it, the
 * way the egress config seeds the system-proxy slot. Pins already on
 * the record survive; a malformed record reads as empty rather than
 * failing the boot.
 */

import { DeviceTrustSchema, parseEntity } from '@openheaders/core/schemas';
import { OH } from '@openheaders/core/storage';
import { EMPTY_DEVICE_TRUST } from '@openheaders/core/types';
import type { NodeSystemProxyStore } from './system-proxy-install';

export interface SeedDeviceTrustPostureOptions {
  hostStorage: NodeSystemProxyStore;
  useSystemCa: boolean;
}

export async function seedDeviceTrustPosture(options: SeedDeviceTrustPostureOptions): Promise<void> {
  const stored = await options.hostStorage.get(OH.deviceTrust);
  const current = (stored === undefined ? undefined : parseEntity(DeviceTrustSchema, stored)) ?? EMPTY_DEVICE_TRUST;
  if (current.useSystemCa === options.useSystemCa) return;
  await options.hostStorage.set(OH.deviceTrust, { ...current, useSystemCa: options.useSystemCa });
}
