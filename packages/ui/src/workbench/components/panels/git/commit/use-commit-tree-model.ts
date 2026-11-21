/**
 * useCommitTreeModel — the Commit tree's rows from its changes: the git
 * groups the tree lists, each group's shape (the flat run, the
 * directory tree, or its files by what they belong to in the
 * workbench), the fold state, and from them the ONE flat list the tree
 * draws (`commit-tree-rows`) with the lookups a row and a gesture read:
 * a change by its path, the files under a row by its key, a row's place
 * in the list.
 *
 * The Changes group is the reference default changelist — always
 * listed, even empty; Unversioned Files and Ignored Files only with
 * rows. Everything starts unfolded (the reference default). Fold keys
 * are `<group>` for a header, `<group>:__root__` for the content-root
 * node and `<group>:<dirKey>` for a directory — by what the files
 * belong to, a group's sections and its rows that hold others
 * (`commit-named-tree`).
 */

import type { WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useCallback, useMemo, useState } from 'react';
import { allDirKeys, buildFileTree, type FileTreeNode, fileTreePaths } from '../file-tree';
import { namedSections } from '../named-file-tree';
import type { ChangeGroupKey, ChangeGroups } from './commit-model';
import {
  type CommitNamedGroups,
  commitNamedFoldKeys,
  commitNamedPaths,
  commitNamedSections,
} from './commit-named-tree';
import type { CommitGroupFace } from './commit-row-scope';
import { type CommitVisibleRow, commitFileRowKey, rootCompressed } from './commit-tree-nav';
import {
  type CommitTreeGroup,
  type CommitTreeRow,
  commitNamedTreeRows,
  commitNavRows,
  commitPathTreeRows,
} from './commit-tree-rows';

export interface CommitTreeModelInput {
  groups: ChangeGroups;
  /** Each group's files as the workbench lists what they belong to; absent: the files are listed by path. */
  named?: CommitNamedGroups;
  groupByDirectory: boolean;
  showIgnored: boolean;
}

export interface CommitTreeModel {
  /** The git groups the tree lists, in its order. */
  groups: readonly CommitTreeGroup[];
  faces: ReadonlyMap<ChangeGroupKey, CommitGroupFace>;
  /** The files are listed by what they belong to. */
  named: boolean;
  allRows: readonly WorkspaceTreeWorkingChangeWire[];
  rowsByPath: ReadonlyMap<string, WorkspaceTreeWorkingChangeWire>;
  /** By row key, the files under each row of a group that carries checkboxes — a checkbox's set, and Space's. */
  pathsByRowKey: ReadonlyMap<string, readonly string[]>;
  /** The rows the tree draws, top to bottom. */
  rows: readonly CommitTreeRow[];
  /** A drawn row's place in `rows`, by its key. */
  indexByKey: ReadonlyMap<string, number>;
  /** The rows a selection can land on, in paint order. */
  navRows: readonly CommitVisibleRow[];
  toggleFold: (key: string) => void;
  setFolded: (key: string, folded: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

/** "1 file" / "{n} files" — the reference singular form at one. */
export function commitFilesCountText(t: Translate, count: number): string {
  return count === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count });
}

interface GroupSpec extends CommitTreeGroup {
  rows: WorkspaceTreeWorkingChangeWire[];
  label: string;
  checkable: boolean;
  /** The reference anatomy: Ignored Files counts read plain files ("6 files"), never "N directories and…". */
  countDirs: boolean;
}

export function useCommitTreeModel({
  groups,
  named,
  groupByDirectory,
  showIgnored,
}: CommitTreeModelInput): CommitTreeModel {
  const t = useT();

  const specs = useMemo<GroupSpec[]>(() => {
    const list: GroupSpec[] = [
      {
        key: 'changes',
        label: t('workbench.commitTool.groups.changes'),
        rows: groups.changes,
        checkable: true,
        countDirs: true,
      },
    ];
    if (groups.unversioned.length > 0) {
      list.push({
        key: 'unversioned',
        label: t('workbench.commitTool.groups.unversioned'),
        rows: groups.unversioned,
        checkable: true,
        countDirs: true,
      });
    }
    if (showIgnored && groups.ignored.length > 0) {
      list.push({
        key: 'ignored',
        label: t('workbench.commitTool.groups.ignored'),
        rows: groups.ignored,
        checkable: false,
        countDirs: false,
      });
    }
    return list;
  }, [groups, showIgnored, t]);

  // By what the files belong to: each group's sections, the user's own
  // files shaped by Group Files by Directory; null while listed by path.
  const namedByGroup = useMemo(
    () =>
      named === undefined
        ? null
        : new Map(specs.map((spec) => [spec.key, namedSections(named.get(spec.key) ?? [], groupByDirectory)])),
    [named, specs, groupByDirectory],
  );
  const trees = useMemo(
    () =>
      groupByDirectory && namedByGroup === null
        ? new Map(specs.map((spec) => [spec.key, buildFileTree(spec.rows, true)]))
        : new Map<ChangeGroupKey, FileTreeNode[]>(),
    [specs, groupByDirectory, namedByGroup],
  );
  const allRows = useMemo(() => specs.flatMap((spec) => spec.rows), [specs]);
  const rowsByPath = useMemo(() => new Map(allRows.map((row) => [row.path, row])), [allRows]);

  // The group's count — "1 directory and 6 files" on its header and its
  // content-root node where the tree draws directory rows; the flat run
  // and Ignored Files read the files alone.
  const faces = useMemo(() => {
    const directoriesCountText = (count: number): string =>
      count === 1 ? t('workbench.commitTool.oneDirectory') : t('workbench.commitTool.directoriesCount', { count });
    return new Map(
      specs.map((spec): [ChangeGroupKey, CommitGroupFace] => {
        const dirs = spec.countDirs ? allDirKeys(trees.get(spec.key) ?? []).length : 0;
        const files = commitFilesCountText(t, spec.rows.length);
        const countText =
          dirs === 0 ? files : t('workbench.commitTool.dirsAndFiles', { dirs: directoriesCountText(dirs), files });
        return [spec.key, { label: spec.label, checkable: spec.checkable, countText }];
      }),
    );
  }, [specs, trees, t]);

  const pathsByRowKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const spec of specs) {
      if (!spec.checkable) continue;
      const groupPaths = spec.rows.map((row) => row.path);
      map.set(spec.key, groupPaths);
      map.set(`${spec.key}:__root__`, groupPaths);
      const walk = (nodes: readonly FileTreeNode[]): void => {
        for (const node of nodes) {
          if (node.kind !== 'dir') continue;
          map.set(`${spec.key}:${node.key}`, fileTreePaths(node));
          walk(node.children);
        }
      };
      walk(trees.get(spec.key) ?? []);
      for (const [key, paths] of commitNamedPaths(spec.key, namedByGroup?.get(spec.key) ?? [])) map.set(key, paths);
      for (const row of spec.rows) map.set(commitFileRowKey(row.path), [row.path]);
    }
    return map;
  }, [specs, trees, namedByGroup]);

  const foldKeys = useMemo(() => {
    const keys: string[] = [];
    for (const spec of specs) {
      keys.push(spec.key);
      const sections = namedByGroup?.get(spec.key);
      if (sections !== undefined) {
        keys.push(...commitNamedFoldKeys(spec.key, sections));
        continue;
      }
      if (!rootCompressed(trees.get(spec.key) ?? [])) keys.push(`${spec.key}:__root__`);
      for (const dirKey of allDirKeys(trees.get(spec.key) ?? [])) keys.push(`${spec.key}:${dirKey}`);
    }
    return keys;
  }, [specs, trees, namedByGroup]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggleFold = useCallback(
    (key: string): void =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    [],
  );
  const setFolded = useCallback(
    (key: string, folded: boolean): void =>
      setCollapsed((prev) => {
        if (prev.has(key) === folded) return prev;
        const next = new Set(prev);
        if (folded) next.add(key);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const expandAll = useCallback((): void => setCollapsed(new Set()), []);
  const collapseAll = useCallback((): void => setCollapsed(new Set(foldKeys)), [foldKeys]);

  const rows = useMemo(() => {
    if (namedByGroup === null) return commitPathTreeRows(specs, trees, collapsed, groupByDirectory);
    const shown = new Map(
      specs.map((spec) => [spec.key, commitNamedSections(spec.key, namedByGroup.get(spec.key) ?? [], collapsed)]),
    );
    return commitNamedTreeRows(specs, shown, collapsed);
  }, [specs, trees, namedByGroup, collapsed, groupByDirectory]);
  const indexByKey = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
  const navRows = useMemo(() => commitNavRows(rows), [rows]);

  return {
    groups: specs,
    faces,
    named: namedByGroup !== null,
    allRows,
    rowsByPath,
    pathsByRowKey,
    rows,
    indexByKey,
    navRows,
    toggleFold,
    setFolded,
    expandAll,
    collapseAll,
  };
}
