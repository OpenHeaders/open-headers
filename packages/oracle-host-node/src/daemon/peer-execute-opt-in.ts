/**
 * The daemon-side egress opt-in for sends a WS peer asks this host to
 * make — one gate for BOTH request families (the context sends of
 * `peer-requests-rpc.ts` and the delegated sends of
 * `delegated-requests-rpc.ts` / `delegated-sockets-rpc.ts`). Two-tiered
 * by the peer's loopback fact and read fresh from the settings record
 * per frame: same-device browsers ride `backend.allowLocalPeerExecute`
 * (default ON — the user paired this browser to use this app as its
 * engine, so pairing is the consent), other devices ride
 * `backend.allowRemotePeerExecute`, whose DEFAULT is the host's: OFF on
 * the desktop app (egress from a personal machine on another device's
 * behalf is an operator decision, never implied by pairing), ON on a
 * standalone server (it exists to serve its admitted users, and every
 * frame still passes admission and `workspace.write`, audited — the
 * switch is the operator's kill-switch, not consent). The stored record
 * overrides either default; the admin console and `ohd config set`
 * write it through `setRemote`. The refusal is honest (it names the
 * tier), not the admin plane's uniform deny: the channels' existence
 * is public contract.
 */

import { LOCAL_PEER_EXECUTE_DISABLED_MESSAGE, REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { WsPeerRpcContext } from '../host-runtime/ws-server';

export const REMOTE_PEER_EXECUTE_KEY = 'backend.allowRemotePeerExecute';
const LOCAL_PEER_EXECUTE_KEY = 'backend.allowLocalPeerExecute';

export interface PeerExecuteOptInOptions {
  /** The remote tier's value while the record says nothing — the host's posture. */
  remoteDefault: boolean;
}

export interface PeerExecuteState {
  /** The remote tier's effective value — the record's, else the host default. */
  remote: boolean;
}

export interface PeerExecuteOptIn {
  allowed(isLoopback: boolean): Promise<boolean>;
  /** Refuse before any identity resolution — no capability decision is
   *  made, so no audit row (the MCP tier-gate precedent). */
  assert(peer: WsPeerRpcContext): Promise<void>;
  read(): Promise<PeerExecuteState>;
  setRemote(value: boolean): Promise<void>;
}

async function readRecord(): Promise<Record<string, unknown>> {
  return ((await hostStorage.get(OH.settingsUser)) ?? {}) as Record<string, unknown>;
}

export function createPeerExecuteOptIn(options: PeerExecuteOptInOptions): PeerExecuteOptIn {
  const remoteOf = (values: Record<string, unknown>): boolean => {
    const stored = values[REMOTE_PEER_EXECUTE_KEY];
    return typeof stored === 'boolean' ? stored : options.remoteDefault;
  };
  const allowed = async (isLoopback: boolean): Promise<boolean> => {
    const values = await readRecord();
    if (isLoopback) return values[LOCAL_PEER_EXECUTE_KEY] !== false;
    return remoteOf(values);
  };
  return {
    allowed,
    async assert(peer) {
      const loopback = peer.isLoopback === true;
      if (!(await allowed(loopback))) {
        throw new Error(loopback ? LOCAL_PEER_EXECUTE_DISABLED_MESSAGE : REMOTE_PEER_EXECUTE_DISABLED_MESSAGE);
      }
    },
    async read() {
      return { remote: remoteOf(await readRecord()) };
    },
    async setRemote(value) {
      // Read-then-write against the persisted record: the settings
      // slot holds every user setting, and a write must keep the rest.
      const values = await readRecord();
      await hostStorage.set(OH.settingsUser, { ...values, [REMOTE_PEER_EXECUTE_KEY]: value });
    },
  };
}

/** The desktop app's posture — what a plane composed without an
 *  explicit gate (test rigs) reads: remote off until the record says on. */
export function defaultPeerExecuteOptIn(): PeerExecuteOptIn {
  return createPeerExecuteOptIn({ remoteDefault: false });
}
