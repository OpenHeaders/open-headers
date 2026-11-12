/**
 * NamedFileTitle — a dialog's title over one file of the workspace's
 * tree, the file named as the workbench names it
 * (`use-workspace-file-namer`) — "Diff — Create Order · Body" — a file
 * of the user's own by its path. The path itself stays on the title's
 * hover.
 *
 * Mounted with its dialog: it reads the workspace only while that is
 * open.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type React from 'react';
import { useWorkspaceFileNamer } from './use-workspace-file-namer';

export interface NamedFileTitleProps {
  messageKey: 'workbench.gitLog.diff.title' | 'workbench.gitLog.fileHistory.title';
  path: string;
}

const NamedFileTitle: React.FC<NamedFileTitleProps> = ({ messageKey, path }) => {
  const t = useT();
  const nameOf = useWorkspaceFileNamer();
  return <span title={path}>{t(messageKey, { path: nameOf(path) })}</span>;
};

export default NamedFileTitle;
