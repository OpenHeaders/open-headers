/**
 * GitRailActivityBar — the vertical toolbar on the branches rail's
 * left edge (IDE-log anatomy), top to bottom: Hide Git Branches, then
 * the branch verbs (New / Update Selected / Delete / Compare with
 * Current / Show My Branches / Fetch / Favorite / Navigate), the gear
 * (Branches Pane Settings: single-click behavior + Show Tags), and
 * the view trio (Group By Directory, Expand All, Collapse All).
 * Presentational: enablement and handlers arrive from the rail
 * orchestrator; Show My Branches ships visible but disabled (the
 * IDE-parity placeholder).
 */

import {
  AimOutlined,
  ArrowsAltOutlined,
  DeleteOutlined,
  FolderOutlined,
  LeftOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ShrinkOutlined,
  StarFilled,
  SwapOutlined,
  SyncOutlined,
  VerticalAlignBottomOutlined,
} from '@ant-design/icons';
import { Dropdown, theme, Tooltip } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
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
}

const BarButton: React.FC<BarButtonProps> = ({ icon, title, onClick, disabled, active, testid }) => {
  const { token } = theme.useToken();
  return (
    <Tooltip placement="right" title={title}>
      <button
        type="button"
        aria-label={title}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={active ? 'git-tool-rail-button active' : 'git-tool-rail-button'}
        data-testid={testid}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          padding: 0,
          border: 'none',
          background: active ? token.colorFillSecondary : 'transparent',
          borderRadius: token.borderRadiusSM,
          cursor: disabled ? 'default' : 'pointer',
          color: disabled ? token.colorTextQuaternary : token.colorTextSecondary,
          fontSize: 13,
        }}
      >
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      </button>
    </Tooltip>
  );
};

const GitRailActivityBar: React.FC<GitRailActivityBarProps> = (props) => {
  const t = useT();
  const { token } = theme.useToken();

  const divider = (
    <span
      aria-hidden
      style={{ display: 'block', width: 16, height: 1, margin: '3px auto', background: token.colorBorderSecondary }}
    />
  );

  return (
    <div
      data-testid="git-tool-rail-bar"
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 3px',
        borderRight: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <BarButton
        icon={<LeftOutlined />}
        title={t('workbench.gitLog.rail.hide')}
        onClick={props.onHide}
        testid="git-tool-rail-hide"
      />
      {divider}
      <BarButton
        icon={<PlusOutlined />}
        title={t('workbench.gitLog.rail.newBranch')}
        onClick={props.onNewBranch}
        testid="git-tool-rail-new-branch"
      />
      <BarButton
        icon={props.updateSelectedBusy ? <SyncOutlined spin /> : <VerticalAlignBottomOutlined />}
        title={t('workbench.gitLog.rail.updateSelected')}
        onClick={props.onUpdateSelected}
        disabled={!props.updateSelectedEnabled || props.updateSelectedBusy}
        testid="git-tool-rail-update-selected"
      />
      <BarButton
        icon={<DeleteOutlined />}
        title={t('workbench.gitLog.rail.deleteBranch')}
        onClick={props.onDeleteBranch}
        disabled={!props.deleteEnabled}
        testid="git-tool-rail-delete-branch"
      />
      <BarButton
        icon={<SwapOutlined />}
        title={t('workbench.gitLog.rail.compareWithCurrent')}
        onClick={props.onCompareWithCurrent}
        disabled={!props.compareEnabled}
        testid="git-tool-rail-compare"
      />
      <BarButton
        icon={<SearchOutlined />}
        title={t('workbench.gitLog.rail.showMyBranches')}
        disabled
        testid="git-tool-rail-my-branches"
      />
      <BarButton
        icon={<SyncOutlined spin={props.fetchBusy} />}
        title={t('workbench.gitLog.rail.fetch')}
        onClick={props.onFetch}
        disabled={props.fetchBusy}
        testid="git-tool-rail-fetch"
      />
      <BarButton
        icon={<StarFilled style={{ color: props.favoriteEnabled ? token.colorWarningText : undefined }} />}
        title={t('workbench.gitLog.rail.toggleFavorite')}
        onClick={props.onToggleFavorite}
        disabled={!props.favoriteEnabled}
        testid="git-tool-rail-favorite"
      />
      <BarButton
        icon={<AimOutlined />}
        title={t('workbench.gitLog.rail.navigateToHead')}
        onClick={props.onNavigateToHead}
        disabled={!props.navigateEnabled}
        testid="git-tool-rail-navigate"
      />
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        menu={{
          selectable: false,
          items: [
            {
              type: 'group',
              label: t('workbench.gitLog.rail.singleClickHeading'),
              children: [
                { key: 'single-click-filter', label: t('workbench.gitLog.rail.singleClickFilter') },
                { key: 'single-click-navigate', label: t('workbench.gitLog.rail.singleClickNavigate') },
              ],
            },
            { type: 'divider' },
            { key: 'show-tags', label: t('workbench.gitLog.rail.showTags') },
          ],
          selectedKeys: [
            props.singleClick === 'filter' ? 'single-click-filter' : 'single-click-navigate',
            ...(props.showTags ? ['show-tags'] : []),
          ],
          onClick: ({ key }) => {
            if (key === 'single-click-filter') props.onSingleClickChange('filter');
            else if (key === 'single-click-navigate') props.onSingleClickChange('navigate');
            else if (key === 'show-tags') props.onShowTagsChange(!props.showTags);
          },
        }}
      >
        <span data-testid="git-tool-rail-settings" style={{ display: 'inline-flex' }}>
          <BarButton icon={<SettingOutlined />} title={t('workbench.gitLog.rail.paneSettings')} testid="git-tool-rail-settings-button" />
        </span>
      </Dropdown>
      {divider}
      <BarButton
        icon={<FolderOutlined />}
        title={t('workbench.gitLog.rail.groupByDirectory')}
        onClick={() => props.onGroupByDirectoryChange(!props.groupByDirectory)}
        active={props.groupByDirectory}
        testid="git-tool-rail-group-dirs"
      />
      <BarButton
        icon={<ArrowsAltOutlined />}
        title={t('workbench.gitLog.rail.expandAll')}
        onClick={props.onExpandAll}
        testid="git-tool-rail-expand-all"
      />
      <BarButton
        icon={<ShrinkOutlined />}
        title={t('workbench.gitLog.rail.collapseAll')}
        onClick={props.onCollapseAll}
        testid="git-tool-rail-collapse-all"
      />
    </div>
  );
};

export default GitRailActivityBar;
