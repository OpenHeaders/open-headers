/**
 * Changed-files tree for the Git tool window's commit detail — the
 * log-window grouping: paths fold into a directory tree, chains of
 * single-child directories compress into one node
 * (`packages/ui/src · 4 files`), files sort after nothing (dirs first,
 * then files, each alphabetically). Pure path shaping; no filesystem.
 */

export interface FileTreeDir {
  kind: 'dir';
  /** Compressed display path segment (may span several dirs — `a/b/c`). */
  label: string;
  /** Stable key: the full path prefix from the root. */
  key: string;
  /** Total files beneath (the `N files` badge). */
  fileCount: number;
  children: FileTreeNode[];
}

export interface FileTreeFile {
  kind: 'file';
  /** Basename shown in the tree. */
  label: string;
  /** Full repo-relative path — the diff verb's argument. */
  path: string;
  /** Porcelain status letter (`A`/`M`/`D`/`R`/`C`/`T`). */
  status: string;
}

export type FileTreeNode = FileTreeDir | FileTreeFile;

interface BuildDir {
  dirs: Map<string, BuildDir>;
  files: Array<{ name: string; path: string; status: string }>;
}

function newBuildDir(): BuildDir {
  return { dirs: new Map(), files: [] };
}

function countFiles(dir: BuildDir): number {
  let count = dir.files.length;
  for (const child of dir.dirs.values()) count += countFiles(child);
  return count;
}

function emit(dir: BuildDir, prefix: string): FileTreeNode[] {
  const nodes: FileTreeNode[] = [];
  for (const [name, child] of [...dir.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // Compress single-child pure-directory chains into one label.
    let label = name;
    let key = prefix === '' ? name : `${prefix}/${name}`;
    let cursor = child;
    while (cursor.files.length === 0 && cursor.dirs.size === 1) {
      const [nextName, nextDir] = [...cursor.dirs.entries()][0];
      label = `${label}/${nextName}`;
      key = `${key}/${nextName}`;
      cursor = nextDir;
    }
    nodes.push({
      kind: 'dir',
      label,
      key,
      fileCount: countFiles(cursor),
      children: emit(cursor, key),
    });
  }
  for (const file of [...dir.files].sort((a, b) => a.name.localeCompare(b.name))) {
    nodes.push({ kind: 'file', label: file.name, path: file.path, status: file.status });
  }
  return nodes;
}

/**
 * Fold one commit's changed paths into the compressed display tree.
 * With `groupByDirectory` off (the details eye toggle) the answer is a
 * flat sorted list — every file a leaf labeled by its full path.
 */
export function buildFileTree(
  files: ReadonlyArray<{ path: string; status: string }>,
  groupByDirectory = true,
): FileTreeNode[] {
  if (!groupByDirectory) {
    return [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => ({ kind: 'file', label: file.path, path: file.path, status: file.status }));
  }
  const root = newBuildDir();
  for (const file of files) {
    const segments = file.path.split('/').filter((segment) => segment.length > 0);
    if (segments.length === 0) continue;
    let dir = root;
    for (const segment of segments.slice(0, -1)) {
      let child = dir.dirs.get(segment);
      if (child === undefined) {
        child = newBuildDir();
        dir.dirs.set(segment, child);
      }
      dir = child;
    }
    dir.files.push({ name: segments[segments.length - 1], path: file.path, status: file.status });
  }
  return emit(root, '');
}

/** Every dir key in the tree — the expand-all feed. */
export function allDirKeys(nodes: readonly FileTreeNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'dir') continue;
    keys.push(node.key);
    keys.push(...allDirKeys(node.children));
  }
  return keys;
}

/** One visible row of the tree in render order — the selection model's order and the keyboard's walk. */
export interface FileTreeRow {
  /** The dir's key or the file's path — the selection id. */
  key: string;
  kind: 'dir' | 'file';
  depth: number;
  /** The enclosing dir's key; null at the root. */
  parentKey: string | null;
  /** A dir's open state; absent on a file. */
  expanded?: boolean;
}

/** The rows the tree paints, top to bottom, with every collapsed dir's subtree left out. */
export function visibleFileTreeRows(nodes: readonly FileTreeNode[], collapsed: ReadonlySet<string>): FileTreeRow[] {
  const rows: FileTreeRow[] = [];
  const walk = (list: readonly FileTreeNode[], depth: number, parentKey: string | null): void => {
    for (const node of list) {
      if (node.kind === 'file') {
        rows.push({ key: node.path, kind: 'file', depth, parentKey });
        continue;
      }
      const expanded = !collapsed.has(node.key);
      rows.push({ key: node.key, kind: 'dir', depth, parentKey, expanded });
      if (expanded) walk(node.children, depth + 1, node.key);
    }
  };
  walk(nodes, 0, null);
  return rows;
}

/**
 * The selected rows as a single-row verb picks its target from them:
 * `preferred` (the row the gesture landed on) first while it is one of
 * them, the rest in row order.
 */
export function selectedRowsLeadFirst<Row extends FileTreeRow>(
  rows: readonly Row[],
  selected: ReadonlySet<string>,
  preferred: string | null,
): Row[] {
  const picked = rows.filter((row) => selected.has(row.key));
  const lead = picked.findIndex((row) => row.key === preferred);
  return lead <= 0 ? picked : [picked[lead], ...picked.slice(0, lead), ...picked.slice(lead + 1)];
}

/**
 * The file the single-row verbs act on after a gesture: `preferred`
 * when it is a selected file, else the first selected file in row
 * order, else none (a dir-only selection has no diff target).
 */
export function leadFilePath(
  rows: readonly FileTreeRow[],
  selected: ReadonlySet<string>,
  preferred: string | null,
): string | null {
  return selectedRowsLeadFirst(rows, selected, preferred).find((row) => row.kind === 'file')?.key ?? null;
}
