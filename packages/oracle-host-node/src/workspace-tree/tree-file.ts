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
 * A failure is read by the system's code (`git/fs-failure.ts`).
 */

import { promises as fs } from 'node:fs';
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

async function readUpTo(filePath: string, maxBytes: number): Promise<TreeFileRead> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(filePath, 'r');
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

/**
 * The file at a path the materializer writes, to tell its own write
 * from anything else. The engine's write is as large as the engine made
 * it, so no limit applies; a file too large to be a string at all
 * answers `unread`.
 */
export function readWrittenFile(filePath: string): Promise<TreeFileRead> {
  return readUpTo(filePath, Number.POSITIVE_INFINITY);
}
