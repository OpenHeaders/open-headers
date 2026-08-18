/**
 * Encrypted backend-registry seed for the daemon e2e specs — points the
 * extension at a spawned daemon by writing the `oh.backends` sensitive
 * slot, sealed with the SW host's own at-rest key.
 *
 * Faithful to `src/host/idb-key-store.ts`: same DB/store/key id, same
 * upgrade path, same non-extractable AES-GCM-256 params, same
 * single-transaction put-if-absent, same provisioning marker. On a fresh
 * profile the SW may not have provisioned the key yet — a bare
 * `indexedDB.open` without an upgrade handler would mint an EMPTY
 * version-1 database whose missing `keys` store then breaks the host's
 * cipher for the whole profile (`transaction('keys')` throws
 * NotFoundError synchronously inside `onsuccess`, so a naive promise
 * wrapper never settles and the spec hangs).
 */

import type { Worker } from '@playwright/test';

export interface BackendSeed {
  backendUrl: string;
  authToken: string;
  recordId: string;
  recordLabel: string;
}

/** Seal one registry record under the host's at-rest key (minting it if absent) and write the slot. */
export async function seedEncryptedBackendRegistry(worker: Worker, seed: BackendSeed): Promise<void> {
  await worker.evaluate(async ({ backendUrl, authToken, recordId, recordLabel }: BackendSeed) => {
    // Pre-generate outside the transaction — IDB transactions auto-commit
    // at the first await, so the get-and-put must stay synchronous inside
    // one readwrite transaction (the idb-key-store `putIfAbsent` shape).
    const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const key = await new Promise<CryptoKey>((resolve, reject) => {
      const open = indexedDB.open('oh-secret-cipher', 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore('keys');
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const store = db.transaction('keys', 'readwrite').objectStore('keys');
          const getRequest = store.get('at-rest-aes-gcm-v1');
          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            const existing = getRequest.result as CryptoKey | undefined;
            if (existing) {
              db.close();
              resolve(existing);
              return;
            }
            const putRequest = store.put(fresh, 'at-rest-aes-gcm-v1');
            putRequest.onerror = () => reject(putRequest.error);
            putRequest.onsuccess = () => {
              db.close();
              resolve(fresh);
            };
          };
        } catch (err) {
          reject(err);
        }
      };
    });
    const record = {
      id: recordId,
      label: recordLabel,
      url: backendUrl,
      authToken,
      autoConnect: true,
      enabled: true,
      addedAt: new Date().toISOString(),
      lastConnectedAt: null,
    };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify([record])),
    );
    const packed = new Uint8Array(iv.length + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), iv.length);
    let binary = '';
    for (const byte of packed) binary += String.fromCharCode(byte);
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          onboardingCompleted: true,
          'oh.host.atRestKeyProvisioned': true,
          'oh.backends': `v1:${btoa(binary)}`,
        },
        () => resolve(),
      );
    });
  }, seed);
}
