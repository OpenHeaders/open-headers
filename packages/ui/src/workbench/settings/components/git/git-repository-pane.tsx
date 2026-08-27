/**
 * Git › Repository — the settings page for operating the active
 * workspace's bound repository (desktop-gated at the category) over
 * the local workspace-tree transport.
 */

import type React from 'react';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { localWorkspaceTreeTransport } from '../../../components/git/transport';
import type { CategoryPaneProps } from '../../types';
import { Pane, PaneHeader } from '../pane-chrome';
import GitRepositorySection from './git-repository-section';
import { useWorkspaceGit } from './use-workspace-git';

const GitRepositoryPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const git = useWorkspaceGit(localWorkspaceTreeTransport, useActiveWorkspaceId());
  return (
    <Pane>
      <PaneHeader category={category} />
      <GitRepositorySection git={git} />
    </Pane>
  );
};

export default GitRepositoryPane;
