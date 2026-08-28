/**
 * One seam for the connection-registry writes on the Back-end pane, so
 * a refused write is visible instead of silent.
 *
 * `OH.backends` is a SENSITIVE slot: it holds paired tokens, so a host
 * that has no at-rest cipher refuses to persist it rather than writing
 * credentials as plaintext (the served web tab, a desktop without an OS
 * keyring). That refusal is a rejected promise, and a `void`-ed write
 * turns it into a button that does nothing at all — the user gets no
 * record, no error, and no reason. Every write here reports the refusal
 * with its cause and resolves `null`, so callers can abort the flow
 * they were driving instead of continuing on a record that was never
 * stored.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { useCallback } from 'react';

/** Resolves the write's value, or `null` when it was refused. */
export type BackendRegistryWrite = <T>(op: () => Promise<T>) => Promise<T | null>;

export function useBackendRegistryWrite(): BackendRegistryWrite {
  const t = useT();
  const { notification } = AntApp.useApp();
  return useCallback(
    <T>(op: () => Promise<T>): Promise<T | null> =>
      op().catch((err: unknown) => {
        notification.error({
          title: t('workbench.settings.backendPane.connections.writeFailed'),
          description: err instanceof Error ? err.message : String(err),
        });
        return null;
      }),
    [notification, t],
  );
}
