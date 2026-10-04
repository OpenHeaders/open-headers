/**
 * Main-process half of the `oh.backendIdentity.accept` channel: the
 * accept re-dials the record's wire, and the desktop's client plane —
 * the wires it dials — lives in this process, not the renderer. The
 * dispatcher only relays to the shared client-plane accept.
 */

import {
  type AcceptBackendIdentityChangeResult,
  acceptBackendIdentityChange,
} from '@openheaders/oracle/sync/client/backend-identity-accept';

export interface BackendIdentityRpcOptions {
  /** Test seam; defaults to the shared client-plane accept. */
  readonly accept?: (backendId: string) => Promise<AcceptBackendIdentityChangeResult>;
}

export interface BackendIdentityRpc {
  /** Answers `oh.backendIdentity.accept`; undefined for any other type (the probe plane's idiom). */
  dispatch(type: unknown, message: Record<string, unknown>): Promise<unknown> | undefined;
}

export function createBackendIdentityRpc(options: BackendIdentityRpcOptions = {}): BackendIdentityRpc {
  const accept = options.accept ?? acceptBackendIdentityChange;
  return {
    dispatch(type, message) {
      if (type !== 'oh.backendIdentity.accept') return undefined;
      const backendId = typeof message.backendId === 'string' ? message.backendId : '';
      return accept(backendId);
    },
  };
}
