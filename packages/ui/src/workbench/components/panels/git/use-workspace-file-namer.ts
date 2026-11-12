/**
 * useWorkspaceFileNamer — a file of the workspace's tree by the one
 * line it goes by on its own, outside any tree: the entity it belongs
 * to as the workbench names it, and — for any file but the entity's own
 * details — the part of the entity it holds ("Create Order · Body"); a
 * page by its name; a file of the user's own, or one whose entity the
 * workspace does not hold, by its path.
 *
 * A file named alone is its entity's one listed file: the listing
 * keeps its part unless it is the entity's details
 * (`workspace-file-tree`).
 *
 * Mounted only by what is shown while it names — it reads the workspace.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { listedWorkspaceFiles, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { useCallback } from 'react';
import { useListedWorkspace } from './use-listed-workspace';
import { workspaceFileLine } from './workspace-file-face';

export function useWorkspaceFileNamer(): (path: string) => string {
  const t = useT();
  const workspace = useListedWorkspace();
  return useCallback(
    (path) => {
      const [file] = listedWorkspaceFiles(workspaceFileTree([path], workspace));
      return file === undefined ? path : workspaceFileLine(t, file);
    },
    [workspace, t],
  );
}
