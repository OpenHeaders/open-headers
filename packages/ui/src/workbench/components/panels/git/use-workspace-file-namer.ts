/**
 * useWorkspaceFileNamer — a file of the workspace's tree by the one
 * line it goes by on its own, outside any tree: the entity it belongs
 * to as the workbench names it, and — for any file but the entity's own
 * details — the part of the entity it holds ("Create Order · Body"); a
 * page by its name; a file of the user's own, or one whose entity the
 * workspace does not hold, by its path.
 *
 * A file named alone cannot lean on its siblings being listed beside
 * it, so the part is read off the file itself (`workspaceFilePartAt`).
 *
 * Mounted only by what is shown while it names — it reads the workspace.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { listedWorkspaceFiles, workspaceFilePartAt, workspaceFileTree } from '@openheaders/ui/shared/workspace-files';
import { useCallback } from 'react';
import { useListedWorkspace } from './use-listed-workspace';
import { workspaceFileEntityName, workspaceFilePartLabel } from './workspace-file-face';

export function useWorkspaceFileNamer(): (path: string) => string {
  const t = useT();
  const workspace = useListedWorkspace();
  return useCallback(
    (path) => {
      const [file] = listedWorkspaceFiles(workspaceFileTree([path], workspace));
      if (file?.entity === undefined) return path;
      const name = workspaceFileEntityName(t, file.entity);
      const part = workspaceFilePartAt(path);
      return part === undefined || part === 'details'
        ? name
        : `${name} · ${workspaceFilePartLabel(t, part, file.name)}`;
    },
    [workspace, t],
  );
}
