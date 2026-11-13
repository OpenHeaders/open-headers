/**
 * Commit signatures — which commits carry a signature and whether git
 * can verify it: the log's GPG Signature column. Two reads, so that a
 * history with no signed commit never starts a verification: the raw
 * commits say which are signed (a `gpgsig` header), and git's own check
 * (`%G?`, the signer, the key) is asked of those alone. The header is
 * read because the check's letter cannot say "signed": an SSH signature
 * with no allowed-signers file answers `N`, as an unsigned commit does.
 * A pure read with the same discipline as `patch-ops.ts`: explicit repo
 * addressing, the injected {@link GitRunner} seam, full shas only.
 */

import type { GitRunner } from './git-exec';
import { isCommitSha, repoArgs } from './repo';

/**
 * What a signature is worth: git verified it; it is there but git could
 * not vouch for it (an unknown or expired key, no key to check with, a
 * signer the allowed list does not hold); or it does not verify.
 */
export type CommitSignatureState = 'good' | 'unverified' | 'bad';

export interface CommitSignature {
  sha: string;
  state: CommitSignatureState;
  /** Who signed, as git names them; absent when it cannot say. */
  signer?: string;
  /** The key's id or fingerprint; absent when git cannot say. */
  key?: string;
}

/** The commits one read may ask about — a log window and then some. */
export const COMMIT_SIGNATURES_MAX_COMMITS = 500;

/** Git's `%G?` letter for a commit that carries a signature. */
export function signatureState(letter: string): CommitSignatureState {
  if (letter === 'G') return 'good';
  // A signature that does not verify, or a good one made by a revoked key.
  if (letter === 'B' || letter === 'R') return 'bad';
  return 'unverified';
}

/** The commits of a NUL-separated raw log that carry a signature header. */
export function parseSignedShas(stdout: string): string[] {
  const signed: string[] = [];
  for (const record of stdout.split('\0')) {
    const headers = record.split('\n\n', 1)[0].split('\n');
    const sha = /^commit ([0-9a-f]{40,64})$/.exec(headers[0] ?? '')?.[1];
    if (sha !== undefined && headers.some((line) => line.startsWith('gpgsig'))) signed.push(sha);
  }
  return signed;
}

/**
 * The signed commits among `shas`, each with what git makes of its
 * signature; a commit without one is not listed. Null when a sha is no
 * commit of the repo.
 */
export async function readCommitSignatures(
  run: GitRunner,
  rootDir: string,
  shas: readonly string[],
): Promise<CommitSignature[] | null> {
  if (!shas.every(isCommitSha)) return null;
  if (shas.length === 0) return [];
  const raw = await run([...repoArgs(rootDir), 'log', '--no-walk=unsorted', '-z', '--pretty=raw', ...shas, '--'], {
    cwd: rootDir,
  });
  if (raw.code !== 0) return null;
  const signed = parseSignedShas(raw.stdout);
  if (signed.length === 0) return [];
  const checked = await run(
    [...repoArgs(rootDir), 'log', '--no-walk=unsorted', '--format=%H%x1f%G?%x1f%GS%x1f%GK', ...signed, '--'],
    { cwd: rootDir },
  );
  // The check itself failing (no program to verify with) leaves every signature unvouched for.
  const answers = new Map<string, CommitSignature>();
  for (const line of checked.code === 0 ? checked.stdout.split('\n') : []) {
    const [sha, letter, signer, key] = line.split('\x1f');
    if (sha === undefined || letter === undefined) continue;
    answers.set(sha, {
      sha,
      state: signatureState(letter),
      ...(signer !== undefined && signer.length > 0 ? { signer } : {}),
      ...(key !== undefined && key.length > 0 ? { key } : {}),
    });
  }
  return signed.map((sha) => answers.get(sha) ?? { sha, state: 'unverified' });
}
