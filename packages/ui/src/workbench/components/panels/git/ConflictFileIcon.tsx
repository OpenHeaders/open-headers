/**
 * ConflictFileIcon — what a file of a conflicted pass is, in the merge
 * editor's file rail: the glyph the activity bar opens its surface with
 * (the Interceptor's for a rule's files, the API Requests' for a
 * request's, the Variables' for an environment, the Workflows' for a
 * workflow — `conflict-file-surface`), and the Commit window's
 * file-type icon for any other file.
 */

import { SisternodeOutlined } from '@ant-design/icons';
import type React from 'react';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon } from '@openheaders/ui/shared/icons';
import { FileTypeIcon } from './commit/FileTypeIcon';
import { type ConflictFileSurface, conflictFileSurface } from './conflict-file-surface';

/** The icons `workbench/tool-windows.tsx` registers these surfaces with. */
const SURFACE_ICONS: Readonly<Record<ConflictFileSurface, React.ReactElement>> = {
  'http-rules': <RequestRulesIcon />,
  'api-requests': <ApiRequestsIcon />,
  variables: <VariablesIcon />,
  workflows: <SisternodeOutlined />,
};

export const ConflictFileIcon: React.FC<{ path: string }> = ({ path }) => {
  const surface = conflictFileSurface(path);
  return (
    <span data-testid="git-tool-conflict-file-icon" data-surface={surface ?? 'file'} style={{ display: 'inline-flex' }}>
      {surface !== null ? SURFACE_ICONS[surface] : <FileTypeIcon path={path} />}
    </span>
  );
};
