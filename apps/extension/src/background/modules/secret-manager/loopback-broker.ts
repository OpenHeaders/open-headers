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
import { type BackendWireHandle, listConnectedWires } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { wsRequest } from '../../ws-request';

/** Is this wire the desktop app's on this device — by the place rule; any other backend is a server. */
export function isDesktopAppWire(wire: BackendWireHandle): boolean {
  return providingBackendKind('browser', wire.record().url) === 'desktop-app';
}

/** The desktop app's connected wire on this device; null while it is away. */
export function desktopAppBackendId(): string | null {
  return listConnectedWires().find(isDesktopAppWire)?.backendId ?? null;
}

export const DESKTOP_APP_AWAY_DETAIL = 'The desktop app on this computer is not connected.';

type SecretManagerVerb =
  | 'oh.secretManager.list'
  | 'oh.secretManager.probe'
  | 'oh.secretManager.authorize'
  | 'oh.secretManager.resolveBatch';

/** The verbs behind which the manager's own prompt may stand — a
 *  human's approval outlasts any ordinary rider wait; the ceiling is
 *  the vendor's approval window, so a desktop app that never answers
 *  (one too old to own the plane) settles instead of hanging a send. */
const PROMPTING_VERBS: ReadonlySet<SecretManagerVerb> = new Set([
  'oh.secretManager.authorize',
  'oh.secretManager.resolveBatch',
]);
export const PROMPT_CEILING_MS = 600_000;

/**
 * One secret-manager verb toward the desktop app. Null when the
 * desktop app is away — the caller answers its honest typed state; a
 * dead wire rejects on its own.
 */
export async function askDesktopApp<T extends SecretManagerVerb>(
  type: T,
  payload: BridgeRpcRequest<T>,
): Promise<BridgeRpcResponse<T> | null> {
  const backendId = desktopAppBackendId();
  if (backendId === null) return null;
  const options = PROMPTING_VERBS.has(type) ? { backendId, timeoutMs: PROMPT_CEILING_MS } : { backendId };
  return wsRequest<BridgeRpcResponse<T>>({ type, ...payload }, options);
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
