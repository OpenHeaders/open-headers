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
import type { SecretManagerConnection, SecretManagerConnectionConfig, Vault } from '@openheaders/core/types';
import { EMPTY_SECRET_MANAGER_FAILURES, type SecretManagerFailures } from '@openheaders/core/variables';
import { useEffect, useMemo, useState } from 'react';
import { isNodeRequestRuntime } from '../device-trust';
import { useEnvVarVault } from '../hooks/readers/useEnvVarVault';

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
    const unsubscribeChanged = hostBridge.subscribe('secretManagerConnectionsChanged', () => void load());
    // The desktop app's wire opening or closing under a browser host
    // changes who answers — re-list, so a page open across the change
    // reads the connections (or their absence) without a reload.
    const unsubscribeBroker = hostBridge.subscribe('secretManagerBrokerChanged', () => void load());
    return () => {
      alive = false;
      unsubscribeChanged();
      unsubscribeBroker();
    };
  }, []);
  return state;
}

/**
 * The failures a renderer's resolver should name for the vault's
 * secret-manager rows, read off their connections' probes: an entry
 * whose connection cannot answer on this device — the desktop app
 * away under a browser host, the manager absent, no credentials, no
 * connection picked — reads its typed reason instead of deferring.
 * A declined or locked manager is NOT a failure here: a send is the
 * attempt, and it prompts again, so the row keeps deferring and the
 * Send stays enabled. A probe still in flight names nothing yet.
 */
export function secretManagerFailuresFromProbes(
  vault: Vault,
  probes: ReadonlyMap<string, SecretProviderProbe>,
): SecretManagerFailures {
  const failures = new Map<string, SecretManagerFailures extends ReadonlyMap<string, infer R> ? R : never>();
  for (const secret of vault.secrets) {
    if (secret.kind !== 'secret-manager') continue;
    const connectionId = secret.locator.connectionId.trim();
    if (connectionId === '') {
      failures.set(secret.name, 'unavailable');
      continue;
    }
    const probe = probes.get(connectionId);
    if (probe === undefined || probe.available) continue;
    if (probe.reason === 'broker-unreachable') failures.set(secret.name, 'broker-unreachable');
    else if (probe.reason !== 'denied' && probe.reason !== 'locked') failures.set(secret.name, 'unavailable');
  }
  return failures.size === 0 ? EMPTY_SECRET_MANAGER_FAILURES : failures;
}

/**
 * The vault's secret-manager rows' standing as a hook — each distinct
 * connection probed once (never prompts), re-probed when the
 * connections or the broker change, folded into the failures a
 * renderer resolver installs beside an empty registry.
 */
export function useSecretManagerStanding(): SecretManagerFailures {
  const { vault } = useEnvVarVault();
  const connectionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const secret of vault.secrets) {
      if (secret.kind !== 'secret-manager') continue;
      const id = secret.locator.connectionId.trim();
      if (id !== '') ids.add(id);
    }
    return [...ids].sort();
  }, [vault]);
  const [probes, setProbes] = useState<ReadonlyMap<string, SecretProviderProbe>>(new Map());
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (connectionIds.length === 0) {
        if (alive) setProbes(new Map());
        return;
      }
      const entries = await Promise.all(
        connectionIds.map(async (id) => [id, await probeSecretManagerConnection(id)] as const),
      );
      if (alive) setProbes(new Map(entries));
    };
    void load();
    // A connection edited, or the desktop app's wire opening or closing
    // under a browser host — the standing may have changed; ask again.
    const unsubscribeChanged = hostBridge.subscribe('secretManagerConnectionsChanged', () => void load());
    const unsubscribeBroker = hostBridge.subscribe('secretManagerBrokerChanged', () => void load());
    return () => {
      alive = false;
      unsubscribeChanged();
      unsubscribeBroker();
    };
  }, [connectionIds]);
  return useMemo(() => secretManagerFailuresFromProbes(vault, probes), [vault, probes]);
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
