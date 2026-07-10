/**
 * Admin-visibility probe — asks the daemon whether the calling subject
 * may administer it (`oh.daemon.admin.status`). Drives WHETHER admin
 * affordances render; it never authorizes anything — the server gates
 * every admin call per frame regardless of what this hook reads.
 *
 * Resolution by host: the desktop renderer reaches its own spine over
 * IPC (the operator — always admin); the web tab forwards the probe up
 * the wire and reads its peer's `daemon.admin` resolution; hosts with
 * no daemon surface (extension) reject the channel and read `false`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useEffect, useState } from 'react';

export type DaemonAdminStatus = 'unknown' | 'admin' | 'denied';

export function useDaemonAdminStatus(): DaemonAdminStatus {
  const [status, setStatus] = useState<DaemonAdminStatus>('unknown');

  useEffect(() => {
    let cancelled = false;
    void hostBridge
      .call('oh.daemon.admin.status')
      .then((resp) => {
        if (!cancelled) setStatus(resp.admin ? 'admin' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setStatus('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
