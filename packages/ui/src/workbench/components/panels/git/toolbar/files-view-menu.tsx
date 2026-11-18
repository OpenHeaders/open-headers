/**
 * files-view-menu — the rows every changed-files tree's View Options
 * eye opens with: View Mode — Workspace Items or Files, one of the two
 * — then Group Files by Directory, which shapes the rows that are
 * files (every row under Files; under Workspace Items, the user's own).
 * Pure over (t, view); the eye appends its own rows after these.
 */

import type { MenuProps } from 'antd';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { menuCheckIcon } from '../../../shared/menu-check';
import type { FilesViewMode } from '../files-view-mode';

export interface FilesView {
  mode: FilesViewMode;
  onModeChange: (mode: FilesViewMode) => void;
  groupByDirectory: boolean;
  onGroupByDirectoryChange: (grouped: boolean) => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

const MODE_BY_KEY: ReadonlyMap<string, FilesViewMode> = new Map([
  ['view-mode-items', 'items'],
  ['view-mode-files', 'files'],
]);
const GROUP_BY_DIRECTORY_KEY = 'group-files-by-directory';

export function filesViewMenuItems(t: Translate, view: FilesView): MenuItems {
  return [
    {
      type: 'group',
      label: t('workbench.gitLog.viewMode.heading'),
      children: [
        {
          key: 'view-mode-items',
          label: t('workbench.gitLog.viewMode.items'),
          icon: menuCheckIcon(view.mode === 'items'),
        },
        {
          key: 'view-mode-files',
          label: t('workbench.gitLog.viewMode.files'),
          icon: menuCheckIcon(view.mode === 'files'),
        },
      ],
    },
    { type: 'divider' },
    {
      key: GROUP_BY_DIRECTORY_KEY,
      label: t('workbench.gitLog.details.groupFilesByDirectory'),
      icon: menuCheckIcon(view.groupByDirectory),
    },
  ];
}

/** A pick among the rows above; false for a key that is another row's. */
export function pickFilesViewMenu(key: string, view: FilesView): boolean {
  const mode = MODE_BY_KEY.get(key);
  if (mode !== undefined) {
    view.onModeChange(mode);
    return true;
  }
  if (key === GROUP_BY_DIRECTORY_KEY) {
    view.onGroupByDirectoryChange(!view.groupByDirectory);
    return true;
  }
  return false;
}
