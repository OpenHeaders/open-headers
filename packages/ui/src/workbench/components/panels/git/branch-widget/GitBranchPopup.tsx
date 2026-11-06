/**
 * GitBranchPopup — the branch widget's popup: the "Search for
 * branches and actions" box
 * with Fetch and the view-options gear beside it, the action rows
 * (Update Project…, Commit…, Push…, New Branch…), then the sections —
 * Recent, Local, Remote, Tags — as collapsible tree rows (folders on
 * `/`, the rail's anatomy: a caret slot on every row, ★ in the icon
 * slot on the current branch and favorites, the branch / tag glyph
 * otherwise). The current row carries its incoming count and the
 * tracked upstream dimmed; every leaf ends in a › that opens the row's
 * action menu — clicking the row does the same (the reference gesture).
 * Verbs ride the shared `useGitBranchActions` the caller supplies and
 * close the popup first.
 */

import {
  CaretDownOutlined,
  CaretRightOutlined,
  FolderOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { WorkspaceTreeGitStatusWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Divider, Dropdown, Input, type MenuProps, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { BranchIcon, FetchIcon, PullIcon, PushIcon, TagIcon } from '@openheaders/ui/shared/icons';
import { menuCheckIcon } from '../../../shared/menu-check';
import type { GitBranchActions } from '../branch-actions/use-git-branch-actions';
import { CommitToolIcon } from '../commit/CommitToolIcon';
import { getGitRailPrefs, gitRailFavoriteKey, subscribeGitRailPrefs } from '../rail/git-rail-prefs';
import { buildRefRowMenu, type RefRowMenuHandlers, type RefTreeSelection } from '../rail/ref-row-menu';
import { allFolderKeys, type RefTreeNode } from '../rail/ref-tree-model';
import { actionMatches, type BranchPopupSectionKind, buildBranchPopupSections } from './branch-widget-model';
import { getBranchWidgetPrefs, patchBranchWidgetPrefs, subscribeBranchWidgetPrefs } from './branch-widget-prefs';

export interface GitBranchPopupProps {
  workspaceId: string;
  status: WorkspaceTreeGitStatusWire;
  refs: readonly WorkspaceTreeRefWire[];
  /** The checked-out branch per `listRefs`; null when detached or unborn. */
  currentRef: string | null;
  actions: GitBranchActions;
  /** Open a Compare-with-Current tab in the Git window. */
  onOpenCompare: (ref: string) => void;
  /** Reveal the Commit tool window. */
  onOpenCommit: () => void;
  onClose: () => void;
}

const SECTION_LABEL_KEY = {
  recent: 'workbench.gitBranch.group.recent',
  local: 'workbench.gitLog.refs.local',
  remote: 'workbench.gitLog.refs.remote',
  tag: 'workbench.gitLog.refs.tags',
} as const;

const INDENT = 14;
const CARET_SLOT = 12;

const GitBranchPopup: React.FC<GitBranchPopupProps> = ({
  workspaceId,
  status,
  refs,
  currentRef,
  actions,
  onOpenCompare,
  onOpenCommit,
  onClose,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [search, setSearch] = useState('');
  // Expansion overrides per section / folder key; a key the user never
  // touched follows its default.
  const [expansion, setExpansion] = useState<ReadonlyMap<string, boolean>>(new Map());

  const subscribePrefs = useCallback(
    (listener: () => void) => subscribeBranchWidgetPrefs(workspaceId, listener),
    [workspaceId],
  );
  const prefs = useSyncExternalStore(subscribePrefs, () => getBranchWidgetPrefs(workspaceId));
  const subscribeRail = useCallback((listener: () => void) => subscribeGitRailPrefs(workspaceId, listener), [workspaceId]);
  const railPrefs = useSyncExternalStore(subscribeRail, () => getGitRailPrefs(workspaceId));
  const favorites = useMemo<ReadonlySet<string>>(() => new Set(railPrefs.favorites), [railPrefs.favorites]);

  // The branch gitStatus reports but listRefs doesn't: an unborn HEAD
  // (fresh repo, first commit pending) — shown as the current Local leaf.
  const unbornBranch =
    status.branch !== null && !refs.some((ref) => ref.kind === 'local' && ref.name === status.branch)
      ? status.branch
      : null;
  const current = currentRef ?? unbornBranch;

  const sections = useMemo(
    () =>
      buildBranchPopupSections({
        refs,
        unbornBranch,
        recent: prefs.recent,
        showTags: prefs.showTags,
        groupByDirectory: prefs.groupByDirectory,
        search,
      }),
    [refs, unbornBranch, prefs.recent, prefs.showTags, prefs.groupByDirectory, search],
  );
  const searching = search.trim() !== '';
  const hasRecent = sections.some((section) => section.kind === 'recent');

  // Default expansion (the reference popup): Recent open, Local open only
  // without a Recent section, Remote and Tags collapsed; folders
  // collapsed; a search renders everything open.
  const isOpen = (key: string, defaultOpen: boolean): boolean =>
    searching ? true : (expansion.get(key) ?? defaultOpen);
  const toggle = (key: string, defaultOpen: boolean): void => {
    const open = isOpen(key, defaultOpen);
    setExpansion((prev) => new Map(prev).set(key, !open));
  };
  const sectionDefaultOpen = (kind: BranchPopupSectionKind): boolean =>
    kind === 'recent' || (kind === 'local' && !hasRecent);

  const closeThen =
    <A extends unknown[]>(verb: (...args: A) => void) =>
    (...args: A): void => {
      onClose();
      verb(...args);
    };

  const menuHandlers: RefRowMenuHandlers = {
    onCheckout: closeThen(actions.checkout),
    onCheckoutRemote: closeThen(actions.checkoutRemote),
    onNewBranchFrom: closeThen(actions.newBranchFrom),
    onCompareWithCurrent: closeThen(onOpenCompare),
    onMergeIntoCurrent: closeThen(actions.mergeIntoCurrent),
    onUpdate: closeThen(actions.updateBranch),
    onPullCurrent: closeThen(actions.pull),
    onPushCurrent: closeThen(actions.push),
    onDelete: closeThen(actions.deleteBranch),
  };
  const rowMenu = (row: RefTreeSelection): MenuProps =>
    buildRefRowMenu(row, { current, historyRewritten: status.forcePush !== null }, t, menuHandlers);

  const actionRows: Array<{ key: string; icon: React.ReactNode; label: string; hint: string; onClick: () => void }> = [
    {
      key: 'update',
      icon: <PullIcon />,
      label: t('workbench.gitBranch.action.updateWorkspace'),
      hint: '⌘T',
      onClick: closeThen(actions.pull),
    },
    {
      key: 'commit',
      icon: <CommitToolIcon />,
      label: t('workbench.gitBranch.action.commit'),
      hint: '⌘K',
      onClick: closeThen(onOpenCommit),
    },
    {
      key: 'push',
      icon: <PushIcon />,
      label: t('workbench.gitBranch.action.push'),
      hint: '⇧⌘K',
      onClick: closeThen(actions.push),
    },
    {
      key: 'new-branch',
      icon: <PlusOutlined />,
      label: t('workbench.gitBranch.action.newBranch'),
      hint: '⌥⌘N',
      onClick: closeThen(() => actions.newBranchFrom(null)),
    },
  ].filter((row) => actionMatches(row.label, search));

  const rowStyle = (depth: number): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: `5px 8px 5px ${8 + depth * INDENT}px`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    lineHeight: '18px',
    color: token.colorText,
    boxSizing: 'border-box',
  });

  const caretSlot = (open: boolean | null): React.ReactNode => (
    <span
      aria-hidden
      style={{
        flex: 'none',
        width: CARET_SLOT,
        display: 'inline-flex',
        justifyContent: 'center',
        fontSize: 9,
        color: token.colorTextTertiary,
      }}
    >
      {open === null ? null : open ? <CaretDownOutlined /> : <CaretRightOutlined />}
    </span>
  );

  const labelStyle: React.CSSProperties = {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const leafIcon = (kind: WorkspaceTreeRefWire['kind'], starred: boolean): React.ReactNode => {
    if (starred) {
      return (
        <span aria-hidden data-testid="git-branch-popup-star" style={{ flex: '0 0 auto', color: token.colorWarningText }}>
          ★
        </span>
      );
    }
    const Glyph = kind === 'tag' ? TagIcon : BranchIcon;
    return <Glyph style={{ flex: '0 0 auto', fontSize: 12, color: token.colorTextTertiary }} />;
  };

  const renderLeaf = (node: RefTreeNode & { kind: 'leaf' }, depth: number): React.ReactNode => {
    const isCurrent = node.refKind === 'local' && node.name === current;
    const isFavorite = favorites.has(gitRailFavoriteKey(node.refKind, node.name));
    const incoming = isCurrent ? (status.behind ?? 0) : 0;
    return (
      <Dropdown
        key={`${node.refKind}:${node.name}`}
        menu={rowMenu({ name: node.name, kind: node.refKind })}
        // Click only: a contextMenu trigger aligns the menu to the
        // pointer, and the reference opens a row's actions BESIDE the popup —
        // the menu's top-left on the row's top-right edge, never over
        // the list.
        trigger={['click']}
        placement="bottomRight"
        align={{ points: ['tl', 'tr'], offset: [6, 0] }}
        classNames={{ root: 'commit-tool-row-menu' }}
      >
        <div
          role="menuitem"
          className="oh-env-row"
          style={{ ...rowStyle(depth), fontWeight: isCurrent ? 600 : 400 }}
          title={node.name}
          data-testid="git-branch-popup-row"
          data-ref={node.name}
          data-kind={node.refKind}
        >
          {caretSlot(null)}
          {leafIcon(node.refKind, isCurrent || isFavorite)}
          <span style={labelStyle}>{node.label}</span>
          {incoming > 0 && (
            <Tooltip title={t('workbench.gitBranch.widget.behind', { count: incoming })} placement="top">
              <span
                style={{ flex: '0 0 auto', fontSize: 12, color: token.colorPrimary }}
                data-testid="git-branch-popup-incoming"
              >
                ↙ {incoming}
              </span>
            </Tooltip>
          )}
          {isCurrent && status.upstream !== null && (
            <span
              style={{
                flex: '0 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 12,
                color: token.colorTextTertiary,
                marginLeft: 8,
              }}
              data-testid="git-branch-popup-upstream"
            >
              {status.upstream}
            </span>
          )}
          <RightOutlined style={{ flex: '0 0 auto', fontSize: 9, color: token.colorTextTertiary }} />
        </div>
      </Dropdown>
    );
  };

  const renderNodes = (nodes: readonly RefTreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'folder') {
        const open = isOpen(node.key, false);
        return (
          <div key={node.key}>
            <div
              role="button"
              className="oh-env-row"
              style={rowStyle(depth)}
              onClick={() => toggle(node.key, false)}
              data-testid="git-branch-popup-folder"
              data-key={node.key}
            >
              {caretSlot(open)}
              <FolderOutlined style={{ flex: '0 0 auto', fontSize: 12, color: token.colorTextTertiary }} />
              <span style={labelStyle}>{node.label}</span>
            </div>
            {open && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      return renderLeaf(node, depth);
    });

  const nothing = actionRows.length === 0 && sections.length === 0;

  return (
    <div
      style={{
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '6px 4px',
        width: 380,
        maxHeight: 'min(70vh, 640px)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      data-testid="git-branch-popup"
    >
      <div style={{ padding: '0 4px 6px', display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
        <Input
          size="small"
          allowClear
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('workbench.gitBranch.popup.search')}
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          style={{ fontSize: 12, flex: 1 }}
          data-testid="git-branch-popup-search"
        />
        <Tooltip title={t('workbench.gitLog.rail.fetch')} placement="bottom">
          <button
            type="button"
            aria-label={t('workbench.gitLog.rail.fetch')}
            disabled={actions.busy.fetch}
            onClick={actions.fetch}
            className="git-branch-popup-tool"
            data-testid="git-branch-popup-fetch"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: 'none',
              background: 'transparent',
              borderRadius: token.borderRadiusSM,
              cursor: actions.busy.fetch ? 'default' : 'pointer',
              color: token.colorTextSecondary,
              fontSize: 13,
            }}
          >
            <FetchIcon />
          </button>
        </Tooltip>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            selectable: false,
            items: [
              { key: 'show-tags', label: t('workbench.gitLog.rail.showTags'), icon: menuCheckIcon(prefs.showTags) },
              {
                key: 'group-dirs',
                label: t('workbench.gitLog.rail.groupByDirectory'),
                icon: menuCheckIcon(prefs.groupByDirectory),
              },
              { type: 'divider' },
              {
                key: 'manage-remotes',
                label: (
                  <span data-testid="git-branch-popup-manage-remotes">{t('workbench.commitTool.menu.manageRemotes')}</span>
                ),
              },
            ],
            onClick: ({ key }) => {
              if (key === 'show-tags') patchBranchWidgetPrefs(workspaceId, { showTags: !prefs.showTags });
              else if (key === 'group-dirs') {
                patchBranchWidgetPrefs(workspaceId, { groupByDirectory: !prefs.groupByDirectory });
              } else if (key === 'manage-remotes') {
                // The dialog is the hook's; the popup steps aside so it is not underneath.
                onClose();
                actions.manageRemotes();
              }
            },
          }}
        >
          <button
            type="button"
            aria-label={t('workbench.gitBranch.popup.settings')}
            className="git-branch-popup-tool"
            data-testid="git-branch-popup-settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: 'none',
              background: 'transparent',
              borderRadius: token.borderRadiusSM,
              cursor: 'pointer',
              color: token.colorTextSecondary,
              fontSize: 13,
            }}
          >
            <SettingOutlined />
          </button>
        </Dropdown>
      </div>
      <div className="rules-thin-scrollbar" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        {actionRows.map((row, index) => (
          <div key={row.key}>
            {index === 3 && <Divider style={{ margin: '4px 0' }} />}
            <div
              role="menuitem"
              className="oh-env-row"
              style={rowStyle(0)}
              onClick={row.onClick}
              data-testid={`git-branch-popup-action-${row.key}`}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  width: 16,
                  display: 'inline-flex',
                  justifyContent: 'center',
                  color: token.colorTextSecondary,
                }}
              >
                {row.icon}
              </span>
              <span style={labelStyle}>{row.label}</span>
              <span style={{ flex: '0 0 auto', fontSize: 12, color: token.colorTextTertiary }}>{row.hint}</span>
            </div>
          </div>
        ))}
        {actionRows.length > 0 && sections.length > 0 && <Divider style={{ margin: '4px 0' }} />}
        {sections.map((section) => {
          const key = `section:${section.kind}`;
          const open = isOpen(key, sectionDefaultOpen(section.kind));
          return (
            <div key={section.kind} data-testid="git-branch-popup-section" data-kind={section.kind}>
              <div
                role="button"
                className="oh-env-row"
                style={rowStyle(0)}
                onClick={() => toggle(key, sectionDefaultOpen(section.kind))}
                data-testid="git-branch-popup-section-header"
              >
                {caretSlot(open)}
                <span style={labelStyle}>{t(SECTION_LABEL_KEY[section.kind])}</span>
              </div>
              {open && renderNodes(section.nodes, 1)}
            </div>
          );
        })}
        {nothing && (
          <div
            style={{ padding: '10px 12px', fontSize: 12, color: token.colorTextSecondary }}
            data-testid="git-branch-popup-empty"
          >
            {searching ? t('workbench.gitBranch.popup.noMatches') : t('workbench.gitLog.refs.empty')}
          </div>
        )}
      </div>
    </div>
  );
};

export default GitBranchPopup;
