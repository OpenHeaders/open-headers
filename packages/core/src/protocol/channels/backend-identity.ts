/**
 * Backend identity bridge RPC — the person accepting that a different
 * host now answers at a connection record's address (one record, one
 * Org). The host's long-lived process answers it, because the accept
 * re-dials the record's wire: the extension's service worker and the
 * desktop's MAIN process, where the client plane runs.
 */

export interface BackendIdentityRpc {
  /** Forget the record's previous identity and re-dial it so the new Org joins; `reconnected` is false when the record has no live wire. */
  'oh.backendIdentity.accept': { req: { backendId: string }; res: { reconnected: boolean } };
}
