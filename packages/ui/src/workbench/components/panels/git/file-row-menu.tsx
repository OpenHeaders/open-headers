/**
 * file-row-menu — the log's changed-file row right-click menu (the
 * commit details' file tree): Show Diff (the commit's blob pair, or
 * the selected run's range — visible-disabled when the selection has
 * no honest diff), Show History (the path's own timeline — `fileLog`,
 * renames followed), Jump to Source (the entity's editor — live when
 * the surface wires it), then Show Current Revision visible-disabled.
 * Pure over (path, t, handlers).
 */

import { ClockCircleOutlined, EditOutlined, SwapOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { menuLabel } from './git-menu-label';

export interface FileRowMenuHandlers {
  onShowDiff?: (path: string) => void;
  onShowHistory: (path: string) => void;
  onJumpToSource?: (path: string) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

export function buildFileRowMenu(path: string, t: Translate, h: FileRowMenuHandlers): MenuProps {
  const items: MenuItems = [
    {
      key: 'show-diff',
      label: menuLabel(<SwapOutlined />, t('workbench.gitLog.fileMenu.showDiff'), '⌘D', 'git-tool-file-menu-diff'),
      disabled: h.onShowDiff === undefined,
      ...(h.onShowDiff === undefined ? {} : { onClick: () => h.onShowDiff?.(path) }),
    },
    {
      key: 'show-history',
      label: menuLabel(
        <ClockCircleOutlined />,
        t('workbench.gitLog.fileMenu.showHistory'),
        undefined,
        'git-tool-file-menu-history',
      ),
      onClick: () => h.onShowHistory(path),
    },
    { type: 'divider' },
    {
      key: 'current-revision',
      label: menuLabel(null, t('workbench.gitLog.fileMenu.showCurrentRevision')),
      disabled: true,
    },
    {
      key: 'jump-to-source',
      label: menuLabel(
        <EditOutlined />,
        t('workbench.gitLog.fileMenu.jumpToSource'),
        undefined,
        'git-tool-file-menu-jump',
      ),
      disabled: h.onJumpToSource === undefined,
      ...(h.onJumpToSource === undefined ? {} : { onClick: () => h.onJumpToSource?.(path) }),
    },
  ];
  return { items, selectable: false };
}
