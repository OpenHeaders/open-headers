/**
 * Throwaway GnuPG signing keys for the apt and rpm staging specs. Every
 * gpg call autostarts daemons on its home (gpg-agent, scdaemon,
 * keyboxd) that outlive the call and keep writing into the home, so a
 * home is never just removed: `stopGpgDaemons` goes first and waits.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

export const PASSPHRASE = 'test-passphrase';

export const hasGpg = (() => {
  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

export type TestKey = { privateKey: string; publicKey: string };

export function genKey(home: string, name: string): TestKey {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const env = { ...process.env, GNUPGHOME: home };
  const params = [
    'Key-Type: eddsa',
    'Key-Curve: ed25519',
    'Key-Usage: sign',
    `Name-Real: ${name}`,
    'Name-Email: test@openheaders.io',
    'Expire-Date: 0',
    `Passphrase: ${PASSPHRASE}`,
    '%commit',
    '',
  ].join('\n');
  execFileSync('gpg', ['--batch', '--gen-key'], { env, input: params, stdio: ['pipe', 'ignore', 'ignore'] });
  const privateKey = execFileSync(
    'gpg',
    ['--batch', '--pinentry-mode', 'loopback', '--passphrase', PASSPHRASE, '--armor', '--export-secret-keys'],
    { env, encoding: 'utf8' },
  );
  const publicKey = execFileSync('gpg', ['--batch', '--armor', '--export'], { env, encoding: 'utf8' });
  return { privateKey, publicKey };
}

export function stopGpgDaemons(home: string): void {
  try {
    execFileSync('gpgconf', ['--kill', 'all'], { env: { ...process.env, GNUPGHOME: home }, stdio: 'ignore' });
  } catch {
    // nothing running on that home — nothing to stop
  }
}
