/**
 * named-file-tree — a changed-files tree's rows when the files are
 * listed by what they belong to in the workbench
 * (`workspace-file-tree`): the visible rows of each section for a fold
 * state, in paint order, on the same row shape the path tree walks
 * (`file-tree`), so one selection and one keyboard serve both. A row
 * that stands for one file is keyed by that file's path; a row that
 * holds others by its node's id. Sections fold but are no rows — but
 * for the workspace's variables, one page its panel opens from a
 * header-styled row: that section is its row, and does not fold. Pure.
 */

import type {
  WorkspaceFileEntity,
  WorkspaceFileNode,
  WorkspaceFileSection,
  WorkspaceFileSectionId,
} from '@openheaders/ui/shared/workspace-files';
import { buildFileTree, type FileTreeNode, type FileTreeRow } from './file-tree';

export interface NamedFileRow extends FileTreeRow {
  section: WorkspaceFileSectionId;
  node: WorkspaceFileNode;
  /** The entity the row is, or is a part of; absent on a file of the user's own and its directories. */
  entity?: WorkspaceFileEntity;
}

export interface NamedFileSection {
  id: WorkspaceFileSectionId;
  /** The section's fold key. */
  key: string;
  expanded: boolean;
  rows: NamedFileRow[];
}

export const namedSectionKey = (id: WorkspaceFileSectionId): string => `section:${id}`;

/** A section its panel shows as one header-styled row that opens a page. */
export const isOpenerSection = (id: WorkspaceFileSectionId): boolean => id === 'workspace-variables';

/** The file a row stands for; none on a row that holds others. */
export function namedRowFile(node: WorkspaceFileNode): string | undefined {
  return node.type === 'directory' ? undefined : node.file;
}

function childrenOf(node: WorkspaceFileNode): readonly WorkspaceFileNode[] {
  return node.type === 'entity' || node.type === 'directory' ? node.children : [];
}

/** Every file at or under the rows. */
function filesUnder(nodes: readonly WorkspaceFileNode[]): string[] {
  return nodes.flatMap((node) => {
    const file = namedRowFile(node);
    return file !== undefined ? [file] : filesUnder(childrenOf(node));
  });
}

/** The path tree's rows (`file-tree`) as rows of the user's own files. */
function ownFileNodes(nodes: readonly FileTreeNode[]): WorkspaceFileNode[] {
  return nodes.map((node) =>
    node.kind === 'dir'
      ? { type: 'directory', id: `dir:${node.key}`, path: node.label, children: ownFileNodes(node.children) }
      : { type: 'file', id: node.path, name: node.label, file: node.path },
  );
}

/**
 * The sections as this tree lists them: the user's own files shaped as
 * the path tree shapes any — nested by directory with single-child
 * chains folded, or one flat run by full path without Group By Directory.
 */
export function namedSections(
  sections: readonly WorkspaceFileSection[],
  groupByDirectory: boolean,
): readonly WorkspaceFileSection[] {
  return sections.map((section) => {
    if (section.id !== 'files') return section;
    const files = filesUnder(section.nodes).map((path) => ({ path, status: '' }));
    return { ...section, nodes: ownFileNodes(buildFileTree(files, groupByDirectory)) };
  });
}

/** Every key a fold acts on — the sections and the rows that hold others. */
export function namedFoldKeys(sections: readonly WorkspaceFileSection[]): string[] {
  const keys: string[] = [];
  const walk = (nodes: readonly WorkspaceFileNode[]): void => {
    for (const node of nodes) {
      if (childrenOf(node).length === 0) continue;
      keys.push(node.id);
      walk(childrenOf(node));
    }
  };
  for (const section of sections) {
    if (!isOpenerSection(section.id)) keys.push(namedSectionKey(section.id));
    walk(section.nodes);
  }
  return keys;
}

export function visibleNamedSections(
  sections: readonly WorkspaceFileSection[],
  collapsed: ReadonlySet<string>,
): NamedFileSection[] {
  return sections.map((section) => {
    const key = namedSectionKey(section.id);
    const expanded = isOpenerSection(section.id) || !collapsed.has(key);
    const rows: NamedFileRow[] = [];
    const walk = (
      nodes: readonly WorkspaceFileNode[],
      depth: number,
      parentKey: string | null,
      owner: WorkspaceFileEntity | undefined,
    ): void => {
      for (const node of nodes) {
        const entity = node.type === 'entity' ? node.entity : node.type === 'part' ? owner : undefined;
        const named = { section: section.id, node, ...(entity !== undefined ? { entity } : {}) };
        const held = childrenOf(node);
        if (held.length === 0) {
          const file = namedRowFile(node);
          if (file !== undefined) rows.push({ key: file, kind: 'file', depth, parentKey, ...named });
          continue;
        }
        const open = !collapsed.has(node.id);
        rows.push({ key: node.id, kind: 'dir', depth, parentKey, expanded: open, ...named });
        if (open) walk(held, depth + 1, node.id, entity);
      }
    };
    if (expanded) walk(section.nodes, 0, null, undefined);
    return { id: section.id, key, expanded, rows };
  });
}

/**
 * The change a row reads as: a file's own; an entity that lists
 * several, added or deleted when every one of its own files is and
 * modified otherwise; none on a row that only holds others.
 */
export function namedRowStatus(
  node: WorkspaceFileNode,
  statusOf: (path: string) => string | undefined,
): string | undefined {
  const file = namedRowFile(node);
  if (file !== undefined) return statusOf(file);
  if (node.type !== 'entity') return undefined;
  const own = node.children.flatMap((child) => (child.type === 'part' ? [statusOf(child.file)] : []));
  if (own.length === 0) return undefined;
  if (own.every((status) => status === 'A')) return 'A';
  if (own.every((status) => status === 'D')) return 'D';
  return 'M';
}
