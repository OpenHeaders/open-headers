/**
 * Git › Log — the settings page for the shown workspace's Git tool
 * window display preferences (desktop-gated at the category): the
 * commit list, the changed files and the console, over the window's
 * own per-workspace stores.
 */

import type React from 'react';
import { localWorkspaceTreeTransport } from '../../../components/git/transport';
import { useWorkbenchEditingScopeWorkspaceId } from '../../../hooks/EditingScopeWorkspaceContext';
import type { CategoryPaneProps } from '../../types';
import { Pane, PaneHeader } from '../pane-chrome';
import GitLogSection from './git-log-section';
import { useWorkspaceGit } from './use-workspace-git';

const GitLogPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const git = useWorkspaceGit(localWorkspaceTreeTransport, useWorkbenchEditingScopeWorkspaceId());
  return (
    <Pane>
      <PaneHeader category={category} />
      <GitLogSection git={git} />
    </Pane>
  );
};

export default GitLogPane;
