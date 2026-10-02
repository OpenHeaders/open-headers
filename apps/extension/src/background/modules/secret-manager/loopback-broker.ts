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
 *
 * The desktop app is "there" once its wire's HELLO is accepted, not
 * when the socket opens: the server closes a socket that speaks before
 * HELLO (seen live — the compile's re-ask on the raw open was closed
 * every six seconds for `pre-handshake message`), so every verb here
 * rides a READY wire, and the readiness watch is what the compile's
 * strip / re-ask and the pages' refetch key on.
 */

import { getBackend, getBackends } from '@openheaders/core/backends';
import type { BridgeRpcRequest, BridgeRpcResponse } from '@openheaders/core/bridge';
import { providingBackendKind } from '@openheaders/core/identity';
import type { SecretBrokerEntry, SecretManagerBroker, SecretResolution } from '@openheaders/core/secret-providers';
import { setSecretManagerBroker } from '@openheaders/oracle/live/request-exec/secret-manager-broker';
import { type BackendWireHandle, listConnectedWires } from '@openheaders/oracle/sync/client/backend-connection-manager';
import type { SyncWiring } from '@openheaders/oracle/sync/client/backend-sync-plane';
import type { SyncHandshakeHandles } from '@openheaders/oracle/sync/client/backend-wire-handshake';
import type { InitiatorState } from '@openheaders/oracle/sync/client/sync-handshake-initiator';
import { wsRequest } from '../../ws-request';

/** Is this wire the desktop app's on this device — by the place rule; any other backend is a server. */
export function isDesktopAppWire(wire: BackendWireHandle): boolean {
  return providingBackendKind('browser', wire.record().url) === 'desktop-app';
}

/** The same rule off a backend id — for the handshake events, which carry no wire. */
export function isDesktopAppBackend(backendId: string): boolean {
  const record = getBackend(backendId);
  return record !== null && providingBackendKind('browser', record.url) === 'desktop-app';
}

// ── Readiness: the desktop wire past HELLO ─────────────────────────

const readyDesktopWires = new Set<string>();
const readySubscribers = new Set<(ready: boolean) => void>();

/** HELLO accepted on the current socket — the composed states past WELCOME. */
function entersReady(state: InitiatorState): boolean {
  return state === 'welcomed' || state === 'catching-up' || state === 'synced';
}

/** The socket is gone or the peer refused — `failed` / `timed-out`
 *  after WELCOME are catch-up outcomes on a wire the peer still answers. */
function leavesReady(state: InitiatorState): boolean {
  return state === 'idle' || state === 'hello-sent' || state === 'rejected' || state === 'aborted';
}

function setReady(backendId: string, ready: boolean): void {
  if (readyDesktopWires.has(backendId) === ready) return;
  if (ready) readyDesktopWires.add(backendId);
  else readyDesktopWires.delete(backendId);
  for (const cb of [...readySubscribers]) cb(ready);
}

/**
 * Fires with `true` when the desktop app's wire completes its HELLO and
 * with `false` when that wire closes or the peer refuses it; a server's
 * wire never fires. The compile's re-ask / strip and the pages' broker
 * broadcast ride this, never the raw socket open.
 */
export function subscribeDesktopWireReady(cb: (ready: boolean) => void): () => void {
  readySubscribers.add(cb);
  return () => readySubscribers.delete(cb);
}

/**
 * Boot-time: watch every desktop wire's handshake through the sync
 * wiring (one initiator per backend wire) and keep the ready set. The
 * wires the registry created BEFORE this installed (the boot order —
 * the sync plane and the backend records come first) are seeded from
 * their initiator's current state; later wires arrive through the
 * lifecycle.
 */
export function installDesktopWireWatch(
  syncWiring: Pick<SyncWiring, 'subscribeHandshakeLifecycle' | 'get'>,
): () => void {
  const unsubscribers = new Map<string, () => void>();
  const apply = (backendId: string, state: InitiatorState): void => {
    if (entersReady(state)) setReady(backendId, true);
    else if (leavesReady(state)) setReady(backendId, false);
  };
  const watch = (backendId: string, handles: SyncHandshakeHandles): void => {
    if (!isDesktopAppBackend(backendId)) return;
    unsubscribers.get(backendId)?.();
    unsubscribers.set(
      backendId,
      handles.initiator.subscribe((state) => apply(backendId, state)),
    );
    apply(backendId, handles.initiator.state());
  };
  for (const record of getBackends()) {
    const handles = syncWiring.get(record.id);
    if (handles) watch(record.id, handles);
  }
  const unsubscribeLifecycle = syncWiring.subscribeHandshakeLifecycle((event) => {
    if (event.kind === 'created') {
      watch(event.backendId, event.handles);
      return;
    }
    unsubscribers.get(event.backendId)?.();
    unsubscribers.delete(event.backendId);
    setReady(event.backendId, false);
  });
  return () => {
    unsubscribeLifecycle();
    for (const unsubscribe of unsubscribers.values()) unsubscribe();
    unsubscribers.clear();
  };
}

/** Test seam — forget every ready wire. */
export function __resetDesktopWireReadinessForTests(): void {
  readyDesktopWires.clear();
  readySubscribers.clear();
}

/** The desktop app's READY wire on this device (connected and past HELLO); null while it is away. */
export function desktopAppBackendId(): string | null {
  return (
    listConnectedWires().find((wire) => isDesktopAppWire(wire) && readyDesktopWires.has(wire.backendId))?.backendId ??
    null
  );
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
