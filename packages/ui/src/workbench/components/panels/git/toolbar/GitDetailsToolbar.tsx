/**
 * GitDetailsToolbar — the changes pane's top band (IDE reference):
 * Show Diff for the selected file, Revert Selected Changes (visible
 * placeholder — the write verb is a future slice), the View Options
 * eye (Group By Directory, Show Details, Show Diff Preview), then
 * Expand All / Collapse All at the far edge driving the files tree.
 */

import { ArrowsAltOutlined, EyeOutlined, ShrinkOutlined, SwapOutlined, UndoOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { GitLogViewPrefs } from '../git-log-view-prefs';
import { menuCheckIcon } from './menu-check';
import ToolbarIconButton from './ToolbarIconButton';

export interface GitDetailsToolbarProps {
  /** A file row is selected — Show Diff enables. */
  canShowDiff: boolean;
  onShowDiff: () => void;
  prefs: GitLogViewPrefs;
  onPatchPrefs: (patch: Partial<GitLogViewPrefs>) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const GitDetailsToolbar: React.FC<GitDetailsToolbarProps> = ({
  canShowDiff,
  onShowDiff,
  prefs,
  onPatchPrefs,
  onExpandAll,
  onCollapseAll,
}) => {
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
      data-testid="git-tool-details-toolbar"
    >
      <ToolbarIconButton
        icon={<SwapOutlined />}
        title={t('workbench.gitLog.details.showDiff')}
        onClick={onShowDiff}
        disabled={!canShowDiff}
        testid="git-tool-details-diff"
      />
      <ToolbarIconButton
        icon={<UndoOutlined />}
        title={t('workbench.gitLog.details.revertSelected')}
        disabled
        testid="git-tool-details-revert"
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
                  icon: menuCheckIcon(prefs.groupFilesByDirectory),
                },
              ],
            },
            { type: 'divider' },
            {
              type: 'group',
              label: t('workbench.gitLog.details.layout'),
              children: [
                {
                  key: 'show-details',
                  label: t('workbench.gitLog.details.showDetails'),
                  icon: menuCheckIcon(prefs.showDetails),
                },
                {
                  key: 'diff-preview',
                  label: t('workbench.gitLog.details.showDiffPreview'),
                  icon: menuCheckIcon(false),
                  disabled: true,
                },
              ],
            },
          ],
          onClick: ({ key }) => {
            if (key === 'directory') onPatchPrefs({ groupFilesByDirectory: !prefs.groupFilesByDirectory });
            else if (key === 'show-details') onPatchPrefs({ showDetails: !prefs.showDetails });
          },
        }}
      >
        <span style={{ display: 'inline-flex' }}>
          <ToolbarIconButton
            icon={<EyeOutlined />}
            title={t('workbench.gitLog.viewOptions')}
            testid="git-tool-details-view-options"
          />
        </span>
      </Dropdown>
      <span style={{ flex: 1 }} />
      <ToolbarIconButton
        icon={<ArrowsAltOutlined />}
        title={t('workbench.gitLog.expandAll')}
        onClick={onExpandAll}
        testid="git-tool-files-expand-all"
      />
      <ToolbarIconButton
        icon={<ShrinkOutlined />}
        title={t('workbench.gitLog.collapseAll')}
        onClick={onCollapseAll}
        testid="git-tool-files-collapse-all"
      />
    </div>
  );
};

export default GitDetailsToolbar;
