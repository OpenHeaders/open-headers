/**
 * shortSha — the ONE short form of a commit's hash: what a row, a
 * title, a toast or a file name shows where the whole forty would not
 * fit. Eight characters (the reference's reading).
 */

const SHORT_SHA_LENGTH = 8;

export function shortSha(sha: string): string {
  return sha.slice(0, SHORT_SHA_LENGTH);
}
