/**
 * FilesViewModeSwitch — the View Mode where it is seen without opening
 * anything: two buttons side by side, Workspace | Files, the one
 * in force held pressed. The same choice the View Options eye opens
 * with (`files-view-menu`). In a pane's band it is ONE entry — it
 * folds whole.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { FilesIcon, WorkspaceItemsIcon } from '@openheaders/ui/shared/icons';
import type React from 'react';
import type { FilesViewMode } from '../files-view-mode';
import ToolbarIconButton from './ToolbarIconButton';

export interface FilesViewModeSwitchProps {
  mode: FilesViewMode;
  onChange: (mode: FilesViewMode) => void;
  /** The pair's testid; its buttons are `<testid>-items` and `<testid>-files`. */
  testid: string;
}

const FilesViewModeSwitch: React.FC<FilesViewModeSwitchProps> = ({ mode, onChange, testid }) => {
  const t = useT();
  return (
    <span
      role="group"
      aria-label={t('workbench.gitLog.viewMode.heading')}
      style={{ display: 'inline-flex', flex: '0 0 auto' }}
      data-testid={testid}
      data-mode={mode}
    >
      <ToolbarIconButton
        icon={<WorkspaceItemsIcon />}
        title={t('workbench.gitLog.viewMode.tooltip', { mode: t('workbench.gitLog.viewMode.workspace') })}
        active={mode === 'items'}
        onClick={() => onChange('items')}
        testid={`${testid}-items`}
      />
      <ToolbarIconButton
        icon={<FilesIcon />}
        title={t('workbench.gitLog.viewMode.tooltip', { mode: t('workbench.gitLog.viewMode.files') })}
        active={mode === 'files'}
        onClick={() => onChange('files')}
        testid={`${testid}-files`}
      />
    </span>
  );
};

export default FilesViewModeSwitch;
