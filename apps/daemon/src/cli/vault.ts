/**
 * `ohd vault rotate` — offline vault key rotation. The current
 * passphrase comes from the standing env pair
 * (`OH_DAEMON_VAULT_PASSPHRASE` / `OH_DAEMON_VAULT_PASSPHRASE_FILE`,
 * resolved by the config chain like every other run), the new one from
 * `OH_DAEMON_VAULT_NEW_PASSPHRASE` / `OH_DAEMON_VAULT_NEW_PASSPHRASE_FILE`
 * — env/file only, never argv, so neither secret lands in shell
 * history or the process list. Runs under the stopped-daemon
 * single-writer guard; the crypto lives in `vault-cipher.ts`.
 */

import { parseArgs } from 'node:util';
import { resolvePassphraseEnv } from '../config';
import { rotateVaultKey } from '../vault-cipher';
import { CONFIG_OPTIONS, resolveConfigFlags } from './config-flags';
import { assertDaemonStopped } from './daemon-stopped';

export async function commandVault(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  if (sub !== 'rotate') throw new Error('usage: ohd vault rotate');
  const { values } = parseArgs({ args: [...rest], options: CONFIG_OPTIONS });
  const config = resolveConfigFlags(values);
  await assertDaemonStopped(
    config,
    'storage.json is single-writer; a rotation under a live daemon would be clobbered by its next flush.',
  );
  if (config.vaultPassphrase === null) {
    throw new Error(
      'no current passphrase — set OH_DAEMON_VAULT_PASSPHRASE or OH_DAEMON_VAULT_PASSPHRASE_FILE to the passphrase being rotated away from',
    );
  }
  const newPassphrase = resolvePassphraseEnv(
    process.env,
    'OH_DAEMON_VAULT_NEW_PASSPHRASE',
    'OH_DAEMON_VAULT_NEW_PASSPHRASE_FILE',
  );
  if (newPassphrase === null) {
    throw new Error(
      'no new passphrase — set OH_DAEMON_VAULT_NEW_PASSPHRASE or OH_DAEMON_VAULT_NEW_PASSPHRASE_FILE to the passphrase being rotated to',
    );
  }
  const { reencrypted } = rotateVaultKey(config.dataDir, config.vaultPassphrase, newPassphrase);
  console.log(`Vault key rotated; ${reencrypted} sensitive slot(s) re-encrypted.`);
  console.log('Update OH_DAEMON_VAULT_PASSPHRASE (or the passphrase file) in the service');
  console.log('unit / compose environment to the new passphrase before the next start —');
  console.log('the daemon refuses to boot on the old one.');
}
