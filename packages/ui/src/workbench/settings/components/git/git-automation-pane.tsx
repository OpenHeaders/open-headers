/**
 * Git › Automation — the settings page for the shown workspace's
 * commit cadence, hook bypass and push-after-commit (desktop-gated at
 * the category) over the local workspace-tree transport.
 */

import type React from 'react';
import { localWorkspaceTreeTransport } from '../../../components/git/transport';
import { useWorkbenchEditingScopeWorkspaceId } from '../../../hooks/EditingScopeWorkspaceContext';
import type { CategoryPaneProps } from '../../types';
import { Pane, PaneHeader } from '../pane-chrome';
import GitAutomationSection from './git-automation-section';
import { useWorkspaceGit } from './use-workspace-git';

const GitAutomationPane: React.FC<CategoryPaneProps> = ({ category }) => {
  const git = useWorkspaceGit(localWorkspaceTreeTransport, useWorkbenchEditingScopeWorkspaceId());
  return (
    <Pane>
      <PaneHeader category={category} />
      <GitAutomationSection git={git} />
    </Pane>
  );
};

export default GitAutomationPane;
