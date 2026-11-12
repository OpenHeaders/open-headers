/**
 * conflict-rail — the merge editor's surfaces in the workbench's own
 * words, for a conflicted pass: a section of the editor's strip is a
 * surface, under the name and the glyph the activity bar opens it with
 * (`workbench/tool-windows.tsx`) — the Browser Interceptor, API
 * Requests, Workflows, Variables — and Files for everything that is the
 * user's own. What a surface lists is the files panel's (`ConflictTree`).
 */

import { SisternodeOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { WORKSPACE_FILE_SURFACES, type WorkspaceFileSurface } from '@openheaders/ui/shared/workspace-files';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon } from '@openheaders/ui/shared/icons';
import type { MergeRailVocabulary } from '@openheaders/ui/shared/merge-editor';
import { useMemo } from 'react';
import { FolderTypeIcon } from './commit/FileTypeIcon';

const SURFACES: Readonly<Record<WorkspaceFileSurface, { labelKey: MessageKey; icon: React.ReactNode }>> = {
  'http-rules': { labelKey: 'workbench.toolWindows.httpRules', icon: <RequestRulesIcon /> },
  'api-requests': { labelKey: 'workbench.toolWindows.apiRequests', icon: <ApiRequestsIcon /> },
  workflows: { labelKey: 'workbench.toolWindows.workflows', icon: <SisternodeOutlined /> },
  variables: { labelKey: 'workbench.toolWindows.variables', icon: <VariablesIcon /> },
  files: { labelKey: 'workbench.gitLog.resolve.otherFiles', icon: <FolderTypeIcon /> },
};

export function useConflictRail(): MergeRailVocabulary {
  const t = useT();
  return useMemo(
    () => ({
      sections: WORKSPACE_FILE_SURFACES.map((id) => ({ id, label: t(SURFACES[id].labelKey), icon: SURFACES[id].icon })),
    }),
    [t],
  );
}
