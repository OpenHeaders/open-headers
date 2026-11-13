/**
 * CommitToolbar — the Commit window's top icon row:
 * Refresh, Rollback… (live over a selection of added rows — the index
 * drop back to unversioned; tracked rollbacks are their own future
 * slice), Shelve Silently (a visible placeholder), the View
 * Options eye (Group By Workspace / Directory, Show Ignored Files), Select Opened
 * File (placeholder — needs the editor-tab↔file join), then Expand /
 * Collapse All driving the changes tree. The band is a PaneToolbar: at
 * a narrow dock the tail folds behind the › chevron's hover strip.
 */

import { AimOutlined, EyeOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon, RefreshIcon, RollbackIcon, ShelveIcon } from '@openheaders/ui/shared/icons';
import { menuCheckIcon } from '../../../shared/menu-check';
import PaneToolbar, { type PaneToolbarEntry } from '../toolbar/PaneToolbar';
import { useOptionMenu } from '../use-option-menu';
import ToolbarIconButton from '../toolbar/ToolbarIconButton';
import type { CommitViewPrefs } from './commit-view-prefs';

export interface CommitToolbarProps {
  onRefresh: () => void;
  /** Rollback…'s target — the selected added rows' paths; empty disables the button. */
  rollbackPaths: readonly string[];
  onRollback: (paths: readonly string[]) => void;
  prefs: CommitViewPrefs;
  onPatchPrefs: (patch: Partial<CommitViewPrefs>) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const CommitToolbar: React.FC<CommitToolbarProps> = ({
  onRefresh,
  rollbackPaths,
  onRollback,
  prefs,
  onPatchPrefs,
  onExpandAll,
  onCollapseAll,
}) => {
  const t = useT();
  const viewOptionsMenu = useOptionMenu();

  const viewOptions = (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      open={viewOptionsMenu.open}
      onOpenChange={viewOptionsMenu.onOpenChange}
      menu={{
          selectable: false,
          items: [
            {
              type: 'group',
              label: t('workbench.gitLog.details.groupBy'),
              children: [
                {
                  key: 'workspace',
                  label: t('workbench.gitLog.details.workspace'),
                  icon: menuCheckIcon(prefs.groupByWorkspace),
                },
                {
                  key: 'directory',
                  label: t('workbench.gitLog.details.directory'),
                  icon: menuCheckIcon(prefs.groupByDirectory),
                },
              ],
            },
            { type: 'divider' },
            {
              type: 'group',
              label: t('workbench.commitTool.show'),
              children: [
                {
                  key: 'ignored',
                  label: t('workbench.commitTool.ignoredFiles'),
                  icon: menuCheckIcon(prefs.showIgnored),
                },
              ],
            },
          ],
        onClick: ({ key }) => {
          if (key === 'workspace') onPatchPrefs({ groupByWorkspace: !prefs.groupByWorkspace });
          else if (key === 'directory') onPatchPrefs({ groupByDirectory: !prefs.groupByDirectory });
          else if (key === 'ignored') onPatchPrefs({ showIgnored: !prefs.showIgnored });
        },
      }}
    >
      <span style={{ display: 'inline-flex' }}>
        <ToolbarIconButton
          icon={<EyeOutlined />}
          title={t('workbench.gitLog.viewOptions')}
          popoverOpen={viewOptionsMenu.open}
          testid="commit-tool-view-options"
        />
      </span>
    </Dropdown>
  );

  const entries: PaneToolbarEntry[] = [
    {
      kind: 'item',
      key: 'refresh',
      node: (
        <ToolbarIconButton
          icon={<RefreshIcon />}
          title={t('workbench.commitTool.refresh')}
          onClick={onRefresh}
          testid="commit-tool-refresh"
        />
      ),
    },
    {
      kind: 'item',
      key: 'rollback',
      node: (
        <ToolbarIconButton
          icon={<RollbackIcon />}
          title={t('workbench.commitTool.rollback')}
          disabled={rollbackPaths.length === 0}
          onClick={() => onRollback(rollbackPaths)}
          testid="commit-tool-rollback"
        />
      ),
    },
    {
      kind: 'item',
      key: 'shelve',
      node: (
        <ToolbarIconButton
          icon={<ShelveIcon />}
          title={t('workbench.commitTool.shelve')}
          disabled
          testid="commit-tool-shelve"
        />
      ),
    },
    { kind: 'item', key: 'view-options', node: viewOptions },
    { kind: 'separator', key: 'sep-tree' },
    {
      kind: 'item',
      key: 'select-opened',
      node: (
        <ToolbarIconButton
          icon={<AimOutlined />}
          title={t('workbench.commitTool.selectOpened')}
          disabled
          testid="commit-tool-select-opened"
        />
      ),
    },
    {
      kind: 'item',
      key: 'expand-all',
      node: (
        <ToolbarIconButton
          icon={<ExpandAllIcon />}
          title={t('workbench.gitLog.expandAll')}
          onClick={onExpandAll}
          testid="commit-tool-expand-all"
        />
      ),
    },
    {
      kind: 'item',
      key: 'collapse-all',
      node: (
        <ToolbarIconButton
          icon={<CollapseAllIcon />}
          title={t('workbench.gitLog.collapseAll')}
          onClick={onCollapseAll}
          testid="commit-tool-collapse-all"
        />
      ),
    },
  ];

  return <PaneToolbar entries={entries} testid="commit-tool-toolbar" />;
};

export default CommitToolbar;
