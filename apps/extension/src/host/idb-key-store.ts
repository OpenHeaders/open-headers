/**
 * Per-host at-rest key provisioning for the browser-extension host (WS-B B4).
 *
 * Generates a **non-extractable** AES-GCM key on first use and persists the
 * `CryptoKey` *handle* in IndexedDB. A non-extractable key structured-clones
 * into IndexedDB, but its raw bytes never become readable by our code (or by
 * anything inspecting `chrome.storage`) — the strongest at-rest guarantee a
 * browser extension can offer, since no OS keychain is reachable here (the
 * desktop's `safeStorage` equivalent has no browser analogue).
 *
 * This is the browser's answer to "re-encrypt under the recipient's own key
 * on receive": every host owns a key only it can use, so vault ciphertext is
 * never portable between hosts — the seed crosses the loopback socket in
 * plaintext (sanctioned by the plan §B.2) and is sealed under *this* host's
 * key the moment it lands at rest.
 *
 * Concurrency: two extension contexts (SW + a popup) can race the first-use
 * generation. `putIfAbsent` does the get-and-put inside one `readwrite`
 * transaction, so whoever commits first wins and the loser adopts the stored
 * key — there is never a split where data is sealed under a discarded key.
 */

const DB_NAME = 'oh-secret-cipher';
const STORE_NAME = 'keys';
const KEY_ID = 'at-rest-aes-gcm-v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(db: IDBDatabase, id: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });
}

/** Atomic get-or-put: returns the already-stored key if a racing context won. */
function putIfAbsent(db: IDBDatabase, id: string, key: CryptoKey): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result as CryptoKey | undefined;
      if (existing) {
        resolve(existing);
        return;
      }
      const putRequest = store.put(key, id);
      putRequest.onsuccess = () => resolve(key);
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

function generateAtRestKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Load this host's at-rest key, minting + persisting it on first use. */
export async function loadOrCreateAtRestKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const existing = await idbGet(db, KEY_ID);
    if (existing) return existing;
    const key = await generateAtRestKey();
    return await putIfAbsent(db, KEY_ID, key);
  } finally {
    db.close();
  }
}
