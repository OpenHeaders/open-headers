/**
 * GitRailActivityBar — the vertical toolbar on the branches rail's
 * left edge (log-window anatomy), top to bottom: Hide Git Branches, then
 * the branch verbs (New / Update Selected / Delete / Compare with
 * Current / Show My Branches / Fetch / Favorite / Navigate), the gear
 * (Branches Pane Settings: single-click behavior, Group By Directory,
 * Show Tags), then Expand All and Collapse All. When the rail is too
 * short for the run, the tail folds behind a › chevron whose hover or
 * click lays the folded buttons out in a strip beside it (the
 * reference's overflow) — the shared toolbar-overflow fit decides the
 * cut. A button's tooltip opens beside the bar, and above the strip.
 * Presentational: enablement and handlers arrive from the rail
 * orchestrator; Show My Branches ships visible but disabled (the
 * placeholder).
 */

import {
  AimOutlined,
  DeleteOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  StarFilled,
  SwapOutlined,
} from '@ant-design/icons';
import { Dropdown, theme, Tooltip } from 'antd';
import type React from 'react';
import { createContext, useContext, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon, FetchIcon, PullIcon } from '@openheaders/ui/shared/icons';
import { type ToolbarOverflowItem, useToolbarOverflow } from '@openheaders/ui/shared/toolbar-overflow';
import { menuCheckIcon } from '../../../shared/menu-check';
import { GIT_BAR_GLYPH_SIZE } from '../git-type-scale';
import { useOptionMenu } from '../use-option-menu';
import type { GitRailSingleClick } from './git-rail-prefs';

export interface GitRailActivityBarProps {
  onHide: () => void;
  onNewBranch: () => void;
  onUpdateSelected: () => void;
  updateSelectedEnabled: boolean;
  updateSelectedBusy: boolean;
  onDeleteBranch: () => void;
  deleteEnabled: boolean;
  onCompareWithCurrent: () => void;
  compareEnabled: boolean;
  onFetch: () => void;
  fetchBusy: boolean;
  onToggleFavorite: () => void;
  favoriteEnabled: boolean;
  onNavigateToHead: () => void;
  navigateEnabled: boolean;
  singleClick: GitRailSingleClick;
  onSingleClickChange: (mode: GitRailSingleClick) => void;
  showTags: boolean;
  onShowTagsChange: (show: boolean) => void;
  groupByDirectory: boolean;
  onGroupByDirectoryChange: (grouped: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

interface BarButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  testid: string;
  /** False renders the bare button — the › chevron's strip is its own disclosure. */
  tooltip?: boolean;
  /** True while a popover this button opened is showing — the tooltip yields to it (S35 law). */
  popoverOpen?: boolean;
}

const BUTTON_EXTENT = 24;
const SEPARATOR_EXTENT = 7;

/**
 * Where a button's tooltip opens: beside it in the bar; above it in the
 * › chevron's strip, which lies along the bar's side — beside would
 * cover the strip's next buttons.
 */
const TooltipSide = createContext<'right' | 'top'>('right');
const GAP = 2;
const BAR_PADDING = 12;

const BarButton: React.FC<BarButtonProps> = ({
  icon,
  title,
  onClick,
  disabled,
  active,
  testid,
  tooltip = true,
  popoverOpen = false,
}) => {
  const { token } = theme.useToken();
  const side = useContext(TooltipSide);
  // Hidden the instant the button is clicked, back on the next hover —
  // so a popover the click opens is never covered by its own tooltip.
  const [suppressed, setSuppressed] = useState(false);
  const button = (
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        disabled={disabled}
        onClick={() => {
          setSuppressed(true);
          onClick?.();
        }}
        onMouseEnter={() => setSuppressed(false)}
        className={active ? 'git-tool-rail-button active' : 'git-tool-rail-button'}
        data-testid={testid}
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: BUTTON_EXTENT,
          height: BUTTON_EXTENT,
          padding: 0,
          border: 'none',
          // At rest the stylesheet's (transparent, a grey fill under the pointer); pressed, its own.
          background: active ? token.colorFillSecondary : undefined,
          borderRadius: token.borderRadiusSM,
          cursor: disabled ? 'default' : 'pointer',
          color: disabled ? token.colorTextQuaternary : token.colorTextSecondary,
          fontSize: GIT_BAR_GLYPH_SIZE,
        }}
      >
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip placement={side} title={title} open={popoverOpen || suppressed ? false : undefined}>
      {button}
    </Tooltip>
  );
};

type BarEntry = { kind: 'item'; key: string; node: React.ReactNode } | { kind: 'separator'; key: string };

/** The bar's shape never changes, so the fit's extents are built once. */
const SHAPE: readonly ToolbarOverflowItem['kind'][] = [
  'item',
  'separator',
  'item',
  'item',
  'item',
  'item',
  'item',
  'item',
  'item',
  'item',
  'separator',
  'item',
  'item',
  'item',
];
const EXTENTS: readonly ToolbarOverflowItem[] = SHAPE.map((kind) => ({
  kind,
  extent: kind === 'item' ? BUTTON_EXTENT : SEPARATOR_EXTENT,
}));

const GitRailActivityBar: React.FC<GitRailActivityBarProps> = (props) => {
  const t = useT();
  const { token } = theme.useToken();
  const settingsMenu = useOptionMenu();
  const { ref, fit } = useToolbarOverflow<HTMLDivElement>({
    items: EXTENTS,
    axis: 'vertical',
    gap: GAP,
    moreExtent: BUTTON_EXTENT,
    padding: BAR_PADDING,
  });

  const separator = (vertical: boolean, key: string): React.ReactNode => (
    <span
      key={key}
      aria-hidden
      style={
        vertical
          ? { flex: '0 0 auto', display: 'block', width: 1, height: 16, margin: '0 3px', background: token.colorBorderSecondary }
          : { flex: '0 0 auto', display: 'block', width: 16, height: 1, margin: '3px auto', background: token.colorBorderSecondary }
      }
    />
  );

  const settings = (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      open={settingsMenu.open}
      onOpenChange={settingsMenu.onOpenChange}
      menu={{
        // The ✓ prefix IS the state (reference convention) — highlight is
        // hover-only, so nothing is ever "selected".
        selectable: false,
        items: [
          {
            type: 'group',
            label: t('workbench.gitLog.rail.singleClickHeading'),
            children: [
              {
                key: 'single-click-filter',
                label: t('workbench.gitLog.rail.singleClickFilter'),
                icon: menuCheckIcon(props.singleClick === 'filter'),
              },
              {
                key: 'single-click-navigate',
                label: t('workbench.gitLog.rail.singleClickNavigate'),
                icon: menuCheckIcon(props.singleClick === 'navigate'),
              },
            ],
          },
          { type: 'divider' },
          {
            key: 'group-dirs',
            label: t('workbench.gitLog.rail.groupByDirectory'),
            icon: menuCheckIcon(props.groupByDirectory),
          },
          { key: 'show-tags', label: t('workbench.gitLog.rail.showTags'), icon: menuCheckIcon(props.showTags) },
        ],
        onClick: ({ key }) => {
          if (key === 'single-click-filter') props.onSingleClickChange('filter');
          else if (key === 'single-click-navigate') props.onSingleClickChange('navigate');
          else if (key === 'group-dirs') props.onGroupByDirectoryChange(!props.groupByDirectory);
          else if (key === 'show-tags') props.onShowTagsChange(!props.showTags);
        },
      }}
    >
      <span data-testid="git-tool-rail-settings" style={{ display: 'inline-flex', flex: '0 0 auto' }}>
        <BarButton
          icon={<SettingOutlined />}
          title={t('workbench.gitLog.rail.paneSettings')}
          popoverOpen={settingsMenu.open}
          testid="git-tool-rail-settings-button"
        />
      </span>
    </Dropdown>
  );

  const entries: readonly BarEntry[] = [
    {
      kind: 'item',
      key: 'hide',
      node: <BarButton icon={<LeftOutlined />} title={t('workbench.gitLog.rail.hide')} onClick={props.onHide} testid="git-tool-rail-hide" />,
    },
    { kind: 'separator', key: 'sep-verbs' },
    {
      kind: 'item',
      key: 'new-branch',
      node: (
        <BarButton
          icon={<PlusOutlined />}
          title={t('workbench.gitLog.rail.newBranch')}
          onClick={props.onNewBranch}
          testid="git-tool-rail-new-branch"
        />
      ),
    },
    {
      kind: 'item',
      key: 'update-selected',
      node: (
        <BarButton
          icon={<PullIcon />}
          title={t('workbench.gitLog.rail.updateSelected')}
          onClick={props.onUpdateSelected}
          disabled={!props.updateSelectedEnabled || props.updateSelectedBusy}
          testid="git-tool-rail-update-selected"
        />
      ),
    },
    {
      kind: 'item',
      key: 'delete',
      node: (
        <BarButton
          icon={<DeleteOutlined />}
          title={t('workbench.gitLog.rail.deleteBranch')}
          onClick={props.onDeleteBranch}
          disabled={!props.deleteEnabled}
          testid="git-tool-rail-delete-branch"
        />
      ),
    },
    {
      kind: 'item',
      key: 'compare',
      node: (
        <BarButton
          icon={<SwapOutlined />}
          title={t('workbench.gitLog.rail.compareWithCurrent')}
          onClick={props.onCompareWithCurrent}
          disabled={!props.compareEnabled}
          testid="git-tool-rail-compare"
        />
      ),
    },
    {
      kind: 'item',
      key: 'my-branches',
      node: (
        <BarButton icon={<SearchOutlined />} title={t('workbench.gitLog.rail.showMyBranches')} disabled testid="git-tool-rail-my-branches" />
      ),
    },
    {
      kind: 'item',
      key: 'fetch',
      node: (
        <BarButton
          icon={<FetchIcon />}
          title={t('workbench.gitLog.rail.fetch')}
          onClick={props.onFetch}
          disabled={props.fetchBusy}
          testid="git-tool-rail-fetch"
        />
      ),
    },
    {
      kind: 'item',
      key: 'favorite',
      node: (
        <BarButton
          icon={<StarFilled style={{ color: props.favoriteEnabled ? token.colorWarningText : undefined }} />}
          title={t('workbench.gitLog.rail.toggleFavorite')}
          onClick={props.onToggleFavorite}
          disabled={!props.favoriteEnabled}
          testid="git-tool-rail-favorite"
        />
      ),
    },
    {
      kind: 'item',
      key: 'navigate',
      node: (
        <BarButton
          icon={<AimOutlined />}
          title={t('workbench.gitLog.rail.navigateToHead')}
          onClick={props.onNavigateToHead}
          disabled={!props.navigateEnabled}
          testid="git-tool-rail-navigate"
        />
      ),
    },
    { kind: 'separator', key: 'sep-view' },
    { kind: 'item', key: 'settings', node: settings },
    {
      kind: 'item',
      key: 'expand-all',
      node: (
        <BarButton
          icon={<ExpandAllIcon />}
          title={t('workbench.gitLog.rail.expandAll')}
          onClick={props.onExpandAll}
          testid="git-tool-rail-expand-all"
        />
      ),
    },
    {
      kind: 'item',
      key: 'collapse-all',
      node: (
        <BarButton
          icon={<CollapseAllIcon />}
          title={t('workbench.gitLog.rail.collapseAll')}
          onClick={props.onCollapseAll}
          testid="git-tool-rail-collapse-all"
        />
      ),
    },
  ];

  const render = (entry: BarEntry, vertical: boolean): React.ReactNode =>
    entry.kind === 'separator' ? separator(vertical, entry.key) : <span key={entry.key} style={{ display: 'contents' }}>{entry.node}</span>;

  const visible = entries.slice(0, fit.visible);
  const folded = entries.slice(fit.overflowStart);
  const strip = folded.map((entry) => entry.key).join('|');

  return (
    <div
      ref={ref}
      data-testid="git-tool-rail-bar"
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: GAP,
        padding: '6px 3px',
        minHeight: 0,
        overflow: 'hidden',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {visible.map((entry) => render(entry, false))}
      {folded.length > 0 && (
        <Dropdown
          key={strip}
          // Hover lays the strip out (the reference gesture); a click toggle
          // would close what the arriving pointer had just opened.
          trigger={['hover']}
          mouseEnterDelay={0.05}
          placement="rightBottom"
          popupRender={() => (
            <div
              role="toolbar"
              data-testid="git-tool-rail-overflow"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: GAP,
                padding: 4,
                background: token.colorBgElevated,
                borderRadius: token.borderRadiusLG,
                boxShadow: token.boxShadowSecondary,
              }}
            >
              <TooltipSide.Provider value="top">{folded.map((entry) => render(entry, true))}</TooltipSide.Provider>
            </div>
          )}
        >
          <span data-testid="git-tool-rail-more" style={{ display: 'inline-flex', flex: '0 0 auto', marginTop: 'auto' }}>
            <BarButton
              icon={<RightOutlined />}
              title={t('workbench.gitLog.rail.moreActions')}
              tooltip={false}
              testid="git-tool-rail-more-button"
            />
          </span>
        </Dropdown>
      )}
    </div>
  );
};

export default GitRailActivityBar;
