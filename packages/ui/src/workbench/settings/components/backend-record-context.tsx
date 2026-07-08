/**
 * Carries one `OH.backends` record down to the connection-field editors
 * (address, authentication, auto-connect) so the same field components
 * serve every row of the connections list. The provider is mounted by
 * the row editor; `patch` is id-scoped, so a field write can never land
 * on a different record than the one it renders.
 */

import { type BackendConnectionPatch, updateBackend } from '@openheaders/core/backends';
import type { BackendConnection } from '@openheaders/core/types';
import { createContext, useContext, useMemo } from 'react';
import type React from 'react';

export interface BackendRecordHandle {
  record: BackendConnection;
  patch: (patch: BackendConnectionPatch) => Promise<void>;
}

const BackendRecordContext = createContext<BackendRecordHandle | null>(null);

export const BackendRecordProvider: React.FC<{ record: BackendConnection; children: React.ReactNode }> = ({
  record,
  children,
}) => {
  const handle = useMemo<BackendRecordHandle>(
    () => ({
      record,
      patch: async (patch) => {
        await updateBackend(record.id, patch);
      },
    }),
    [record],
  );
  return <BackendRecordContext.Provider value={handle}>{children}</BackendRecordContext.Provider>;
};

/** The record this field edits, or null outside a row editor. */
export function useBackendRecord(): BackendRecordHandle | null {
  return useContext(BackendRecordContext);
}

/** What the UI calls this backend — the user's label, else its address. */
export function backendDisplayLabel(record: BackendConnection): string {
  const label = record.label.trim();
  return label.length > 0 ? label : record.url;
}
