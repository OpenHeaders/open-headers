/**
 * PathsTreeModal — the Paths chip's Select in Tree…: the files of the
 * checked-out commit as a tree of checkboxes; OK filters the log by
 * what is checked (the reference's reading — a folder is ONE path, a
 * box is its row's own). It follows the log's Group By › Workspace:
 * listed by what the files belong to in the workbench, in the panels'
 * own rows and sections — a checked request, folder or collection
 * filters by its directory — or as the folders and files they are. A
 * row picked by what it belongs to hands its NAME on with its path, so
 * the chip, Recent and the tab read what the tree read. Centered on the
 * window. The tree is a child mounted only while the dialog is open: it
 * asks the host for the listing and reads the workspace.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { isWorkspaceFilePage, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { Checkbox, Modal, Spin, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { SectionHeader, SectionOpenerRow } from '../../../sidebar/SectionHeader';
import { isRowCaretClick, TreeNodeRow } from '../../../sidebar/TreeNodeRow';
import type { TreeNode } from '../../../sidebar/types';
import { FileTypeIcon, FolderTypeIcon } from '../commit/FileTypeIcon';
import { allDirKeys, buildFileTree, type FileTreeNode, visibleFileTreeRows } from '../file-tree';
import { namedFoldKeys, namedSectionKey, namedSections, visibleNamedSections } from '../named-file-tree';
import { useListedWorkspace } from '../use-listed-workspace';
import { useWorkspaceFileFace, workspaceFileEntityName } from '../workspace-file-face';
import { folderPath, namedRowPaths, pickedNames, withRowChecked } from './paths-tree';

export interface PathsTreeModalProps {
  workspaceId: string;
  open: boolean;
  /** Listed by what the files belong to in the workbench (the log's Group By › Workspace); off = folders and files. */
  named: boolean;
  /** The filter as it stands. */
  paths: readonly string[];
  /** The names the standing paths were picked under. */
  names: Readonly<Record<string, string>>;
  onClose: () => void;
  onApply: (paths: string[], names: Record<string, string>) => void;
}

/** By path: the name it was picked under, null for a path picked as itself. */
type Checked = ReadonlyMap<string, string | null>;

interface PickRowProps {
  rowKey: string;
  node: TreeNode;
  /** A page's row is drawn as its section's header. */
  pageTitle?: string;
  expanded: boolean;
  paths: readonly string[];
  name: string | null;
  checked: Checked;
  onCheck: (paths: readonly string[], name: string | null, on: boolean) => void;
  onFold: (key: string) => void;
}

const noop = (): void => {};

/** One row with its box: a click anywhere on it flips the box, the caret (or a double-click) folds. */
const PickRow: React.FC<PickRowProps> = ({ rowKey, node, pageTitle, expanded, paths, name, checked, onCheck, onFold }) => {
  const on = paths.length > 0 && paths.every((path) => checked.has(path));
  const box = (
    <Checkbox
      checked={on}
      onChange={(event) => onCheck(paths, name, event.target.checked)}
      data-testid="git-tool-paths-tree-check"
    />
  );
  return (
    <div
      title={paths.join('\n')}
      onClick={(event) => {
        if (node.expandable && isRowCaretClick(event)) onFold(rowKey);
        else onCheck(paths, name, !on);
      }}
      onDoubleClick={() => {
        if (node.expandable) onFold(rowKey);
      }}
      data-testid="git-tool-paths-tree-row"
      data-row-key={rowKey}
      data-checked={on}
    >
      {pageTitle !== undefined ? (
        <SectionOpenerRow title={pageTitle} node={node} selected={false} leading={box} />
      ) : (
        <TreeNodeRow
          node={node}
          isSelected={false}
          isFocused={false}
          isRenaming={false}
          isExpanded={expanded}
          leading={box}
          onClick={noop}
          onDoubleClick={noop}
          onStartRename={noop}
        />
      )}
    </div>
  );
};

interface TreeProps {
  paths: readonly string[];
  checked: Checked;
  onCheck: (paths: readonly string[], name: string | null, on: boolean) => void;
}

const inert = { canRename: false, canDelete: false, canAddChild: false };

function useFold(initial: () => string[]): [ReadonlySet<string>, (key: string) => void] {
  // Everything that holds others opens folded, as the reference's tree does.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set(initial()));
  const toggle = (key: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return [collapsed, toggle];
}

/** The folders and files as they are. */
const RawPathsTree: React.FC<TreeProps> = ({ paths, checked, onCheck }) => {
  // Every folder its own row: a folder merged into its only subfolder could not be checked.
  const nodes = useMemo(() => buildFileTree(paths.map((path) => ({ path, status: '' })), true, false), [paths]);
  const labels = useMemo(() => {
    const byKey = new Map<string, string>();
    const walk = (list: readonly FileTreeNode[]): void => {
      for (const node of list) {
        byKey.set(node.kind === 'dir' ? node.key : node.path, node.label);
        if (node.kind === 'dir') walk(node.children);
      }
    };
    walk(nodes);
    return byKey;
  }, [nodes]);
  const [collapsed, toggle] = useFold(() => allDirKeys(nodes));
  return (
    <>
      {visibleFileTreeRows(nodes, collapsed).map((row) => (
        <PickRow
          key={row.key}
          rowKey={row.key}
          node={{
            id: row.key,
            kind: row.kind === 'dir' ? 'folder' : 'leaf',
            label: labels.get(row.key) ?? row.key,
            depth: row.depth,
            expandable: row.kind === 'dir',
            icon: row.kind === 'dir' ? <FolderTypeIcon /> : <FileTypeIcon path={row.key} status="" />,
            ...inert,
          }}
          expanded={row.expanded === true}
          paths={[row.kind === 'dir' ? folderPath(row.key) : row.key]}
          name={null}
          checked={checked}
          onCheck={onCheck}
          onFold={toggle}
        />
      ))}
    </>
  );
};

/** The files by what they belong to in the workbench. */
const NamedPathsTree: React.FC<TreeProps> = ({ paths, checked, onCheck }) => {
  const t = useT();
  const workspace = useListedWorkspace();
  const face = useWorkspaceFileFace();
  const sections = useMemo(
    () => namedSections(workspaceFileTree(paths, workspace), true, false),
    [paths, workspace],
  );
  const [collapsed, toggle] = useFold(() => namedFoldKeys(sections).filter((key) => !key.startsWith('section:')));
  return (
    <>
      {visibleNamedSections(sections, collapsed).map((section) => {
        const page = isWorkspaceFilePage(section.id);
        const rows = section.rows.map((row) => {
          const label = face.labelOf(row.node);
          // What the chip reads for the pick: the entity's name, a part with its entity's; a file of the user's own
          // and its folders read as themselves.
          const name =
            row.node.type === 'entity'
              ? page
                ? face.sectionTitle(section.id)
                : label
              : row.node.type === 'part' && row.entity !== undefined
                ? `${workspaceFileEntityName(t, row.entity)} · ${label}`
                : null;
          return (
            <PickRow
              key={row.key}
              rowKey={row.key}
              node={{
                id: row.node.id,
                kind: row.kind === 'dir' ? 'folder' : 'leaf',
                label,
                depth: row.depth,
                expandable: row.kind === 'dir',
                icon: face.iconOf(section.id, row.node),
                ...inert,
              }}
              {...(page ? { pageTitle: face.sectionTitle(section.id) } : {})}
              expanded={row.expanded === true}
              paths={namedRowPaths(row.node)}
              name={name}
              checked={checked}
              onCheck={onCheck}
              onFold={toggle}
            />
          );
        });
        if (page) return <Fragment key={section.id}>{rows}</Fragment>;
        return (
          <Fragment key={section.id}>
            <SectionHeader
              title={face.sectionTitle(section.id)}
              expanded={section.expanded}
              onToggle={() => toggle(namedSectionKey(section.id))}
              testid={`git-tool-paths-tree-section-${section.id}`}
            />
            {rows}
          </Fragment>
        );
      })}
    </>
  );
};

interface PathsTreeProps extends Omit<TreeProps, 'paths'> {
  workspaceId: string;
  named: boolean;
}

const TREE_HEIGHT = 380;

/** The listing, asked of the host once per opening. */
const PathsTree: React.FC<PathsTreeProps> = ({ workspaceId, named, checked, onCheck }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [listing, setListing] = useState<{ paths: string[]; truncated: boolean } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    hostBridge
      .call('oh.workspaceTree.treeFiles', { workspaceId })
      .then((result) => {
        if (!live) return;
        if (result?.ok) setListing({ paths: result.paths, truncated: result.truncated });
        else setFailure(result?.reason ?? 'list-failed');
      })
      .catch((err: Error) => {
        if (live) setFailure(err.message);
      });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  const note: React.CSSProperties = { fontSize: 12, color: token.colorTextSecondary };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
      <div
        className="git-named-file-tree"
        style={{
          height: TREE_HEIGHT,
          overflowY: 'auto',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusSM,
        }}
        data-testid="git-tool-paths-tree"
        data-shape={named ? 'named' : 'paths'}
      >
        {failure !== null ? (
          <div style={{ ...note, padding: 12, color: token.colorError }} data-testid="git-tool-paths-tree-failed">
            {t('workbench.gitLog.loadFailed', { detail: failure })}
          </div>
        ) : listing === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spin size="small" />
          </div>
        ) : named ? (
          <NamedPathsTree paths={listing.paths} checked={checked} onCheck={onCheck} />
        ) : (
          <RawPathsTree paths={listing.paths} checked={checked} onCheck={onCheck} />
        )}
      </div>
      {listing?.truncated === true && (
        <span style={note} data-testid="git-tool-paths-tree-truncated">
          {t('workbench.gitLog.paths.treeTruncated')}
        </span>
      )}
    </div>
  );
};

const PathsTreeModal: React.FC<PathsTreeModalProps> = ({ workspaceId, open, named, paths, names, onClose, onApply }) => {
  const t = useT();
  const [checked, setChecked] = useState<Checked>(() => new Map());

  // Each opening starts from the filter as it stands.
  useEffect(() => {
    if (open) setChecked(new Map(paths.map((path) => [path, names[path] ?? null])));
  }, [open, paths, names]);

  return (
    <Modal
      open={open}
      title={t('workbench.gitLog.paths.treeTitle')}
      okText={t('workbench.gitLog.modal.ok')}
      cancelText={t('workbench.gitLog.modal.cancel')}
      okButtonProps={{ disabled: checked.size === 0, 'data-testid': 'git-tool-paths-tree-ok' }}
      onOk={() => {
        onApply([...checked.keys()], pickedNames(checked));
        onClose();
      }}
      onCancel={onClose}
      width={480}
      centered
      destroyOnHidden
    >
      {open && (
        <PathsTree
          workspaceId={workspaceId}
          named={named}
          checked={checked}
          onCheck={(rowPaths, name, on) => setChecked((prev) => withRowChecked(prev, rowPaths, name, on))}
        />
      )}
    </Modal>
  );
};

export default PathsTreeModal;
