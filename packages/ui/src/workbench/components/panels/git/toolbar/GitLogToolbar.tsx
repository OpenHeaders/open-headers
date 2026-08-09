/**
 * GitLogToolbar — the log pane's top band, the IDE filter row: the
 * text-or-hash field with regex/match-case toggles, the Branch / User /
 * Date / Paths filter chips, Graph Options (sort + walk riders), then
 * the right-aligned action icons — Refresh, Cherry-Pick (placeholder),
 * View Options, Go To Hash/Branch/Tag. Filter state lives in the tab
 * registry (travels with the tab); display prefs are per-workspace.
 */

import { EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Dropdown, Input, theme, Tooltip } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { GitLogViewPrefs } from '../git-log-view-prefs';
import type { GitLogTabState } from '../git-panel-view-store';
import BranchFilterChip from './BranchFilterChip';
import DateFilterModal from './DateFilterModal';
import GitFilterChip from './GitFilterChip';
import { CherryPickIcon, GraphOptionsIcon } from './icons';
import { menuCheckIcon } from './menu-check';
import PathsFilterModal from './PathsFilterModal';
import ToolbarIconButton from './ToolbarIconButton';

export interface GitLogToolbarProps {
  tab: GitLogTabState;
  patchTab: (patch: Partial<Omit<GitLogTabState, 'kind' | 'id'>>) => void;
  refs: WorkspaceTreeRefWire[];
  currentRef: string | null;
  /** Favorite keys (`<kind>:<name>`) from the rail prefs. */
  favorites: ReadonlySet<string>;
  /** Loaded entries — the Go To resolver and the User submenu feed. */
  entries: WorkspaceTreeLogEntryWire[];
  loading: boolean;
  onRefresh: () => void;
  /** Navigate gesture (Go To): select the commit + scroll it into view. */
  onNavigate: (sha: string) => void;
  prefs: GitLogViewPrefs;
  onPatchPrefs: (patch: Partial<GitLogViewPrefs>) => void;
  /** The text field's regex failed to compile — error styling. */
  textInvalid: boolean;
  /** The Git tool window element — chip dialogs center over the panel. */
  container: HTMLElement | null;
}

const SHA_PREFIX = /^[0-9a-f]{4,40}$/;

interface FilterToggleProps {
  glyph: string;
  title: string;
  active: boolean;
  onToggle: () => void;
  testid: string;
}

const FilterToggle: React.FC<FilterToggleProps> = ({ glyph, title, active, onToggle, testid }) => {
  const { token } = theme.useToken();
  return (
    <Tooltip placement="top" title={title}>
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        onClick={onToggle}
        data-testid={testid}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          border: 'none',
          background: active ? token.colorFillSecondary : 'transparent',
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          fontFamily: token.fontFamilyCode,
          fontSize: 11,
          color: active ? token.colorPrimaryText : token.colorTextTertiary,
        }}
      >
        {glyph}
      </button>
    </Tooltip>
  );
};

const GitLogToolbar: React.FC<GitLogToolbarProps> = ({
  tab,
  patchTab,
  refs,
  currentRef,
  favorites,
  entries,
  loading,
  onRefresh,
  onNavigate,
  prefs,
  onPatchPrefs,
  textInvalid,
  container,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [pathsModalOpen, setPathsModalOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const [goToValue, setGoToValue] = useState('');
  const [goToMissed, setGoToMissed] = useState(false);

  const authors = useMemo(() => {
    const names = new Set<string>();
    for (const entry of entries) names.add(entry.authorName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const scopeKind = useMemo(
    () => refs.find((ref) => ref.name === tab.selectedRef)?.kind ?? 'local',
    [refs, tab.selectedRef],
  );

  const dateValue = useMemo(() => {
    if (tab.date === null) return null;
    if (tab.date.kind === 'preset') {
      return tab.date.preset === '24h' ? t('workbench.gitLog.date.last24h') : t('workbench.gitLog.date.last7d');
    }
    return `${tab.date.since ?? '…'} – ${tab.date.until ?? '…'}`;
  }, [tab.date, t]);

  const pathsValue =
    tab.paths.length === 0
      ? null
      : tab.paths.length === 1
        ? tab.paths[0]
        : t('workbench.gitLog.chip.pathsCount', { count: tab.paths.length });

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

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 33,
        padding: '0 8px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        minWidth: 0,
      }}
      data-testid="git-tool-toolbar"
    >
      <Input
        size="small"
        allowClear
        value={tab.filter}
        status={textInvalid ? 'error' : undefined}
        onChange={(e) => patchTab({ filter: e.target.value })}
        placeholder={t('workbench.gitLog.filterPlaceholder')}
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        suffix={
          <span style={{ display: 'inline-flex', gap: 2 }}>
            <FilterToggle
              glyph=".*"
              title={t('workbench.gitLog.filter.regex')}
              active={tab.filterRegex}
              onToggle={() => patchTab({ filterRegex: !tab.filterRegex })}
              testid="git-tool-filter-regex"
            />
            <FilterToggle
              glyph="Cc"
              title={t('workbench.gitLog.filter.matchCase')}
              active={tab.filterCase}
              onToggle={() => patchTab({ filterCase: !tab.filterCase })}
              testid="git-tool-filter-case"
            />
          </span>
        }
        style={{ maxWidth: 220, flex: '0 1 auto' }}
        data-testid="git-tool-filter"
      />
      <BranchFilterChip
        refs={refs}
        currentRef={currentRef}
        favorites={favorites}
        scopeRef={tab.selectedRef}
        scopeKind={scopeKind}
        onScopeChange={(ref) => patchTab({ selectedRef: ref })}
      />
      <GitFilterChip
        label={t('workbench.gitLog.chip.user')}
        value={tab.author === null ? null : tab.author.kind === 'me' ? t('workbench.gitLog.user.me') : tab.author.value}
        onClear={() => patchTab({ author: null })}
        menu={{
          selectable: false,
          items: [
            {
              key: 'select',
              label: t('workbench.gitLog.menu.select'),
              disabled: authors.length === 0,
              children: authors.map((name) => ({ key: `author:${name}`, label: name })),
            },
            { key: 'me', label: t('workbench.gitLog.user.me') },
          ],
          onClick: ({ key }) => {
            if (key === 'me') patchTab({ author: { kind: 'me' } });
            else if (key.startsWith('author:')) patchTab({ author: { kind: 'user', value: key.slice(7) } });
          },
        }}
        testid="git-tool-chip-user"
      />
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
      <GitFilterChip
        label={t('workbench.gitLog.chip.paths')}
        value={pathsValue}
        onClear={() => patchTab({ paths: [] })}
        menu={{
          selectable: false,
          items: [
            { key: 'select', label: t('workbench.gitLog.menu.select') },
            { key: 'select-in-tree', label: t('workbench.gitLog.menu.selectInTree'), disabled: true },
          ],
          onClick: ({ key }) => {
            if (key === 'select') setPathsModalOpen(true);
          },
        }}
        testid="git-tool-chip-paths"
      />
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
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
                  icon: menuCheckIcon(false),
                  disabled: true,
                },
                {
                  key: 'expand-linear',
                  label: t('workbench.gitLog.branchActions.expandLinear'),
                  icon: menuCheckIcon(false),
                  disabled: true,
                },
              ],
            },
          ],
          onClick: ({ key }) => {
            if (key === 'sort-date') patchTab({ sort: 'date' });
            else if (key === 'sort-topo') patchTab({ sort: 'topo' });
            else if (key === 'first-parent') patchTab({ firstParent: !tab.firstParent });
            else if (key === 'no-merges') patchTab({ noMerges: !tab.noMerges });
          },
        }}
      >
        <span style={{ display: 'inline-flex' }}>
          <ToolbarIconButton
            icon={<GraphOptionsIcon />}
            title={t('workbench.gitLog.graphOptions')}
            testid="git-tool-graph-options"
          />
        </span>
      </Dropdown>
      <span style={{ flex: 1 }} />
      <ToolbarIconButton
        icon={<ReloadOutlined spin={loading} />}
        title={t('workbench.gitLog.refresh')}
        onClick={onRefresh}
        disabled={loading}
        testid="git-tool-refresh"
      />
      <ToolbarIconButton
        icon={<CherryPickIcon />}
        title={t('workbench.gitLog.cherryPick')}
        disabled
        testid="git-tool-cherry-pick"
      />
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
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
                  icon: menuCheckIcon(false),
                  disabled: true,
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
                  icon: menuCheckIcon(false),
                  disabled: true,
                },
                {
                  key: 'columns',
                  label: t('workbench.gitLog.show.columns'),
                  icon: menuCheckIcon(false),
                  disabled: true,
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
                  icon: menuCheckIcon(false),
                  disabled: true,
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
            if (key === 'tag-names') onPatchPrefs({ showTagNames: !prefs.showTagNames });
            else if (key === 'commit-timestamp') onPatchPrefs({ showCommitTimestamp: !prefs.showCommitTimestamp });
            else if (key === 'merge-commits') onPatchPrefs({ highlightMergeCommits: !prefs.highlightMergeCommits });
          },
        }}
      >
        <span style={{ display: 'inline-flex' }}>
          <ToolbarIconButton
            icon={<EyeOutlined />}
            title={t('workbench.gitLog.viewOptions')}
            testid="git-tool-view-options"
          />
        </span>
      </Dropdown>
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        open={goToOpen}
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
      <PathsFilterModal
        open={pathsModalOpen}
        paths={tab.paths}
        container={container}
        onClose={() => setPathsModalOpen(false)}
        onApply={(paths) => patchTab({ paths })}
      />
    </div>
  );
};

export default GitLogToolbar;
