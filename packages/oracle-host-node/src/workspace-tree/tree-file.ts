/**
 * One file of a bound folder, read — the only way a pass takes a file
 * of the working tree whole.
 *
 * The folder is not the engine's: it is often a clone, and a file in it
 * may be anything. A read answers one of three things and never throws:
 * the text; `absent`, the file is not there; `unread`, the file stands
 * and its bytes are not known — too large to be a document
 * (`TREE_FILE_MAX_BYTES`, measured on the open file, so the file
 * measured is the file read), or it would not open or read. What stands
 * unread is never taken for gone, and never written over.
 *
 * A file the materializer writes is asked at its OWN name: a link
 * standing there is the user's, and is told apart from a file — never
 * read through, so what it points at is never taken for the engine's
 * write. POSIX opens a file by its own name alone; Windows has no such
 * open, and the name is asked first there.
 *
 * A failure is read by the system's code (`git/fs-failure.ts`).
 */

import { constants, promises as fs } from 'node:fs';
import { TREE_FILE_MAX_BYTES } from '@openheaders/core/workspace-tree';
import { failureCode, isGone } from '../git';

export type TreeFileRead =
  | { kind: 'text'; content: string }
  | { kind: 'absent' }
  | { kind: 'unread'; cause: 'too-large' | 'unreadable'; code?: string };

function failed(err: unknown): TreeFileRead {
  const code = failureCode(err);
  if (isGone(code)) return { kind: 'absent' };
  return { kind: 'unread', cause: 'unreadable', ...(code !== undefined ? { code } : {}) };
}

async function readUpTo(filePath: string, maxBytes: number, flags: string | number = 'r'): Promise<TreeFileRead> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(filePath, flags);
  } catch (err) {
    return failed(err);
  }
  try {
    const { size } = await handle.stat();
    if (size > maxBytes) return { kind: 'unread', cause: 'too-large' };
    return { kind: 'text', content: await handle.readFile('utf-8') };
  } catch (err) {
    return failed(err);
  } finally {
    await handle.close();
  }
}

/** A file a reading of the tree would take in: one over the limit is not read. */
export function readTreeFile(filePath: string): Promise<TreeFileRead> {
  return readUpTo(filePath, TREE_FILE_MAX_BYTES);
}

/** What stands at a path the materializer writes: a file's read, or a link at the file's own name. */
export type WrittenFileRead = TreeFileRead | { kind: 'link' };

/** The system's code for a link met by an open that follows none. */
const LINK_AT_THE_NAME = 'ELOOP';

/**
 * The file at a path the materializer writes, to tell its own write
 * from anything else. The engine's write is as large as the engine made
 * it, so no limit applies; a file too large to be a string at all
 * answers `unread`. A link at the name answers `link`, and where it
 * points is not asked — the directories on the way are the boundary's
 * (`git/tree-boundary.ts`), so the name is all that is left to be one.
 */
export function readWrittenFile(filePath: string): Promise<WrittenFileRead> {
  return readAtItsOwnName(filePath, constants.O_NOFOLLOW);
}

/**
 * {@link readWrittenFile} by the platform's way: `noFollow` is the flag
 * of an open that follows no link at the name — Windows has none, and
 * there the name is asked before the file is opened.
 */
export async function readAtItsOwnName(filePath: string, noFollow: number | undefined): Promise<WrittenFileRead> {
  if (noFollow === undefined) {
    try {
      if ((await fs.lstat(filePath)).isSymbolicLink()) return { kind: 'link' };
    } catch (err) {
      return failed(err);
    }
    return readUpTo(filePath, Number.POSITIVE_INFINITY);
  }
  const read = await readUpTo(filePath, Number.POSITIVE_INFINITY, constants.O_RDONLY | noFollow);
  return read.kind === 'unread' && read.code === LINK_AT_THE_NAME ? { kind: 'link' } : read;
}
