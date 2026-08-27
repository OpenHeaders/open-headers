/**
 * Device-trust bridge routes — the node host's answers for
 * `oh.deviceTrust.*` (the Trusted Roots plan, device scope): the
 * pinned list with the system-store posture, pin / unpin, the
 * system-store switch, and the presented-chain probe behind the
 * response surface's trust-on-failure gesture.
 *
 * Mutations go through the oracle store (persist-first, then the
 * in-memory snapshot the executors read) and fan the change out as
 * `deviceTrustChanged` so every surface refetches. A pin is validated
 * as a parseable certificate before it lands — garbage never reaches
 * the `ca` option.
 */

import type { BridgeRpcResponse, SystemTrustWire } from '@openheaders/core/bridge';
import { hostBridge } from '@openheaders/core/bridge';
import { summarizeCertificatePem } from '@openheaders/core/utils';
import {
  addDeviceTrustedCertificate,
  isSystemTrustEnabled,
  listDeviceTrustedCertificates,
  removeDeviceTrustedCertificate,
  setSystemTrustEnabled,
} from '@openheaders/oracle/entity/device-trust-store';
import { probeServerCertificate } from '../live/probe-server-certificate';
import { getSystemCaCertificates, isSystemTrustSupported, refreshSystemCaCertificates } from '../live/system-trust';

const DEVICE_TRUST_TYPES = new Set([
  'oh.deviceTrust.list',
  'oh.deviceTrust.add',
  'oh.deviceTrust.remove',
  'oh.deviceTrust.probe',
  'oh.deviceTrust.setSystemTrust',
]);

export type DeviceTrustRpcType =
  | 'oh.deviceTrust.list'
  | 'oh.deviceTrust.add'
  | 'oh.deviceTrust.remove'
  | 'oh.deviceTrust.probe'
  | 'oh.deviceTrust.setSystemTrust';

export function isDeviceTrustRpc(type: unknown): type is DeviceTrustRpcType {
  return typeof type === 'string' && DEVICE_TRUST_TYPES.has(type);
}

/** The system store as the runtime sees it now — the count is read only when the device opted in. */
function systemTrustWire(): SystemTrustWire {
  const enabled = isSystemTrustEnabled();
  return {
    supported: isSystemTrustSupported(),
    enabled,
    count: enabled ? getSystemCaCertificates().length : 0,
  };
}

function broadcastChanged(): void {
  hostBridge.broadcast('deviceTrustChanged', { count: listDeviceTrustedCertificates().length });
}

export async function handleDeviceTrustList(): Promise<BridgeRpcResponse<'oh.deviceTrust.list'>> {
  return { certificates: listDeviceTrustedCertificates(), systemTrust: systemTrustWire() };
}

export async function handleDeviceTrustSetSystemTrust(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.deviceTrust.setSystemTrust'>> {
  const enabled = message.enabled === true;
  if (enabled && !isSystemTrustSupported()) {
    return { ok: false, error: 'This runtime cannot read the system trust store (Node 22.15 or later is required).' };
  }
  // Opting in re-reads the store so a root installed since boot counts.
  if (enabled) refreshSystemCaCertificates();
  await setSystemTrustEnabled(enabled);
  broadcastChanged();
  return { ok: true, systemTrust: systemTrustWire() };
}

export async function handleDeviceTrustAdd(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.deviceTrust.add'>> {
  const certPem = typeof message.certPem === 'string' ? message.certPem : '';
  const name = typeof message.name === 'string' ? message.name : '';
  const origin = typeof message.origin === 'string' ? message.origin : undefined;
  let subject: string;
  try {
    subject = (await summarizeCertificatePem(certPem)).subject;
  } catch (err) {
    return { ok: false, error: `Not a certificate: ${err instanceof Error ? err.message : String(err)}` };
  }
  const result = await addDeviceTrustedCertificate({ certPem, name: name || subject, ...(origin ? { origin } : {}) });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'duplicate' ? 'This certificate is already trusted on this device.' : 'Not a certificate.',
    };
  }
  broadcastChanged();
  return { ok: true, certificate: result.certificate };
}

export async function handleDeviceTrustRemove(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.deviceTrust.remove'>> {
  const uid = typeof message.uid === 'string' ? message.uid : '';
  const removed = await removeDeviceTrustedCertificate(uid);
  if (!removed) return { ok: false, error: 'No such certificate on this device.' };
  broadcastChanged();
  return { ok: true };
}

export async function handleDeviceTrustProbe(
  message: Record<string, unknown>,
): Promise<BridgeRpcResponse<'oh.deviceTrust.probe'>> {
  const host = typeof message.host === 'string' ? message.host.trim() : '';
  const port = typeof message.port === 'number' && Number.isInteger(message.port) ? message.port : NaN;
  const servername = typeof message.servername === 'string' ? message.servername : undefined;
  if (host === '' || !(port > 0 && port < 65_536)) return { ok: false, error: 'A host and a port are required.' };
  try {
    const chain = await probeServerCertificate({ host, port, ...(servername !== undefined ? { servername } : {}) });
    return { ok: true, chain };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Route one bridge message; `undefined` when the type is not ours. */
export async function handleDeviceTrustRpc(type: string, message: Record<string, unknown>): Promise<unknown> {
  switch (type) {
    case 'oh.deviceTrust.list':
      return handleDeviceTrustList();
    case 'oh.deviceTrust.add':
      return handleDeviceTrustAdd(message);
    case 'oh.deviceTrust.remove':
      return handleDeviceTrustRemove(message);
    case 'oh.deviceTrust.probe':
      return handleDeviceTrustProbe(message);
    case 'oh.deviceTrust.setSystemTrust':
      return handleDeviceTrustSetSystemTrust(message);
    default:
      return undefined;
  }
}
