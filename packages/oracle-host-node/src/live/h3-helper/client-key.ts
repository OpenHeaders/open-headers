/**
 * Node-side decryption of a passphrase-protected client key. rustls
 * does not decrypt encrypted PEM, and the passphrase must never cross
 * the helper protocol — so the key crosses as unencrypted PKCS#8,
 * decrypted here with the same OpenSSL stack the other pipelines
 * already trust with the material.
 */

import { createPrivateKey } from 'node:crypto';

export function decryptedClientKeyPem(keyPem: string, passphrase: string | undefined): string {
  if (passphrase === undefined) return keyPem;
  const key = createPrivateKey({ key: keyPem, passphrase });
  const exported = key.export({ type: 'pkcs8', format: 'pem' });
  return typeof exported === 'string' ? exported : exported.toString('utf8');
}
