/**
 * Tree plumbing for the passes that carry files between a commit and
 * the working tree without a checkout of the branch: the listing of a
 * commit's blobs, one blob read as text, the working tree written as a
 * tree object, a tree with given files laid over it — texts, or named
 * paths as the working tree holds them — and a paths checkout out of a
 * commit that never touches the user's real index.
 * Same discipline as
 * `branch-ops.ts`:
 * explicit repo addressing, the injected {@link GitRunner} seam, typed
 * failures with git's own stderr.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { failureCode, isGone } from './fs-failure';
import type { GitRunner } from './git-exec';
import { namedPaths, WHOLE_TREE_PATHSPECS } from './never-committed';
import {
  type BranchOpResult,
  failureDetail,
  localHeadSha,
  looksBinary,
  nulSeparatedPaths,
  readBlobSize,
  repoArgs,
} from './repo';
import { TreeBoundary } from './tree-boundary';

/** Paths per `checkout` invocation — keeps the arg vector under every platform's limit. */
const CHECKOUT_PATHS_PER_CALL = 100;

/**
 * Every blob of a commit's tree as `path → "<mode> <sha>"` (files and
 * symbolic links; a submodule entry is not a blob and is left out).
 * Two commits hold the same file at a path exactly when the values are
 * equal. Null when the ref is unknown.
 */
export async function listTreeEntries(
  run: GitRunner,
  rootDir: string,
  ref: string,
): Promise<Map<string, string> | null> {
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', ref], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const entries = new Map<string, string>();
  for (const record of listing.stdout.split('\0')) {
    const tab = record.indexOf('\t');
    if (tab === -1) continue;
    const [mode, type, sha] = record.slice(0, tab).split(' ');
    if (type !== 'blob') continue;
    entries.set(record.slice(tab + 1), `${mode} ${sha}`);
  }
  return entries;
}

/** The files one listing answers — a tree of any size gives a bounded list. */
export const HEAD_TREE_PATHS_MAX = 20_000;

/**
 * Every file the checked-out commit's tree holds, by path, in git's own
 * order — what a path picker lists. An unborn HEAD holds none.
 * `truncated` when the tree holds more than `max`. Null when the
 * listing fails.
 */
export async function listHeadTreePaths(
  run: GitRunner,
  rootDir: string,
  max = HEAD_TREE_PATHS_MAX,
): Promise<{ paths: string[]; truncated: boolean } | null> {
  if ((await localHeadSha(run, rootDir)) === null) return { paths: [], truncated: false };
  const listing = await run([...repoArgs(rootDir), 'ls-tree', '-r', '-z', '--name-only', 'HEAD'], { cwd: rootDir });
  if (listing.code !== 0) return null;
  const paths = listing.stdout.split('\0').filter((path) => path.length > 0);
  return { paths: paths.slice(0, max), truncated: paths.length > max };
}

/**
 * A file read for a person to compare: its text, `absent` when the side
 * has no such file, `opaque` when it is not text a person can answer in
 * an editor — a symbolic link, a binary, bytes that are not UTF-8, or
 * more than the cap.
 */
export type FileText = { kind: 'absent' } | { kind: 'text'; text: string } | { kind: 'opaque' };

const REGULAR_FILE_MODES: ReadonlySet<string> = new Set(['100644', '100755']);

/** Whether a {@link listTreeEntries} value is a regular file — not a symbolic link. */
export function isRegularFileEntry(entry: string): boolean {
  return REGULAR_FILE_MODES.has(entry.slice(0, entry.indexOf(' ')));
}

/** Decoded text a person can read: no NUL up front (git's own test) and no byte the decoder had to replace. */
export function asFileText(content: string): FileText {
  return looksBinary(content) || content.includes('\uFFFD') ? { kind: 'opaque' } : { kind: 'text', text: content };
}

/** One blob of a commit as text, from its {@link listTreeEntries} value (`undefined` — the commit has no such file). */
export async function readTreeEntryText(
  run: GitRunner,
  rootDir: string,
  entry: string | undefined,
  maxBytes: number,
): Promise<FileText> {
  if (entry === undefined) return { kind: 'absent' };
  if (!isRegularFileEntry(entry)) return { kind: 'opaque' };
  const sha = entry.slice(entry.indexOf(' ') + 1);
  const size = await readBlobSize(run, rootDir, sha);
  if (size === null || size > maxBytes) return { kind: 'opaque' };
  const blob = await run([...repoArgs(rootDir), 'cat-file', 'blob', sha], { cwd: rootDir });
  return blob.code === 0 ? asFileText(blob.stdout) : { kind: 'opaque' };
}

/**
 * The working tree as it stands, written as a tree object: HEAD's files
 * with every modification, deletion and untracked file over them
 * (`.gitignore` applies, and a secret or the sidecar is never in it
 * whatever an ignore file says — `never-committed.ts`).
 * Nothing is committed and the user's real index is never read or
 * written (§3.3). What it holds follows the ignore files as they stand
 * at the reading: two taken around a pass that lands one differ in more
 * than the pass wrote, so a pass reads once and lays its own writes over
 * that (`treeWithWorkingFiles`). Null when the tree cannot be read.
 */
export async function snapshotWorkingTree(run: GitRunner, rootDir: string): Promise<string | null> {
  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-snapshot-index-'));
  try {
    const env = { GIT_INDEX_FILE: path.join(indexDir, 'index') };
    const head = await run([...repoArgs(rootDir), 'rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: rootDir });
    const seed = await run([...repoArgs(rootDir), 'read-tree', ...(head.code === 0 ? ['HEAD'] : ['--empty'])], {
      cwd: rootDir,
      env,
    });
    if (seed.code !== 0) return null;
    const stage = await run([...repoArgs(rootDir), 'add', '-A', '--', ...WHOLE_TREE_PATHSPECS], { cwd: rootDir, env });
    if (stage.code !== 0) return null;
    const tree = await run([...repoArgs(rootDir), 'write-tree'], { cwd: rootDir, env });
    const sha = tree.stdout.trim();
    return tree.code === 0 && sha.length > 0 ? sha : null;
  } finally {
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * `tree` with `paths` as they stand in the working tree now laid over it —
 * a file or a link where one stands, no entry where none does — written
 * as a tree object. Every other path stays as `tree` holds it, whatever
 * the working tree or an ignore file has come to say of it.
 *
 * A path is laid as git sees it: a file that stands where `tree` holds
 * none and git ignores is no entry, as in `tree`. A path the folder's
 * boundary refuses is not looked at, and one that stands and will not be
 * looked at is not taken for gone: each stays as `tree` has it. A file no
 * commit holds (`never-committed.ts`) is never laid. The user's real
 * index is never read or written (§3.3). Null when the tree cannot be
 * read or written.
 */
export async function treeWithWorkingFiles(
  run: GitRunner,
  rootDir: string,
  tree: string,
  paths: readonly string[],
): Promise<string | null> {
  const named = namedPaths([...new Set(paths)]);
  if (named.length === 0) return tree;
  const boundary = new TreeBoundary(rootDir);
  const standing: string[] = [];
  const gone: string[] = [];
  for (const filePath of named) {
    const placed = await boundary.locate(filePath);
    if (!placed.ok) continue;
    try {
      const stat = await fs.lstat(placed.place.file);
      // A directory there holds no file at this path: its own files are laid at their own names.
      if (stat.isFile() || stat.isSymbolicLink()) standing.push(filePath);
      else gone.push(filePath);
    } catch (err) {
      if (isGone(failureCode(err))) gone.push(filePath);
    }
  }
  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-pass-index-'));
  try {
    const env = { GIT_INDEX_FILE: path.join(indexDir, 'index') };
    const seed = await run([...repoArgs(rootDir), 'read-tree', tree], { cwd: rootDir, env });
    if (seed.code !== 0) return null;
    // A file `tree` does not hold and git ignores is not seen: it is no entry, as in `tree`.
    const seen: string[] = [];
    for (let start = 0; start < standing.length; start += CHECKOUT_PATHS_PER_CALL) {
      const chunk = standing.slice(start, start + CHECKOUT_PATHS_PER_CALL);
      const asked = await run(
        [
          ...repoArgs(rootDir),
          '--literal-pathspecs',
          'ls-files',
          '-z',
          '--others',
          '--ignored',
          '--exclude-standard',
          '--',
          ...chunk,
        ],
        { cwd: rootDir, env },
      );
      if (asked.code !== 0) return null;
      const ignored = new Set(nulSeparatedPaths(asked.stdout));
      seen.push(...chunk.filter((filePath) => !ignored.has(filePath)));
    }
    // An add replaces what `tree` holds in its way: a link where a directory now stands, a directory where a link does.
    for (const [options, group] of [
      [['--force-remove'], gone],
      [['--add', '--replace'], seen],
    ] as const) {
      for (let start = 0; start < group.length; start += CHECKOUT_PATHS_PER_CALL) {
        const chunk = group.slice(start, start + CHECKOUT_PATHS_PER_CALL);
        const laid = await run([...repoArgs(rootDir), 'update-index', ...options, '--', ...chunk], {
          cwd: rootDir,
          env,
        });
        if (laid.code !== 0) return null;
      }
    }
    const written = await run([...repoArgs(rootDir), 'write-tree'], { cwd: rootDir, env });
    const sha = written.stdout.trim();
    return written.code === 0 && sha.length > 0 ? sha : null;
  } finally {
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** The mode a file the tree does not hold yet is written under. */
const NEW_FILE_MODE = '100644';

/**
 * `tree` with `files` laid over it — each path holding the given text,
 * or no file where the text is null — written as a tree object. A path
 * the tree already holds keeps its mode, and a file replaces what the
 * tree holds in its way: a link where its directory goes — the reading
 * of a folder holds one where a document could not be written.
 * Object plumbing on a throwaway
 * index: the working tree and the user's real index are never read or
 * written (§3.3), and nothing is committed. Null when the tree cannot be
 * read or written.
 */
export async function treeWithFiles(
  run: GitRunner,
  rootDir: string,
  tree: string,
  files: ReadonlyMap<string, string | null>,
): Promise<string | null> {
  if (files.size === 0) return tree;
  const held = await listTreeEntries(run, rootDir, tree);
  if (held === null) return null;
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-files-'));
  try {
    const env = { GIT_INDEX_FILE: path.join(scratch, 'index') };
    const seed = await run([...repoArgs(rootDir), 'read-tree', tree], { cwd: rootDir, env });
    if (seed.code !== 0) return null;
    const blobFile = path.join(scratch, 'blob');
    for (const [filePath, content] of files) {
      if (content === null) {
        const removed = await run([...repoArgs(rootDir), 'update-index', '--force-remove', '--', filePath], {
          cwd: rootDir,
          env,
        });
        if (removed.code !== 0) return null;
        continue;
      }
      await fs.writeFile(blobFile, content, 'utf-8');
      const blob = await run([...repoArgs(rootDir), 'hash-object', '-w', '--no-filters', '--', blobFile], {
        cwd: rootDir,
      });
      const sha = blob.stdout.trim();
      if (blob.code !== 0 || sha.length === 0) return null;
      const mode = held.get(filePath)?.split(' ')[0] ?? NEW_FILE_MODE;
      const staged = await run(
        [...repoArgs(rootDir), 'update-index', '--add', '--replace', '--cacheinfo', `${mode},${sha},${filePath}`],
        { cwd: rootDir, env },
      );
      if (staged.code !== 0) return null;
    }
    const written = await run([...repoArgs(rootDir), 'write-tree'], { cwd: rootDir, env });
    const sha = written.stdout.trim();
    return written.code === 0 && sha.length > 0 ? sha : null;
  } finally {
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Write `paths` as `sourceRef` holds them into the working tree —
 * bytes, the executable bit, symbolic links. The checkout rides a
 * throwaway index outside the work tree, so the user's real index is
 * never read or written (§3.3); the paths are literal, never patterns.
 * Every path must exist in `sourceRef`. The caller owns the decision
 * that the bytes on disk may be replaced.
 */
export async function checkoutPathsFromCommit(
  run: GitRunner,
  rootDir: string,
  sourceRef: string,
  paths: readonly string[],
): Promise<BranchOpResult> {
  if (paths.length === 0) return { ok: true };
  const indexDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-checkout-index-'));
  try {
    const env = { GIT_INDEX_FILE: path.join(indexDir, 'index') };
    for (let start = 0; start < paths.length; start += CHECKOUT_PATHS_PER_CALL) {
      const chunk = paths.slice(start, start + CHECKOUT_PATHS_PER_CALL);
      const result = await run([...repoArgs(rootDir), '--literal-pathspecs', 'checkout', sourceRef, '--', ...chunk], {
        cwd: rootDir,
        env,
      });
      if (result.code !== 0) return { ok: false, detail: failureDetail(result) };
    }
    return { ok: true };
  } finally {
    await fs.rm(indexDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
