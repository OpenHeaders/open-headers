/**
 * Vault decryption state for the import preview — when the envelope
 * carries a `secrets` block, the user enters a passphrase and we
 * decrypt client-side, then inject the resulting secrets into
 * `envelope.entities.vault.secrets` so the importer's standard vault
 * path picks them up. The passphrase never crosses the bridge — only
 * the decrypted secrets do, and only inside the `incoming` envelope
 * payload of `importWorkspace`.
 */

import {
  decryptVaultBlock,
  VaultDecryptionFailedError,
  VaultPayloadShapeError,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import { useCallback, useState } from 'react';

export interface VaultDecryptState {
  passphrase: string;
  setPassphrase: (next: string) => void;
  decryptError: string | null;
  decrypting: boolean;
  fingerprints: { ciphertext: string; key: string } | null;
  /** Per-secret decode failures surfaced by `decryptVaultBlock` — these
   *  are well-formed envelope + correct passphrase, but one or more
   *  entries inside the AES-GCM payload didn't validate against
   *  `VaultSecretSchema`. Surfaced alongside the decrypted banner so the
   *  user can see "N secret(s) skipped" with the per-entry reason
   *  (design §3.2 — fail-soft per secret instead of all-or-nothing). */
  partialDrops: { index: number; reason: string }[];
  /** When set, the rendered envelope has decrypted secrets injected. */
  decryptedEnvelope: WorkspaceExport | null;
  decrypt: () => Promise<void>;
  /** Reset all vault state — a fresh envelope shouldn't carry over the
   *  prior passphrase or decrypted vault. */
  reset: () => void;
}

export function useVaultDecrypt(envelope: WorkspaceExport | null): VaultDecryptState {
  const [passphrase, setPassphrase] = useState('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [fingerprints, setFingerprints] = useState<{ ciphertext: string; key: string } | null>(null);
  const [partialDrops, setPartialDrops] = useState<{ index: number; reason: string }[]>([]);
  const [decryptedEnvelope, setDecryptedEnvelope] = useState<WorkspaceExport | null>(null);

  const decrypt = useCallback(async () => {
    if (!envelope?.secrets) return;
    setDecrypting(true);
    setDecryptError(null);
    try {
      const result = await decryptVaultBlock(envelope.secrets, passphrase);
      // Inject decrypted secrets into a new envelope copy. The importer's
      // standard vault path handles merge/replace/skip; we don't need to
      // touch the importer to support encrypted exports.
      const next: WorkspaceExport = {
        ...envelope,
        entities: {
          ...envelope.entities,
          vault: {
            schemaVersion: 5,
            secrets: result.secrets,
          },
        },
      };
      // Drop the encrypted block from the working copy — it served its
      // purpose; the decrypted secrets are now in entities.vault and the
      // importer reads from there.
      delete (next as { secrets?: unknown }).secrets;
      setDecryptedEnvelope(next);
      setFingerprints({ ciphertext: result.ciphertextFingerprint, key: result.keyFingerprint });
      setPartialDrops(result.drops);
      setPassphrase(''); // wipe from memory
    } catch (err) {
      if (err instanceof VaultDecryptionFailedError) {
        setDecryptError(
          'Could not decrypt — wrong passphrase or tampered ciphertext. Check the passphrase with the sender.',
        );
      } else if (err instanceof VaultPayloadShapeError) {
        setDecryptError(`The encrypted payload didn't match an expected vault shape: ${err.message}`);
      } else {
        setDecryptError(err instanceof Error ? err.message : 'Decryption failed');
      }
    } finally {
      setDecrypting(false);
    }
  }, [envelope, passphrase]);

  const reset = useCallback(() => {
    setPassphrase('');
    setDecryptError(null);
    setFingerprints(null);
    setPartialDrops([]);
    setDecryptedEnvelope(null);
  }, []);

  return {
    passphrase,
    setPassphrase,
    decryptError,
    decrypting,
    fingerprints,
    partialDrops,
    decryptedEnvelope,
    decrypt,
    reset,
  };
}
