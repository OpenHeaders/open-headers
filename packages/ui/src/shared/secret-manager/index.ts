/**
 * Secret-manager client — the renderer's seam over the node host's
 * `oh.secretManager.*` routes (the Secret Providers plan): this
 * device's connections as a live hook, add / update / remove, the
 * side-effect-free probe behind every status chip, and the settings
 * list's authorization gesture. The reads and gestures answer on every
 * host: a node host from its own store and providers, a browser host
 * through its service worker, which forwards them to the desktop app
 * on this device over loopback and names the desktop app's absence as
 * `broker: 'unreachable'`. The writes are the desktop's alone.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type {
  SecretAuthorizeResult,
  SecretBrokerEntry,
  SecretBrokerKind,
  SecretProviderProbe,
  SecretResolution,
} from '@openheaders/core/secret-providers';
import type { SecretManagerConnection, SecretManagerConnectionConfig } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import { isNodeRequestRuntime } from '../device-trust';

const NONE: SecretManagerConnection[] = [];

/** The settings key the Vault row's Manage link and the Vault note open. */
export const SECRET_MANAGERS_SETTING_KEY = 'secretManagers.connections';

export interface SecretManagerConnectionsState {
  connections: SecretManagerConnection[];
  ready: boolean;
  /** Who answered: this host, the desktop app over loopback, or nobody while it is away. */
  broker: SecretBrokerKind;
}

export function useSecretManagerConnections(): SecretManagerConnectionsState {
  const [state, setState] = useState<SecretManagerConnectionsState>({
    connections: NONE,
    ready: false,
    broker: isNodeRequestRuntime() ? 'local' : 'unreachable',
  });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const resp = await hostBridge.call('oh.secretManager.list').catch(() => null);
      if (!alive) return;
      setState({
        connections: resp?.connections ?? NONE,
        ready: true,
        broker: resp?.broker ?? (isNodeRequestRuntime() ? 'local' : 'unreachable'),
      });
    };
    void load();
    const unsubscribe = hostBridge.subscribe('secretManagerConnectionsChanged', () => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return state;
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
 * One session's referenced entries resolved through the host's broker
 * — the page realm's resolve seam (a session executes in the workbench
 * page on the browser host, so its secret-manager scope asks the
 * service worker, which asks the desktop app on this device). A
 * provider may prompt. Every entry answers typed by name; a host that
 * cannot answer reads `unavailable` for each.
 */
export async function resolveSecretManagerBatch(
  entries: readonly SecretBrokerEntry[],
): Promise<ReadonlyMap<string, SecretResolution>> {
  const results = new Map<string, SecretResolution>();
  if (entries.length === 0) return results;
  let answer: { results: Record<string, SecretResolution> };
  try {
    answer = await hostBridge.call('oh.secretManager.resolveBatch', { entries: [...entries] });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    for (const entry of entries) results.set(entry.name, { ok: false, reason: 'unavailable', detail });
    return results;
  }
  for (const entry of entries) {
    results.set(
      entry.name,
      answer.results[entry.name] ?? {
        ok: false,
        reason: 'unavailable',
        detail: 'The host did not answer for this entry.',
      },
    );
  }
  return results;
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
