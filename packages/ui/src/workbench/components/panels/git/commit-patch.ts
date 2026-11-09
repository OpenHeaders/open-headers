/**
 * commit-patch — the pure side of the log's Create Patch…: the order
 * the host reads the commits in and the file name the patch saves
 * under. The log lists newest first; a patch applies oldest first.
 */

/** The selection in apply order — oldest first. */
export function patchApplyOrder(shas: readonly string[]): string[] {
  return [...shas].reverse();
}

/** `1a2b3c4.patch` for one commit; `<oldest>-<newest>.patch` for a set (list order in, newest first). */
export function patchFilename(shas: readonly string[]): string {
  const short = (sha: string): string => sha.slice(0, 7);
  if (shas.length === 0) return 'commits.patch';
  if (shas.length === 1) return `${short(shas[0])}.patch`;
  return `${short(shas[shas.length - 1])}-${short(shas[0])}.patch`;
}
