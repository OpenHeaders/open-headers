/**
 * Secret-manager client — the renderer's seam over the node host's
 * `oh.secretManager.*` routes (the Secret Providers plan): this
 * device's connections as a live hook, add / update / remove, the
 * side-effect-free probe behind every status chip, and the settings
 * list's authorization gesture. Every call is gated on the request
 * runtime — a browser host holds no provider, so the hook reads empty
 * there and the writes never fire (the extension reaches the desktop
 * app's connections over loopback in a later slice).
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { SecretAuthorizeResult, SecretProviderProbe } from '@openheaders/core/secret-providers';
import type { SecretManagerConnection, SecretManagerConnectionConfig } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { isNodeRequestRuntime } from '../device-trust';

const NONE: SecretManagerConnection[] = [];

/** The settings key the Vault row's Manage link and the Vault note open. */
export const SECRET_MANAGERS_SETTING_KEY = 'secretManagers.connections';

export function useSecretManagerConnections(): { connections: SecretManagerConnection[]; ready: boolean } {
  const [connections, setConnections] = useState<SecretManagerConnection[]>(NONE);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isNodeRequestRuntime()) {
      setConnections(NONE);
      setReady(true);
      return;
    }
    let alive = true;
    const load = async () => {
      const resp = await hostBridge.call('oh.secretManager.list').catch(() => null);
      if (!alive) return;
      setConnections(resp?.connections ?? NONE);
      setReady(true);
    };
    void load();
    const unsubscribe = hostBridge.subscribe('secretManagerConnectionsChanged', () => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return { connections, ready };
}

export type SecretManagerWriteResult = { ok: true; connection: SecretManagerConnection } | { ok: false; error: string };

export async function addSecretManagerConnection(input: {
  label: string;
  config: SecretManagerConnectionConfig;
}): Promise<SecretManagerWriteResult> {
  return hostBridge.call('oh.secretManager.add', input).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
}

export async function updateSecretManagerConnection(input: {
  uid: string;
  label: string;
  config: SecretManagerConnectionConfig;
}): Promise<SecretManagerWriteResult> {
  return hostBridge.call('oh.secretManager.update', input).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
}

export async function removeSecretManagerConnection(uid: string): Promise<{ ok: boolean; error?: string }> {
  return hostBridge.call('oh.secretManager.remove', { uid }).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
}

/** The connection's standing — never prompts. An unreachable host reads `unreachable`. */
export async function probeSecretManagerConnection(uid: string): Promise<SecretProviderProbe> {
  return hostBridge.call('oh.secretManager.probe', { uid }).catch((err: unknown) => ({
    available: false as const,
    reason: 'unreachable' as const,
    detail: err instanceof Error ? err.message : String(err),
  }));
}

/** The connection's interactive authorization — the one call that may prompt. */
export async function authorizeSecretManagerConnection(uid: string): Promise<SecretAuthorizeResult> {
  return hostBridge.call('oh.secretManager.authorize', { uid }).catch((err: unknown) => ({
    ok: false as const,
    detail: err instanceof Error ? err.message : String(err),
  }));
}

/**
 * A connection's probe as a hook — `null` while in flight, probed once
 * per mount (a surface that must re-probe remounts the reader, the
 * settings list's post-Test key bump).
 */
export function useSecretManagerProbe(uid: string | null): SecretProviderProbe | null {
  const [probe, setProbe] = useState<SecretProviderProbe | null>(null);
  useEffect(() => {
    if (uid === null || uid === '') {
      setProbe(null);
      return;
    }
    if (!isNodeRequestRuntime()) {
      setProbe({ available: false, reason: 'not-installed' });
      return;
    }
    let alive = true;
    setProbe(null);
    void probeSecretManagerConnection(uid).then((result) => {
      if (alive) setProbe(result);
    });
    return () => {
      alive = false;
    };
  }, [uid]);
  return probe;
}
