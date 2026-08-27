/**
 * Git › Folder — the settings page for the active workspace's on-disk
 * binding (desktop-gated at the category): Binding and Requirements
 * over the local workspace-tree transport with the native folder
 * picker.
 */

import type React from 'react';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { localWorkspaceTreeTransport } from '../../../components/git/transport';
import type { CategoryPaneProps } from '../../types';
import { Pane, PaneHeader } from '../pane-chrome';
import GitFolderSection from './git-folder-section';
import { useWorkspaceGit } from './use-workspace-git';

const GitFolderPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const git = useWorkspaceGit(localWorkspaceTreeTransport, useActiveWorkspaceId());
  return (
    <Pane>
      <PaneHeader category={category} />
      <GitFolderSection git={git} allowFolderPicker />
    </Pane>
  );
};

export default GitFolderPane;
