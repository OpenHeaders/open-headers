/**
 * Secret-manager references — the workspace layer over the connections
 * client: the vault's secret-manager rows read against the connections
 * they name. The standing fold a renderer resolver installs (each row's
 * connection probed once, never prompting) and the count of rows a
 * draft's templates reference (the transit sentence's pre-send read).
 * This layer reads the environment context through the vault reader;
 * the connections client beneath it never does, so the settings
 * schema's row imports that client without the workspace graph.
 */

import { hostBridge } from '@openheaders/core/bridge';
import type { SecretProviderProbe } from '@openheaders/core/secret-providers';
import type { Vault } from '@openheaders/core/types';
import {
  collectSentTemplateStrings,
  EMPTY_SECRET_MANAGER_FAILURES,
  type SecretManagerFailures,
  secretManagerNamesOf,
  secretManagerReferences,
} from '@openheaders/core/variables';
import { useEffect, useMemo, useState } from 'react';
import { useEnvVarVault } from '../hooks/readers/useEnvVarVault';
import { probeSecretManagerConnection } from '../secret-manager';

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

/**
 * How many of the vault's secret-manager rows a draft's templates
 * reference — the count the transit sentence states for a send an
 * off-device place fills in. Read off the draft the send would fill
 * (a row switched off is not counted), distinct by row, before the
 * send: a pre-send read, never the executor's stamp.
 */
export function useSecretManagerReferenceCount(draft: unknown): number {
  const { vault } = useEnvVarVault();
  return useMemo(
    () => secretManagerReferences(collectSentTemplateStrings(draft), secretManagerNamesOf(vault)).size,
    [draft, vault],
  );
}
