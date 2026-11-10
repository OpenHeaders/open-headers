/**
 * Who wrote a commit and what it says, and who the next commit will be
 * written by — the two reads behind a commit that is made on another
 * commit's behalf (a pick, a revert). Same discipline as
 * `branch-ops.ts`: explicit repo addressing, the injected
 * {@link GitRunner} seam, full shas only.
 */

import type { GitRunner } from './git-exec';
import { isCommitSha, repoArgs } from './repo';

export interface CommitPerson {
  name: string;
  email: string;
}

export interface CommitMeta {
  author: CommitPerson;
  /** The whole message — subject, blank line, body — without the trailing newline. */
  message: string;
}

const FIELD = '\x1f';

/** The author and message of the commit at a FULL sha; null when the repo does not hold it. */
export async function readCommitMeta(run: GitRunner, rootDir: string, sha: string): Promise<CommitMeta | null> {
  if (!isCommitSha(sha)) return null;
  const shown = await run([...repoArgs(rootDir), 'show', '-s', '--format=%an%x1f%ae%x1f%B', sha, '--'], {
    cwd: rootDir,
  });
  if (shown.code !== 0) return null;
  const [name, email, ...message] = shown.stdout.split(FIELD);
  if (name === undefined || email === undefined) return null;
  return { author: { name, email }, message: message.join(FIELD).trimEnd() };
}

/**
 * The author the next commit gets under `identityEnv` — git's own
 * answer (`git var`), so repo-local config, the global config and the
 * env's fallback halves resolve exactly as the commit will. Null when
 * git cannot settle an identity.
 */
export async function readCommitAuthorIdentity(
  run: GitRunner,
  rootDir: string,
  identityEnv: Record<string, string>,
): Promise<CommitPerson | null> {
  const ident = await run([...repoArgs(rootDir), 'var', 'GIT_AUTHOR_IDENT'], { cwd: rootDir, env: identityEnv });
  if (ident.code !== 0) return null;
  const match = /^(.*) <([^>]*)> \d+ [+-]\d{4}$/.exec(ident.stdout.trim());
  return match === null ? null : { name: match[1], email: match[2] };
}
