/**
 * Device-trust client — the renderer's seam over the node host's
 * `oh.deviceTrust.*` routes (the Trusted Roots plan, device scope):
 * the pinned list as a live hook, pin / unpin, and the presented-chain
 * probe behind the response surface's trust gesture. Every call is
 * gated on the request runtime — a browser host cannot apply trust
 * material, so the hook reads empty and the writes never fire there.
 */

import { hostBridge, type PresentedCertificateWire, type SystemTrustWire } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import type { DeviceTrustedCertificate } from '@openheaders/core/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const NONE: DeviceTrustedCertificate[] = [];
/** A browser host: the runtime cannot read the OS store, so the switch has nothing to flip. */
const NO_SYSTEM_TRUST: SystemTrustWire = { supported: false, enabled: false, count: 0 };

/** Whether the request runtime on this host can apply trust material. */
export function isNodeRequestRuntime(): boolean {
  return getCapability('requestRuntime')?.() === 'node';
}

export function useDeviceTrust(): {
  certificates: DeviceTrustedCertificate[];
  systemTrust: SystemTrustWire;
  ready: boolean;
} {
  const [certificates, setCertificates] = useState<DeviceTrustedCertificate[]>(NONE);
  const [systemTrust, setSystemTrust] = useState<SystemTrustWire>(NO_SYSTEM_TRUST);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isNodeRequestRuntime()) {
      setCertificates(NONE);
      setReady(true);
      return;
    }
    let alive = true;
    const load = async () => {
      const resp = await hostBridge.call('oh.deviceTrust.list').catch(() => null);
      if (!alive) return;
      setCertificates(resp?.certificates ?? NONE);
      setSystemTrust(resp?.systemTrust ?? NO_SYSTEM_TRUST);
      setReady(true);
    };
    void load();
    const unsubscribe = hostBridge.subscribe('deviceTrustChanged', () => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return { certificates, systemTrust, ready };
}

export async function setSystemTrustEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const resp = await hostBridge.call('oh.deviceTrust.setSystemTrust', { enabled }).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  return resp;
}

export type DeviceTrustAddResult = { ok: true; certificate: DeviceTrustedCertificate } | { ok: false; error: string };

export async function addDeviceTrustedCertificate(input: {
  certPem: string;
  name: string;
  origin?: string;
}): Promise<DeviceTrustAddResult> {
  const resp = await hostBridge.call('oh.deviceTrust.add', input).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  return resp;
}

export async function removeDeviceTrustedCertificate(uid: string): Promise<{ ok: boolean; error?: string }> {
  const resp = await hostBridge.call('oh.deviceTrust.remove', { uid }).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  return resp;
}

export type ProbeResult = { ok: true; chain: PresentedCertificateWire[] } | { ok: false; error: string };

export async function probeServerCertificate(target: {
  host: string;
  port: number;
  servername?: string;
}): Promise<ProbeResult> {
  return hostBridge.call('oh.deviceTrust.probe', target).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
}

/** The pin a trust gesture takes from a presented chain: the LAST
 *  link, and only when it is self-signed — the runtime's trust store
 *  needs an anchor that closes the chain (a CA-issued leaf whose root
 *  the server never presents cannot be pinned; the root itself must be
 *  added). */
export function pinnableAnchorOf(chain: readonly PresentedCertificateWire[]): PresentedCertificateWire | null {
  const last = chain[chain.length - 1];
  return last?.selfSigned ? last : null;
}

export function useProbeServerCertificate(target: { host: string; port: number; servername?: string } | null): {
  state: 'idle' | 'probing' | 'settled';
  result: ProbeResult | null;
  retry: () => void;
} {
  const [state, setState] = useState<'idle' | 'probing' | 'settled'>('idle');
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Retry bumps the attempt; the newest one owns the result (an older
  // probe settling late is dropped, like an unmounted one).
  const latestAttempt = useRef(attempt);
  latestAttempt.current = attempt;
  // The endpoint's parts are the effect's identity — a fresh target
  // object naming the same endpoint must not re-probe.
  const host = target?.host;
  const port = target?.port;
  const servername = target?.servername;
  useEffect(() => {
    if (host === undefined || port === undefined) {
      setState('idle');
      setResult(null);
      return;
    }
    const serial = attempt;
    let alive = true;
    setState('probing');
    setResult(null);
    void probeServerCertificate({ host, port, ...(servername !== undefined ? { servername } : {}) }).then((probed) => {
      if (!alive || latestAttempt.current !== serial) return;
      setResult(probed);
      setState('settled');
    });
    return () => {
      alive = false;
    };
  }, [host, port, servername, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, result, retry };
}
