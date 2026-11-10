/**
 * Messages of the commits made on another commit's behalf — a pick and
 * a revert. Pure: the caller reads the source commit and the operator.
 */

import type { CommitMeta } from './commit-meta';

/**
 * The message of a picked commit: the source's own message, then one
 * closing block git reads as trailers — the line git's `-x` writes,
 * and the source's author as a co-author. The operator authors a pick
 * (the git-sync plan §11.5: no author override), so the original author
 * is carried by the trailer; a pick of the operator's own commit
 * carries none.
 */
export function composePickMessage(source: CommitMeta, sha: string, operatorEmail: string | null): string {
  const closing = [`(cherry picked from commit ${sha})`];
  if (operatorEmail === null || source.author.email.toLowerCase() !== operatorEmail.toLowerCase()) {
    closing.push(`Co-Authored-By: ${source.author.name} <${source.author.email}>`);
  }
  return `${source.message}\n\n${closing.join('\n')}`;
}

/** The message of a revert, as git writes it: the source's subject quoted, then the sha it undoes. */
export function composeRevertMessage(source: CommitMeta, sha: string): string {
  const subject = source.message.split('\n', 1)[0];
  return `Revert "${subject}"\n\nThis reverts commit ${sha}.`;
}
