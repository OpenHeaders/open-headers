/**
 * GitLogToolbar — the log pane's top band, the filter row: the
 * text-or-hash field (applied on Enter — `GitLogTextField`), the Branch / User /
 * Date / Paths filter chips (User and Paths hold LISTS — `ValuesFilterChip`), Graph Options (sort + walk riders + the
 * Collapse / Expand Linear Branches gestures over the graph's
 * fragments), then the right-aligned action icons — Refresh, Cherry-Pick,
 * View Options, Go To Hash/Branch/Tag. Filter state lives in the tab
 * registry (travels with the tab); display prefs are per-workspace.
 * The band is a PaneToolbar led by the text field: the field keeps its
 * width at every pane size and everything after it that does not fit —
 * the far end first — folds behind the › chevron's hover strip (the
 * reference's reading).
 */

import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Dropdown, Input, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { RefreshIcon } from '@openheaders/ui/shared/icons';
import type { GitLogRecentFilters } from '../git-log-recent-filters';
import type { GitLogViewPrefs } from '../git-log-view-prefs';
import type { GitLogTabState } from '../git-panel-view-store';
import { type GitLogScope, scopeChipText, scopeHoverText, scopeMenuText } from '../log-scope';
import BranchFilterChip from './BranchFilterChip';
import DateFilterModal from './DateFilterModal';
import GitFilterChip from './GitFilterChip';
import GitLogTextField from './GitLogTextField';
import { CherryPickIcon, GraphOptionsIcon } from './icons';
import { menuCheckIcon, menuIconGutter } from '../../../shared/menu-check';
import { pathsChipText } from './log-filters';
import PaneToolbar, { type PaneToolbarEntry } from './PaneToolbar';
import ToolbarIconButton from './ToolbarIconButton';
import ValuesFilterChip from './ValuesFilterChip';
import { useOptionMenu } from '../use-option-menu';

export interface GitLogToolbarProps {
  tab: GitLogTabState;
  patchTab: (patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>) => void;
  refs: WorkspaceTreeRefWire[];
  /** Favorite keys (`<kind>:<name>`) — the starred refs, the defaults among them. */
  favorites: ReadonlySet<string>;
  /** A star in the Branch chip's menu was clicked. */
  onToggleFavorite: (kind: WorkspaceTreeRefWire['kind'], name: string) => void;
  /** The filters applied last, newest first — the chips' Recent rows. */
  recent: GitLogRecentFilters;
  /** The Branch chip applied a scope — empty clears it. */
  onScopeChange: (scope: GitLogScope) => void;
  /** The User chip applied a list of authors — empty clears it. */
  onUsersChange: (users: readonly string[]) => void;
  /** The Paths chip applied a list of paths — empty clears it. */
  onPathsChange: (paths: readonly string[]) => void;
  /** Loaded entries — the Go To resolver and the User submenu feed. */
  entries: WorkspaceTreeLogEntryWire[];
  loading: boolean;
  onRefresh: () => void;
  /** Cherry-pick the log's selected commits; absent while nothing is selected. */
  onCherryPick?: () => void;
  /** Navigate gesture (Go To): select the commit + scroll it into view. */
  onNavigate: (sha: string) => void;
  prefs: GitLogViewPrefs;
  onPatchPrefs: (patch: Partial<GitLogViewPrefs>) => void;
  /** Graph Options › Collapse Linear Branches — the window still has a fragment to hide. */
  canCollapseLinear: boolean;
  onCollapseLinear: () => void;
  /** Graph Options › Expand Linear Branches — a fragment is held collapsed. */
  canExpandLinear: boolean;
  onExpandLinear: () => void;
  /** The text field's regex failed to compile — error styling. */
  textInvalid: boolean;
  /** The Git tool window element — chip dialogs center over the panel. */
  container: HTMLElement | null;
}

const SHA_PREFIX = /^[0-9a-f]{4,40}$/;

/** The text field's one width — room for its placeholder beside the two toggles; it never resizes with the pane. */
const FIELD_WIDTH = 190;
const BAND_GAP = 4;

const GitLogToolbar: React.FC<GitLogToolbarProps> = ({
  tab,
  patchTab,
  refs,
  favorites,
  onToggleFavorite,
  recent,
  onScopeChange,
  onUsersChange,
  onPathsChange,
  entries,
  loading,
  onRefresh,
  onCherryPick,
  onNavigate,
  prefs,
  onPatchPrefs,
  canCollapseLinear,
  onCollapseLinear,
  canExpandLinear,
  onExpandLinear,
  textInvalid,
  container,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const graphOptions = useOptionMenu();
  const viewOptions = useOptionMenu();
  const [goToValue, setGoToValue] = useState('');
  const [goToMissed, setGoToMissed] = useState(false);

  const authors = useMemo(() => {
    const names = new Set<string>();
    for (const entry of entries) names.add(entry.authorName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const dateValue = useMemo(() => {
    if (tab.date === null) return null;
    if (tab.date.kind === 'preset') {
      return tab.date.preset === '24h' ? t('workbench.gitLog.date.last24h') : t('workbench.gitLog.date.last7d');
    }
    return `${tab.date.since ?? '…'} – ${tab.date.until ?? '…'}`;
  }, [tab.date, t]);

  const users = tab.author !== null && tab.author.kind === 'users' ? tab.author.values : [];

  const resolveGoTo = (): void => {
    const query = goToValue.trim();
    if (query.length === 0) return;
    const ref =
      refs.find((row) => row.name === query) ?? refs.find((row) => row.name.toLowerCase() === query.toLowerCase());
    const targetSha =
      ref !== undefined
        ? entries.some((entry) => entry.sha === ref.sha)
          ? ref.sha
          : null
        : SHA_PREFIX.test(query.toLowerCase())
          ? (entries.find((entry) => entry.sha.startsWith(query.toLowerCase()))?.sha ?? null)
          : null;
    if (targetSha === null) {
      setGoToMissed(true);
      return;
    }
    onNavigate(targetSha);
    setGoToOpen(false);
    setGoToValue('');
    setGoToMissed(false);
  };

  // The reference's mark on the button: an option of its menu is off its default.
  const graphOptionsChanged = tab.sort !== 'date' || tab.firstParent || tab.noMerges;

  const field = (
    <GitLogTextField
      applied={tab.filter}
      onApply={(filter) => patchTab({ filter })}
      regex={tab.filterRegex}
      onToggleRegex={() => patchTab({ filterRegex: !tab.filterRegex })}
      matchCase={tab.filterCase}
      onToggleMatchCase={() => patchTab({ filterCase: !tab.filterCase })}
      invalid={textInvalid}
    />
  );

  // The band's entries after the text field, in the order they fold from the far end.
  const band: PaneToolbarEntry[] = [
    {
      kind: 'item',
      key: 'branch',
      node: (
        <BranchFilterChip
          refs={refs}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          recent={recent.scopes}
          scope={tab.selectedRefs}
          onScopeChange={onScopeChange}
        />
      ),
    },
    {
      kind: 'item',
      key: 'user',
      node: (
        <ValuesFilterChip
          label={t('workbench.gitLog.chip.user')}
          value={tab.author !== null && tab.author.kind === 'me' ? t('workbench.gitLog.user.me') : scopeChipText(users)}
          valueTitle={scopeHoverText(users) ?? undefined}
          values={users}
          onApply={onUsersChange}
          onClear={() => patchTab({ author: null })}
          names={authors}
          bar
          rows={[
            { key: 'me', label: t('workbench.gitLog.user.me'), onPick: () => patchTab({ author: { kind: 'me' } }) },
          ]}
          recent={recent.users}
          recentText={scopeMenuText}
          testid="git-tool-chip-user"
        />
      ),
    },
    {
      kind: 'item',
      key: 'date',
      node: (
        <GitFilterChip
          label={t('workbench.gitLog.chip.date')}
          value={dateValue}
          onClear={() => patchTab({ date: null })}
          menu={{
            selectable: false,
            items: [
              { key: 'select', label: t('workbench.gitLog.menu.select') },
              { key: '24h', label: t('workbench.gitLog.date.last24h') },
              { key: '7d', label: t('workbench.gitLog.date.last7d') },
            ],
            onClick: ({ key }) => {
              if (key === 'select') setDateModalOpen(true);
              else patchTab({ date: { kind: 'preset', preset: key === '24h' ? '24h' : '7d' } });
            },
          }}
          testid="git-tool-chip-date"
        />
      ),
    },
    {
      kind: 'item',
      key: 'paths',
      node: (
        <ValuesFilterChip
          label={t('workbench.gitLog.chip.paths')}
          value={pathsChipText(tab.paths)}
          valueTitle={tab.paths.length > 1 ? tab.paths.join('\n') : undefined}
          values={tab.paths}
          onApply={onPathsChange}
          onClear={() => patchTab({ paths: [] })}
          names={[]}
          bar={false}
          rows={[
            { key: 'tree', label: t('workbench.gitLog.menu.selectInTree'), disabled: true, onPick: () => undefined },
          ]}
          recent={recent.paths}
          recentText={(paths) => pathsChipText(paths) ?? ''}
          testid="git-tool-chip-paths"
        />
      ),
    },
    {
      kind: 'item',
      key: 'graph-options',
      node: (
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          open={graphOptions.open}
          onOpenChange={graphOptions.onOpenChange}
          menu={{
            selectable: false,
            items: [
              {
                type: 'group',
                label: t('workbench.gitLog.sort.heading'),
                children: [
                  { key: 'sort-date', label: t('workbench.gitLog.sort.byDate'), icon: menuCheckIcon(tab.sort === 'date') },
                  { key: 'sort-topo', label: t('workbench.gitLog.sort.topo'), icon: menuCheckIcon(tab.sort === 'topo') },
                ],
              },
              { type: 'divider' },
              {
                type: 'group',
                label: t('workbench.gitLog.options.heading'),
                children: [
                  {
                    key: 'first-parent',
                    label: t('workbench.gitLog.options.firstParent'),
                    icon: menuCheckIcon(tab.firstParent),
                  },
                  { key: 'no-merges', label: t('workbench.gitLog.options.noMerges'), icon: menuCheckIcon(tab.noMerges) },
                ],
              },
              { type: 'divider' },
              {
                type: 'group',
                label: t('workbench.gitLog.branchActions.heading'),
                children: [
                  {
                    key: 'collapse-linear',
                    label: t('workbench.gitLog.branchActions.collapseLinear'),
                    icon: menuIconGutter(),
                    disabled: !canCollapseLinear,
                  },
                  {
                    key: 'expand-linear',
                    label: t('workbench.gitLog.branchActions.expandLinear'),
                    icon: menuIconGutter(),
                    disabled: !canExpandLinear,
                  },
                ],
              },
            ],
            onClick: ({ key }) => {
              if (key === 'sort-date') patchTab({ sort: 'date' });
              else if (key === 'sort-topo') patchTab({ sort: 'topo' });
              else if (key === 'first-parent') patchTab({ firstParent: !tab.firstParent });
              else if (key === 'no-merges') patchTab({ noMerges: !tab.noMerges });
              else if (key === 'collapse-linear') onCollapseLinear();
              else if (key === 'expand-linear') onExpandLinear();
            },
          }}
        >
          <span style={{ display: 'inline-flex' }}>
            <ToolbarIconButton
              icon={
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <GraphOptionsIcon />
                  {graphOptionsChanged && (
                    <span
                      aria-hidden
                      data-testid="git-tool-graph-options-changed"
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -3,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: token.colorPrimary,
                      }}
                    />
                  )}
                </span>
              }
              title={t('workbench.gitLog.graphOptions')}
              popoverOpen={graphOptions.open}
              testid="git-tool-graph-options"
            />
          </span>
        </Dropdown>
      ),
    },
    { kind: 'spacer', key: 'spacer' },
    {
      kind: 'item',
      key: 'refresh',
      node: (
        <ToolbarIconButton
          icon={<RefreshIcon spin={loading} />}
          title={t('workbench.gitLog.refresh')}
          onClick={onRefresh}
          disabled={loading}
          testid="git-tool-refresh"
        />
      ),
    },
    {
      kind: 'item',
      key: 'cherry-pick',
      node: (
        <ToolbarIconButton
          icon={<CherryPickIcon />}
          title={t('workbench.gitLog.cherryPick')}
          onClick={onCherryPick}
          disabled={onCherryPick === undefined}
          testid="git-tool-cherry-pick"
        />
      ),
    },
    {
      kind: 'item',
      key: 'view-options',
      node: (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={viewOptions.open}
          onOpenChange={viewOptions.onOpenChange}
          menu={{
            selectable: false,
            items: [
              {
                type: 'group',
                label: t('workbench.gitLog.show.heading'),
                children: [
                  {
                    key: 'compact-refs',
                    label: t('workbench.gitLog.show.compactRefs'),
                    icon: menuCheckIcon(prefs.compactReferences),
                  },
                  {
                    key: 'tag-names',
                    label: t('workbench.gitLog.show.tagNames'),
                    icon: menuCheckIcon(prefs.showTagNames),
                  },
                  {
                    key: 'long-edges',
                    label: t('workbench.gitLog.show.longEdges'),
                    icon: menuCheckIcon(false),
                    disabled: true,
                  },
                  {
                    key: 'commit-timestamp',
                    label: t('workbench.gitLog.show.commitTimestamp'),
                    icon: menuCheckIcon(prefs.showCommitTimestamp),
                  },
                  {
                    key: 'refs-on-left',
                    label: t('workbench.gitLog.show.refsOnLeft'),
                    icon: menuCheckIcon(prefs.referencesOnLeft),
                  },
                  {
                    key: 'columns',
                    label: t('workbench.gitLog.show.columns'),
                    icon: menuIconGutter(),
                    children: [
                      {
                        key: 'column-author',
                        label: t('workbench.gitLog.columns.author'),
                        icon: menuCheckIcon(prefs.showAuthorColumn),
                      },
                      {
                        key: 'column-hash',
                        label: t('workbench.gitLog.columns.hash'),
                        icon: menuCheckIcon(prefs.showHashColumn),
                      },
                      {
                        key: 'column-date',
                        label: t('workbench.gitLog.columns.date'),
                        icon: menuCheckIcon(prefs.showDateColumn),
                      },
                      {
                        key: 'column-signature',
                        label: t('workbench.gitLog.columns.signature'),
                        icon: menuCheckIcon(prefs.showSignatureColumn),
                      },
                    ],
                  },
                ],
              },
              { type: 'divider' },
              {
                type: 'group',
                label: t('workbench.gitLog.highlight.heading'),
                children: [
                  {
                    key: 'my-commits',
                    label: t('workbench.gitLog.highlight.myCommits'),
                    icon: menuCheckIcon(false),
                    disabled: true,
                  },
                  {
                    key: 'merge-commits',
                    label: t('workbench.gitLog.highlight.mergeCommits'),
                    icon: menuCheckIcon(prefs.highlightMergeCommits),
                  },
                  {
                    key: 'current-branch',
                    label: t('workbench.gitLog.highlight.currentBranch'),
                    icon: menuCheckIcon(prefs.highlightCurrentBranch),
                  },
                  {
                    key: 'not-cherry-picked',
                    label: t('workbench.gitLog.highlight.notCherryPicked'),
                    icon: menuCheckIcon(false),
                    disabled: true,
                  },
                ],
              },
            ],
            onClick: ({ key }) => {
              if (key === 'compact-refs') onPatchPrefs({ compactReferences: !prefs.compactReferences });
              else if (key === 'refs-on-left') onPatchPrefs({ referencesOnLeft: !prefs.referencesOnLeft });
              else if (key === 'tag-names') onPatchPrefs({ showTagNames: !prefs.showTagNames });
              else if (key === 'commit-timestamp') onPatchPrefs({ showCommitTimestamp: !prefs.showCommitTimestamp });
              else if (key === 'merge-commits') onPatchPrefs({ highlightMergeCommits: !prefs.highlightMergeCommits });
              else if (key === 'current-branch') onPatchPrefs({ highlightCurrentBranch: !prefs.highlightCurrentBranch });
              else if (key === 'column-author') onPatchPrefs({ showAuthorColumn: !prefs.showAuthorColumn });
              else if (key === 'column-hash') onPatchPrefs({ showHashColumn: !prefs.showHashColumn });
              else if (key === 'column-date') onPatchPrefs({ showDateColumn: !prefs.showDateColumn });
              else if (key === 'column-signature') onPatchPrefs({ showSignatureColumn: !prefs.showSignatureColumn });
            },
          }}
        >
          <span style={{ display: 'inline-flex' }}>
            <ToolbarIconButton
              icon={<EyeOutlined />}
              title={t('workbench.gitLog.viewOptions')}
              popoverOpen={viewOptions.open}
              testid="git-tool-view-options"
            />
          </span>
        </Dropdown>
      ),
    },
    {
      kind: 'item',
      key: 'go-to',
      node: (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={goToOpen}
          // Mounted fresh on every open, so the field's autoFocus lands each
          // time (a kept popup mounts once and focuses once).
          destroyOnHidden
          onOpenChange={(next) => {
            setGoToOpen(next);
            if (!next) {
              setGoToValue('');
              setGoToMissed(false);
            }
          }}
          popupRender={() => (
            <div
              style={{
                background: token.colorBgElevated,
                borderRadius: token.borderRadiusLG,
                boxShadow: token.boxShadowSecondary,
                padding: 8,
                minWidth: 260,
              }}
            >
              <Input
                size="small"
                autoFocus
                value={goToValue}
                status={goToMissed ? 'error' : undefined}
                onChange={(e) => {
                  setGoToValue(e.target.value);
                  setGoToMissed(false);
                }}
                onPressEnter={resolveGoTo}
                placeholder={t('workbench.gitLog.goTo.placeholder')}
                data-testid="git-tool-goto-input"
              />
              {goToMissed && (
                <div style={{ paddingTop: 6, fontSize: 11.5, color: token.colorError }} data-testid="git-tool-goto-miss">
                  {t('workbench.gitLog.goTo.notFound')}
                </div>
              )}
            </div>
          )}
        >
          <span style={{ display: 'inline-flex' }}>
            <ToolbarIconButton icon={<SearchOutlined />} title={t('workbench.gitLog.goTo')} testid="git-tool-goto" />
          </span>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PaneToolbar
        entries={band}
        testid="git-tool-toolbar"
        lead={{ node: field, width: FIELD_WIDTH }}
        gap={BAND_GAP}
      />
      <DateFilterModal
        open={dateModalOpen}
        since={tab.date !== null && tab.date.kind === 'range' ? tab.date.since : null}
        until={tab.date !== null && tab.date.kind === 'range' ? tab.date.until : null}
        container={container}
        onClose={() => setDateModalOpen(false)}
        onApply={(since, until) => {
          patchTab({ date: since === null && until === null ? null : { kind: 'range', since, until } });
        }}
      />
    </>
  );
};

export default GitLogToolbar;
