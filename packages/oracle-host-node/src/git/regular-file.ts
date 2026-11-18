/**
 * A file of the bound folder that is a regular file or nothing — the
 * folder's `.gitignore` and `.gitattributes`. Git reads neither through
 * a link (a link at the name is an ignore file that holds nothing), and
 * a commit can put one there: read through, it would answer for a file
 * git never reads; written through, the write would land wherever it
 * points.
 *
 * So such a file is asked at its OWN name, never through it. A link
 * standing there is told apart from a file and from nothing, and a file
 * is put in its place by taking the link away first — the link, never
 * what it points to — and renaming the new file onto the name. What
 * stands there and is neither (a directory) is somebody's: it is not
 * replaced, and the write is refused.
 *
 * The directories on the way are the boundary's (`tree-boundary.ts`),
 * which asks them once a pass; a file's own name is asked here, each
 * time. As there, this is no guard against another program of the user's
 * racing the pass.
 */

import { promises as fs } from 'node:fs';
import { failureCode, isGone } from './fs-failure';
import type { TreeBoundary, TreeRefusal } from './tree-boundary';

/** What stands at a file's own name. */
export type StandingFile =
  | { kind: 'text'; text: string }
  | { kind: 'absent' }
  /** A link — on Windows a junction is one too. Where it points is not asked. */
  | { kind: 'link' }
  /** Neither a file nor a link: a directory, as a rule. */
  | { kind: 'not-a-file' }
  /** A file that stands and would not be read: never taken for gone, never written over. */
  | { kind: 'unread'; code?: string };

function failed(err: unknown): StandingFile {
  const code = failureCode(err);
  if (isGone(code)) return { kind: 'absent' };
  return { kind: 'unread', ...(code !== undefined ? { code } : {}) };
}

/** What stands at `file`, and its text where that is a regular file. Never throws. */
export async function readRegularFile(file: string): Promise<StandingFile> {
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink()) return { kind: 'link' };
    if (!stat.isFile()) return { kind: 'not-a-file' };
    return { kind: 'text', text: await fs.readFile(file, 'utf-8') };
  } catch (err) {
    return failed(err);
  }
}

export type RegularFilePut = { ok: true } | { ok: false; refusal: TreeRefusal };

/**
 * Put a regular file holding `content` at `relative`, over the file or
 * in the place of the link that stands there. Refused, with nothing
 * written, where the boundary refuses the path or what stands at the
 * name is neither.
 */
export async function putRegularFile(
  boundary: TreeBoundary,
  relative: string,
  content: string,
): Promise<RegularFilePut> {
  const placed = await boundary.locate(relative);
  if (!placed.ok) return placed;
  const stands = await fs.lstat(placed.place.file).catch((err: unknown) => {
    if (isGone(failureCode(err))) return null;
    throw err;
  });
  const link = stands?.isSymbolicLink() === true;
  if (stands !== null && !link && !stands.isFile()) return { ok: false, refusal: { kind: 'place' } };
  const staging = await boundary.stage(placed.place, content);
  if (!staging.ok) return staging;
  // The link goes by its own name. A rename onto it would do on POSIX;
  // Windows renames no file onto a link to a directory.
  if (link) await fs.unlink(placed.place.file);
  await staging.staged.land();
  return { ok: true };
}
