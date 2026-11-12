/**
 * CommitWorkspaceTree — the Commit tree over the live workspace: each
 * git group's files listed by what they belong to in the workbench
 * (Group By Workspace). The workspace is read here, only while this
 * shape is the one shown. A tracked file the workspace holds no entity
 * for — its entity deleted in the workbench, the change not yet
 * committed — is named from HEAD, which still has its manifest
 * (`use-former-files`), and listed where that entity sat.
 */

import { isEntityTreePath, listedWorkspaceFiles } from '@openheaders/ui/shared/workspace-files';
import { forwardRef, useMemo } from 'react';
import { type CommitFile, useFormerFiles } from '../use-former-files';
import { useListedWorkspace } from '../use-listed-workspace';
import CommitChangesTree, { type CommitChangesTreeHandle, type CommitChangesTreeProps } from './CommitChangesTree';
import { commitNamedGroups } from './commit-named-tree';

export interface CommitWorkspaceTreeProps extends Omit<CommitChangesTreeProps, 'named'> {
  workspaceId: string;
  /** HEAD — the commit a deleted entity's files are named from; null on an unborn branch. */
  headSha: string | null;
}

const CommitWorkspaceTree = forwardRef<CommitChangesTreeHandle, CommitWorkspaceTreeProps>(function CommitWorkspaceTree(
  { workspaceId, headSha, ...tree },
  handleRef,
) {
  const workspace = useListedWorkspace();
  const { groups } = tree;
  const held = useMemo(() => commitNamedGroups(groups, workspace), [groups, workspace]);
  const unnamed = useMemo(() => {
    if (headSha === null) return [];
    return listedWorkspaceFiles(held.get('changes') ?? []).flatMap((file): CommitFile[] =>
      file.entity === undefined && isEntityTreePath(file.path) ? [{ path: file.path, sha: headSha }] : [],
    );
  }, [held, headSha]);
  const former = useFormerFiles(workspaceId, unnamed);
  const named = useMemo(
    () => (former.size === 0 ? held : commitNamedGroups(groups, workspace, former)),
    [held, groups, workspace, former],
  );
  return <CommitChangesTree {...tree} ref={handleRef} named={named} />;
});

export default CommitWorkspaceTree;
