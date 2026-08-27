/**
 * GitWorkspaceCard — the three Git settings pages stacked in one card
 * for the Server Admin console (the git-sync plan §11.5): Folder,
 * Automation and Repository over an injected `transport` that rides
 * the gated `oh.daemon.workspaceTree.dispatch` wire channel — same
 * sections, same verbs, remote daemon. There the native picker is
 * absent (`allowFolderPicker: false`) and the workspace is the
 * console's explicit pick rather than the active one.
 */

import type React from 'react';
import type { WorkspaceTreeTransport } from '../../../components/git/transport';
import GitAutomationSection from './git-automation-section';
import GitFolderSection from './git-folder-section';
import GitRepositorySection from './git-repository-section';
import { useWorkspaceGit } from './use-workspace-git';

export interface GitWorkspaceCardProps {
  transport: WorkspaceTreeTransport;
  workspaceId: string;
  /** False on hosts without a native folder dialog (remote daemon). */
  allowFolderPicker?: boolean;
}

const GitWorkspaceCard: React.FC<GitWorkspaceCardProps> = ({ transport, workspaceId, allowFolderPicker = false }) => {
  const git = useWorkspaceGit(transport, workspaceId);
  const usable = git.gitStatus !== null && git.gitStatus.git.available && git.gitStatus.repo;
  return (
    <div className="settings-card" style={{ padding: '10px 14px 0' }}>
      <GitFolderSection git={git} allowFolderPicker={allowFolderPicker} />
      {usable && (
        <>
          <GitAutomationSection git={git} />
          <GitRepositorySection git={git} />
        </>
      )}
    </div>
  );
};

export default GitWorkspaceCard;
