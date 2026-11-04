/**
 * GitDetailsToolbar — the changes pane's top band (the Git window's
 * details and the Push window's files): Show Diff for the selected
 * file, Revert Selected Changes (visible placeholder — the write verb
 * is a future slice), the View Options eye (Group By Directory, Show
 * Details, Show Diff Preview), Jump to Source for the selected file
 * when the host offers it, then Expand All / Collapse All at the far
 * edge driving the files tree.
 */

import { EditOutlined, EyeOutlined, SwapOutlined } from '@ant-design/icons';
import { Dropdown, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon, RollbackIcon } from '@openheaders/ui/shared/icons';
import type { GitLogViewPrefs } from '../git-log-view-prefs';
import { menuCheckIcon } from '../../../shared/menu-check';
import ToolbarIconButton from './ToolbarIconButton';

export interface GitDetailsToolbarProps {
  /** A file row is selected — Show Diff enables. */
  canShowDiff: boolean;
  onShowDiff: () => void;
  /** Jump to Source for the selected file — absent surfaces carry no button. */
  onJumpToSource?: () => void;
  canJumpToSource?: boolean;
  prefs: GitLogViewPrefs;
  onPatchPrefs: (patch: Partial<GitLogViewPrefs>) => void;
  /** A files tree is mounted — Expand All / Collapse All enable; with
   *  no commit selected the pane shows its placeholder and both hold. */
  hasFiles: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

const GitDetailsToolbar: React.FC<GitDetailsToolbarProps> = ({
  canShowDiff,
  onShowDiff,
  onJumpToSource,
  canJumpToSource = false,
  prefs,
  onPatchPrefs,
  hasFiles,
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
        icon={<RollbackIcon />}
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
      {onJumpToSource !== undefined && (
        <ToolbarIconButton
          icon={<EditOutlined />}
          title={t('workbench.gitLog.fileMenu.jumpToSource')}
          onClick={onJumpToSource}
          disabled={!canJumpToSource}
          testid="git-tool-details-jump"
        />
      )}
      <span style={{ flex: 1 }} />
      <ToolbarIconButton
        icon={<ExpandAllIcon />}
        title={t('workbench.gitLog.expandAll')}
        onClick={onExpandAll}
        disabled={!hasFiles}
        testid="git-tool-files-expand-all"
      />
      <ToolbarIconButton
        icon={<CollapseAllIcon />}
        title={t('workbench.gitLog.collapseAll')}
        onClick={onCollapseAll}
        disabled={!hasFiles}
        testid="git-tool-files-collapse-all"
      />
    </div>
  );
};

export default GitDetailsToolbar;
