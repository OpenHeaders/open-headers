/**
 * useVault — interim slice hook.
 *
 * Reads the vault via the legacy `getVault` RPC + `environmentsChanged`
 * broadcast. Session #3 of the MWPT-FULL epic replaces this with a
 * `VaultProvider` mirroring `EnvironmentProvider` (per-workspace
 * storage subscribe + Phase B `vault-write-client`). Until then this
 * hook follows the global default.
 */

import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { useEffect, useState } from 'react';

const EMPTY_VAULT: V5.Vault = { schemaVersion: 5, secrets: [] };

export interface UseVaultApi {
  vault: V5.Vault;
  isReady: boolean;
}

export function useVault(): UseVaultApi {
  const [vault, setVault] = useState<V5.Vault>(EMPTY_VAULT);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reload = () =>
      call('getVault')
        .then((resp) => {
          if (cancelled) return;
          setVault(resp.vault);
          setIsReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setIsReady(true);
        });

    void reload();

    const unsub = subscribe('environmentsChanged', (payload) => {
      setVault(payload.vault);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void reload();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, []);

  return { vault, isReady };
}
