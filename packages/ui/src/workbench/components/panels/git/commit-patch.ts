/**
 * commit-patch — the pure side of the log's Create Patch…: the order
 * the host reads the commits in and the file name the patch saves
 * under. The log lists newest first; a patch applies oldest first.
 */

import { shortSha } from './short-sha';

/** The selection in apply order — oldest first. */
export function patchApplyOrder(shas: readonly string[]): string[] {
  return [...shas].reverse();
}

/** `1a2b3c4d.patch` for one commit; `<oldest>-<newest>.patch` for a set (list order in, newest first). */
export function patchFilename(shas: readonly string[]): string {
  if (shas.length === 0) return 'commits.patch';
  if (shas.length === 1) return `${shortSha(shas[0])}.patch`;
  return `${shortSha(shas[shas.length - 1])}-${shortSha(shas[0])}.patch`;
}
