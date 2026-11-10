/**
 * Session progress — what each file of a session with several files
 * holds while another file is in the pane.
 *
 * One pane serves every file, so a file's answers leave the pane when
 * the person selects another. What they left is kept: the result text
 * (the Apply payload), the per-hunk picks (replayed into the pane when
 * the file returns, so an answered hunk comes back answered) and the
 * count of sides still pending (the sidebar's pill and the Complete
 * Merge gate). A file the person never opened counts the hunks of its
 * seed; the file in the pane reports live.
 *
 * A seed is the text a file's pane opens on: the adapter's
 * `initialResult`, or the side a session-wide accept replaced it with.
 */

import { diffLinesPatience } from './diff/patience-diff';
import type { MergeFile } from './types';
import type { HunkPickState } from './use-hunk-pick-state';

/** A file as the person left it for another. */
export interface LeftFile {
  text: string;
  picks: ReadonlyMap<string, HunkPickState>;
  /** Sides still pending when the file left the pane. */
  remaining: number;
}

export interface SessionProgressArgs {
  files: readonly MergeFile[];
  /** Seeds a session-wide accept wrote, by file id. */
  seeds: ReadonlyMap<string, string>;
  /** The files the person opened and left, by file id. */
  left: ReadonlyMap<string, LeftFile>;
  activeFileId: string | null;
}

/**
 * The hunks a file opens with against its seed. Symmetric to the
 * pane's per-kind gating: `kind: 'add'` skips the mine-vs-result diff
 * (mine is empty by design), `kind: 'remove'` the theirs-vs-result
 * diff — without the gates an added file would never read resolved.
 */
export function seedHunkCount(file: MergeFile, seed: string): number {
  const theirs = file.kind === 'remove' ? 0 : diffLinesPatience(file.theirs, seed).length;
  const mine = file.kind === 'add' ? 0 : diffLinesPatience(file.mine, seed).length;
  return theirs + mine;
}

/** What is left to answer in every file: live for the one in the pane, as left for a visited one, the seed's hunks otherwise. */
export function remainingByFile(args: SessionProgressArgs & { activeRemaining: number }): Map<string, number> {
  const { files, seeds, left, activeFileId, activeRemaining } = args;
  const out = new Map<string, number>();
  for (const file of files) {
    if (file.id === activeFileId) {
      out.set(file.id, activeRemaining);
      continue;
    }
    const visited = left.get(file.id);
    out.set(file.id, visited?.remaining ?? seedHunkCount(file, seeds.get(file.id) ?? file.initialResult));
  }
  return out;
}

/** Every file's result text for Apply: the pane's for the active file, as left for a visited one, the seed otherwise. */
export function sessionResults(args: SessionProgressArgs & { activeText: string | undefined }): Map<string, string> {
  const { files, seeds, left, activeFileId, activeText } = args;
  const out = new Map<string, string>();
  for (const file of files) {
    if (file.id === activeFileId && activeText !== undefined) out.set(file.id, activeText);
    else out.set(file.id, left.get(file.id)?.text ?? seeds.get(file.id) ?? file.initialResult);
  }
  return out;
}
