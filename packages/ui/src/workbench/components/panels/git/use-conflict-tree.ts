/**
 * useConflictTree — the files of a conflicted pass as the workbench's
 * panels list what they belong to (`workspace-file-tree`), in listing
 * order, each with the surface it sits under and the one line it goes
 * by outside the tree.
 *
 * Mounted only while the merge editor is open.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  listedWorkspaceFiles,
  type WorkspaceFileSection,
  workspaceFileTree,
} from '@openheaders/ui/shared/workspace-files';
import { useMemo } from 'react';
import { useListedWorkspace } from './use-listed-workspace';
import { workspaceFileLine } from './workspace-file-face';

export interface ConflictTree {
  sections: WorkspaceFileSection[];
  /** The conflicted files in listing order. */
  order: string[];
  /** A file's surface and the line it goes by. */
  place(path: string): { section: string; label: string };
}

export function useConflictTree(paths: readonly string[]): ConflictTree {
  const t = useT();
  const workspace = useListedWorkspace();

  return useMemo(() => {
    const sections = workspaceFileTree(paths, workspace);
    const listed = listedWorkspaceFiles(sections);
    const places = new Map(
      listed.map((file) => [file.path, { section: file.surface, label: workspaceFileLine(t, file) }]),
    );
    return {
      sections,
      order: listed.map((file) => file.path),
      place: (path) => places.get(path) ?? { section: 'files', label: path },
    };
  }, [paths, workspace, t]);
}
