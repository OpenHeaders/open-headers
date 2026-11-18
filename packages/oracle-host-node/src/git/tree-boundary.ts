/**
 * The bound folder's boundary — where a file of the working tree may be
 * written or removed. Every write and removal of ours in the folder
 * goes through here: the materializer's, an answered file of the
 * user's own, the removals a landing and a rollback make, a deletion a
 * person asks for. What git itself writes — a checkout — is git's, and
 * git writes through no link.
 *
 * A path is joined under the folder as it comes: from the engine, which
 * holds what its peers sent; from a baseline; from a caller. Two things
 * are asked of it before anything is done at it:
 *
 *   - its TEXT (core's `tree-path.ts`): a path that climbs out, or
 *     names git's directory or the sidecar by any name a filesystem
 *     folds onto them, is no file of the tree;
 *   - the DISK: every directory on the way to it is a directory. A link
 *     standing at one — on Windows a junction is one too — would carry
 *     the write to wherever it points, and a file standing at one is
 *     somebody's file. Neither is followed, replaced or removed.
 *
 * A path that fails is refused with what failed, for its row; nothing is
 * done at it.
 *
 * The disk is asked once a pass for each directory: one boundary is one
 * pass's. A pass runs alone on its folder's chain, and a link gets into
 * the folder by a pass of ours — git landing a commit's own files — so
 * what a pass saw of a directory holds for that pass. This is no guard
 * against another program of the user's racing the pass: such a program
 * already writes where the user can.
 *
 * A file is written beside its place under a name nothing can know
 * beforehand and renamed onto it, so a reader never meets half a file
 * and what stands at the temp file's name is never somebody else's. The
 * directories a file needs are made one at a time, each looked at where
 * it already stood.
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type TreeIssue, treePathIssue, treePathRefusal } from '@openheaders/core/workspace-tree';
import { failureCode, isGone } from './fs-failure';

/** Why a path is not the tree's to write or remove. */
export type TreeRefusal =
  | { kind: 'path' /** What of the path no tree can hold (`treePathRefusal`). */; part: string }
  | { kind: 'way' /** The directory on the way, workspace-relative. */; dir: string; stands: 'link' | 'file' }
  /** What stands at the file's own name is no file — asked only where a file's own name is (`regular-file.ts`). */
  | { kind: 'place' };

/** A path the boundary passed: the file's place on disk. */
export interface TreePlace {
  /** Workspace-relative with `/` separators. */
  readonly relative: string;
  /** Absolute. */
  readonly file: string;
}

export type TreePlaced = { ok: true; place: TreePlace } | { ok: false; refusal: TreeRefusal };

/** A file written beside its place, not yet at it. */
export interface StagedTreeFile {
  /** Put it at its place, over what stands there. */
  land(): Promise<void>;
  /** Take it away again; the place stands as it was. */
  discard(): Promise<void>;
}

export type TreeStaged = { ok: true; staged: StagedTreeFile } | { ok: false; refusal: TreeRefusal };

/** What a directory on the way is: one, not there, or what stands in its place. */
type Way = 'directory' | 'absent' | Extract<TreeRefusal, { kind: 'way' }>;

const parentOf = (relative: string): string => {
  const cut = relative.lastIndexOf('/');
  return cut === -1 ? '' : relative.slice(0, cut);
};

/** A refusal in a sentence, for a pass that fails by it. */
export function treeRefusalReason(relative: string, refusal: TreeRefusal): string {
  if (refusal.kind === 'path') return `${refusal.part} cannot be part of the path "${relative}"`;
  if (refusal.kind === 'place') return `"${relative}" is not a file`;
  return `"${refusal.dir}/" ${refusal.stands === 'link' ? 'is a link' : 'is not a directory'}, on the way to "${relative}"`;
}

/** The row of a refusal: at the file for its path or its place, at the directory for what stands on the way. */
export function treeRefusalIssue(relative: string, refusal: TreeRefusal): TreeIssue {
  if (refusal.kind === 'path') return treePathIssue(relative, refusal.part, 'not written');
  if (refusal.kind === 'place') return { path: relative, message: 'is not a file — not written' };
  return {
    path: `${refusal.dir}/`,
    message: refusal.stands === 'link' ? 'is a link — not written' : 'is not a directory — not written',
  };
}

export class TreeBoundary {
  private readonly rootDir: string;
  private readonly ways = new Map<string, Way>();

  /** `rootDir` is the bound folder, reached as its owner reaches it: nothing above it is asked. */
  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /** Whether a file of the tree may stand at `relative`, and where that is. */
  async locate(relative: string): Promise<TreePlaced> {
    const part = treePathRefusal(relative);
    if (part !== null) return { ok: false, refusal: { kind: 'path', part } };
    const way = await this.way(parentOf(relative));
    if (way !== 'directory' && way !== 'absent') return { ok: false, refusal: way };
    return { ok: true, place: { relative, file: this.absolute(relative) } };
  }

  /**
   * Write `content` beside `place`, making the directories it needs.
   * Refused where one of them turns out not to be a directory — nothing
   * is written then.
   */
  async stage(place: TreePlace, content: string): Promise<TreeStaged> {
    const refusal = await this.makeWay(place);
    if (refusal !== null) return { ok: false, refusal };
    const temp = `${place.file}.${randomBytes(8).toString('hex')}.tmp`;
    await fs.writeFile(temp, content, 'utf-8');
    return {
      ok: true,
      staged: {
        land: () => fs.rename(temp, place.file),
        discard: () => fs.rm(temp, { force: true }),
      },
    };
  }

  /**
   * Make the directories a file at `place` needs, each looked at where
   * it already stood. Answers the refusal where one of them turns out
   * not to be a directory, null when the way is made.
   */
  async makeWay(place: TreePlace): Promise<TreeRefusal | null> {
    const made = await this.make(parentOf(place.relative));
    return made === 'directory' ? null : made;
  }

  /**
   * Remove the file at `place` and the directories it leaves empty, as
   * git removes a file: up to the folder, never the folder. A directory
   * that still holds anything, whoever put it there, stands.
   */
  async remove(place: TreePlace): Promise<void> {
    await fs.rm(place.file, { force: true });
    for (let dir = parentOf(place.relative); dir !== ''; dir = parentOf(dir)) {
      try {
        await fs.rmdir(this.absolute(dir));
      } catch {
        return;
      }
      this.ways.set(dir, 'absent');
    }
  }

  private absolute(relative: string): string {
    return path.join(this.rootDir, ...relative.split('/'));
  }

  /** What stands at the directory `dir` and at each above it, asked of the disk once. */
  private async way(dir: string): Promise<Way> {
    if (dir === '') return 'directory';
    const known = this.ways.get(dir);
    if (known !== undefined) return known;
    const above = await this.way(parentOf(dir));
    const way = above === 'directory' ? await this.look(dir) : above;
    this.ways.set(dir, way);
    return way;
  }

  private async look(dir: string): Promise<Way> {
    let stat: Awaited<ReturnType<typeof fs.lstat>>;
    try {
      stat = await fs.lstat(this.absolute(dir));
    } catch (err) {
      if (isGone(failureCode(err))) return 'absent';
      throw err;
    }
    if (stat.isDirectory()) return 'directory';
    return { kind: 'way', dir, stands: stat.isSymbolicLink() ? 'link' : 'file' };
  }

  /** The directory `dir`, made where it is not there — each above it first. */
  private async make(dir: string): Promise<Exclude<Way, 'absent'>> {
    const way = await this.way(dir);
    if (way !== 'absent') return way;
    const above = await this.make(parentOf(dir));
    if (above !== 'directory') return above;
    let made: Exclude<Way, 'absent'> = 'directory';
    try {
      await fs.mkdir(this.absolute(dir));
    } catch (err) {
      if (failureCode(err) !== 'EEXIST') throw err;
      // It came to stand since the pass looked: it is looked at as any other.
      const stands = await this.look(dir);
      if (stands === 'absent') throw err;
      made = stands;
    }
    this.ways.set(dir, made);
    return made;
  }
}
