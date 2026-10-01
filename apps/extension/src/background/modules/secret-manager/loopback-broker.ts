/**
 * The browser's secret-manager broker — the Secret Providers plan's P2:
 * this worker holds no provider, so a send's referenced entries resolve
 * by asking the desktop app on THIS device over loopback (the one
 * loopback-only peer plane the desktop app answers; any other backend
 * is a server and never asked — a secret value never leaves the
 * device for resolution). The provider's own prompt appears on this
 * machine; every failure comes back typed, by name, and the values
 * live in this worker's memory for the one send (L1).
 *
 * With the desktop app away every entry reads `broker-unreachable` —
 * the honest state the gate names before anything leaves.
 */

import type { BridgeRpcRequest, BridgeRpcResponse } from '@openheaders/core/bridge';
import { providingBackendKind } from '@openheaders/core/identity';
import type { SecretBrokerEntry, SecretManagerBroker, SecretResolution } from '@openheaders/core/secret-providers';
import { setSecretManagerBroker } from '@openheaders/oracle/live/request-exec/secret-manager-broker';
import { listConnectedWires } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { wsRequest } from '../../ws-request';

/** The desktop app's connected wire on this device, by the place rule; null while it is away. */
export function desktopAppBackendId(): string | null {
  const wire = listConnectedWires().find((w) => providingBackendKind('browser', w.record().url) === 'desktop-app');
  return wire?.backendId ?? null;
}

export const DESKTOP_APP_AWAY_DETAIL = 'The desktop app on this computer is not connected.';

type SecretManagerVerb =
  | 'oh.secretManager.list'
  | 'oh.secretManager.probe'
  | 'oh.secretManager.authorize'
  | 'oh.secretManager.resolveBatch';

/**
 * One secret-manager verb toward the desktop app. A prompt can stand
 * for minutes, so the request rides deadline-free like a delegated
 * send; a dead wire rejects on its own. Null when the desktop app is
 * away — the caller answers its honest typed state.
 */
export async function askDesktopApp<T extends SecretManagerVerb>(
  type: T,
  payload: BridgeRpcRequest<T>,
): Promise<BridgeRpcResponse<T> | null> {
  const backendId = desktopAppBackendId();
  if (backendId === null) return null;
  return wsRequest<BridgeRpcResponse<T>>({ type, ...payload }, { backendId, timeoutMs: 0 });
}

function away(entries: readonly SecretBrokerEntry[]): Map<string, SecretResolution> {
  return new Map(
    entries.map((entry) => [entry.name, { ok: false, reason: 'broker-unreachable', detail: DESKTOP_APP_AWAY_DETAIL }]),
  );
}

export function createLoopbackSecretManagerBroker(): SecretManagerBroker {
  return {
    async resolveBatch(entries) {
      if (entries.length === 0) return new Map();
      let answer: BridgeRpcResponse<'oh.secretManager.resolveBatch'> | null;
      try {
        answer = await askDesktopApp('oh.secretManager.resolveBatch', { entries: [...entries] });
      } catch (err) {
        // The wire fell while the desktop app was asked — the same honest state.
        const detail = err instanceof Error ? err.message : String(err);
        return new Map(entries.map((entry) => [entry.name, { ok: false, reason: 'broker-unreachable', detail }]));
      }
      if (answer === null) return away(entries);
      const results = new Map<string, SecretResolution>();
      for (const entry of entries) {
        const result = answer.results[entry.name];
        results.set(
          entry.name,
          result ?? { ok: false, reason: 'unavailable', detail: 'The desktop app did not answer for this entry.' },
        );
      }
      return results;
    },
  };
}

/** Boot-time: every per-send registry build on this worker resolves through the desktop app. */
export function installLoopbackSecretManagerBroker(): void {
  setSecretManagerBroker(createLoopbackSecretManagerBroker());
}
