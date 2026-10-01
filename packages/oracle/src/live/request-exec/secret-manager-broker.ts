/**
 * The secret-manager broker a host installs — the seam the per-send
 * registry build resolves through (the Secret Providers plan, P2). A
 * node host (the desktop app's main process, the daemon) installs the
 * LOCAL broker: the referenced entries grouped per connection, each
 * group resolved through its connection and the installed provider.
 * The browser's service worker installs its own broker that asks the
 * desktop app on this device over loopback; nothing here reads a
 * provider for it. Absent any installation the local broker answers,
 * so every node host resolves as it always did.
 */

import {
  getSecretProvider,
  type SecretBrokerEntry,
  type SecretManagerBroker,
  type SecretManagerConnection,
  type SecretResolution,
} from '@openheaders/core/secret-providers';
import { logger } from '@openheaders/core/utils';
import { getSecretManagerConnection } from '../../entity/secret-manager-connections-store';

/**
 * The local broker over this host's connections and providers. Every
 * failure is typed, keyed by entry name: an entry naming no
 * connection, one this host no longer holds, or a provider kind not
 * installed here reads `unavailable`; the provider's own resolve
 * failure passes through verbatim. Entries are grouped per connection
 * and resolve concurrently behind the provider's one client per
 * connection. `lookupConnection` is the store's read by default; tests
 * inject their own.
 */
export function createLocalSecretManagerBroker(
  lookupConnection: (uid: string) => SecretManagerConnection | undefined = getSecretManagerConnection,
): SecretManagerBroker {
  return {
    async resolveBatch(entries) {
      const results = new Map<string, SecretResolution>();
      const byConnection = new Map<string, SecretBrokerEntry[]>();
      for (const entry of entries) {
        const group = byConnection.get(entry.locator.connectionId);
        if (group) group.push(entry);
        else byConnection.set(entry.locator.connectionId, [entry]);
      }
      const failGroup = (group: SecretBrokerEntry[], detail: string): void => {
        for (const entry of group) results.set(entry.name, { ok: false, reason: 'unavailable', detail });
      };
      await Promise.all(
        [...byConnection].map(async ([connectionId, group]) => {
          const connection = connectionId === '' ? undefined : lookupConnection(connectionId);
          if (!connection) {
            failGroup(group, 'The entry names no connection this device holds.');
            return;
          }
          const provider = getSecretProvider(connection.config.provider);
          if (!provider) {
            failGroup(group, 'No provider for this secret manager is installed on this device.');
            return;
          }
          await Promise.all(
            group.map(async (entry) => {
              try {
                results.set(entry.name, await provider.resolve(connection, entry.locator));
              } catch (err) {
                // Providers are non-throwing by contract; a throw is a bug
                // in the implementation — degrade to the honest typed failure.
                const detail = (err as Error).message;
                logger.info('RequestExec', `Secret resolve failed for '${entry.name}': ${detail}`);
                results.set(entry.name, { ok: false, reason: 'unavailable', detail });
              }
            }),
          );
        }),
      );
      return results;
    },
  };
}

let installed: SecretManagerBroker | null = null;

/** Install the host's broker; `null` returns to the local one. */
export function setSecretManagerBroker(broker: SecretManagerBroker | null): void {
  installed = broker;
}

/** The broker the registry build resolves through — the installed one, else the local one. */
export function getSecretManagerBroker(): SecretManagerBroker {
  installed ??= createLocalSecretManagerBroker();
  return installed;
}
