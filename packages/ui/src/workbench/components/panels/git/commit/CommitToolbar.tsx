/**
 * CommitToolbar — the Commit window's top icon row (IDE reference):
 * Refresh, Rollback… and Shelve Silently (visible placeholders — the
 * destructive write verbs are their own future slice), the View
 * Options eye (Group By Directory, Show Ignored Files), Select Opened
 * File (placeholder — needs the editor-tab↔file join), then Expand /
 * Collapse All driving the changes tree.
 */

import {
  AimOutlined,
  ColumnHeightOutlined,
  EyeOutlined,
  SyncOutlined,
  UndoOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
} from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { menuCheckIcon } from '../toolbar/menu-check';
import ToolbarIconButton from '../toolbar/ToolbarIconButton';
import type { CommitViewPrefs } from './commit-view-prefs';

export interface CommitToolbarProps {
  onRefresh: () => void;
  prefs: CommitViewPrefs;
  onPatchPrefs: (patch: Partial<CommitViewPrefs>) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const CommitToolbar: React.FC<CommitToolbarProps> = ({ onRefresh, prefs, onPatchPrefs, onExpandAll, onCollapseAll }) => {
  const t = useT();
  const { token } = theme.useToken();

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 33,
        padding: '0 8px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
        minWidth: 0,
      }}
      data-testid="commit-tool-toolbar"
    >
      <ToolbarIconButton
        icon={<SyncOutlined />}
        title={t('workbench.commitTool.refresh')}
        onClick={onRefresh}
        testid="commit-tool-refresh"
      />
      <ToolbarIconButton
        icon={<UndoOutlined />}
        title={t('workbench.commitTool.rollback')}
        disabled
        testid="commit-tool-rollback"
      />
      <ToolbarIconButton
        icon={<VerticalAlignBottomOutlined />}
        title={t('workbench.commitTool.shelve')}
        disabled
        testid="commit-tool-shelve"
      />
      <Dropdown
        trigger={['click']}
        placement="bottomLeft"
        menu={{
          selectable: false,
          items: [
            {
              type: 'group',
              label: t('workbench.gitLog.details.groupBy'),
              children: [
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
            if (key === 'directory') onPatchPrefs({ groupByDirectory: !prefs.groupByDirectory });
            else if (key === 'ignored') onPatchPrefs({ showIgnored: !prefs.showIgnored });
          },
        }}
      >
        <span style={{ display: 'inline-flex' }}>
          <ToolbarIconButton
            icon={<EyeOutlined />}
            title={t('workbench.gitLog.viewOptions')}
            testid="commit-tool-view-options"
          />
        </span>
      </Dropdown>
      <span
        aria-hidden
        style={{ width: 1, height: 16, background: token.colorBorderSecondary, margin: '0 4px', flex: '0 0 auto' }}
      />
      <ToolbarIconButton
        icon={<AimOutlined />}
        title={t('workbench.commitTool.selectOpened')}
        disabled
        testid="commit-tool-select-opened"
      />
      <ToolbarIconButton
        icon={<ColumnHeightOutlined />}
        title={t('workbench.gitLog.expandAll')}
        onClick={onExpandAll}
        testid="commit-tool-expand-all"
      />
      <ToolbarIconButton
        icon={<VerticalAlignMiddleOutlined />}
        title={t('workbench.gitLog.collapseAll')}
        onClick={onCollapseAll}
        testid="commit-tool-collapse-all"
      />
    </div>
  );
};

export default CommitToolbar;
