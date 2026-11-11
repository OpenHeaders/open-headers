/**
 * conflict-rail — the merge editor's file rail in the workbench's own
 * words, for a conflicted pass (`commit-file-section` places the files):
 *
 *   - a section is a surface, under the name and the glyph the activity
 *     bar opens it with (`workbench/tool-windows.tsx`) — the Browser
 *     Interceptor, API Requests, Workflows, Variables — and Files for
 *     everything that is the user's own;
 *   - a group of the Variables is a scope, under its name and its
 *     badge (Environments wears the E); any other group is a directory
 *     and wears the folder;
 *   - a file wears its file-type icon, as in the Commit window.
 */

import { SisternodeOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  COMMIT_FILE_SECTIONS,
  type CommitFileSection,
  type CommitVariablesGroup,
} from '@openheaders/ui/shared/conflicts/commit-file-section';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon } from '@openheaders/ui/shared/icons';
import type { MergeRailVocabulary } from '@openheaders/ui/shared/merge-editor';
import { type ScopeKey, scopeBadge } from '../../shared/scope-colors';
import { FileTypeIcon, FolderTypeIcon } from './commit/FileTypeIcon';

const SECTIONS: Readonly<Record<CommitFileSection, { labelKey: MessageKey; icon: React.ReactNode }>> = {
  'http-rules': { labelKey: 'workbench.toolWindows.httpRules', icon: <RequestRulesIcon /> },
  'api-requests': { labelKey: 'workbench.toolWindows.apiRequests', icon: <ApiRequestsIcon /> },
  workflows: { labelKey: 'workbench.toolWindows.workflows', icon: <SisternodeOutlined /> },
  variables: { labelKey: 'workbench.toolWindows.variables', icon: <VariablesIcon /> },
  files: { labelKey: 'workbench.gitLog.resolve.otherFiles', icon: <FolderTypeIcon /> },
};

const VARIABLES_GROUPS: Readonly<Record<CommitVariablesGroup, { labelKey: MessageKey; scope: ScopeKey }>> = {
  environments: { labelKey: 'workbench.shell.breadcrumbs.environments', scope: 'environment' },
  'workspace-variables': { labelKey: 'workbench.shell.breadcrumbs.workspaceVariables', scope: 'workspace' },
  vault: { labelKey: 'workbench.shell.breadcrumbs.vault', scope: 'vault' },
  'live-variables': { labelKey: 'workbench.shell.breadcrumbs.liveVariables', scope: 'live' },
};

function isVariablesGroup(group: string): group is CommitVariablesGroup {
  return Object.hasOwn(VARIABLES_GROUPS, group);
}

export function useConflictRail(): MergeRailVocabulary {
  const t = useT();
  return useMemo(
    () => ({
      sections: COMMIT_FILE_SECTIONS.map((id) => ({ id, label: t(SECTIONS[id].labelKey), icon: SECTIONS[id].icon })),
      group: (section, group) => {
        if (section === 'variables' && isVariablesGroup(group)) {
          const named = VARIABLES_GROUPS[group];
          return { label: t(named.labelKey), icon: scopeBadge(named.scope, 13) };
        }
        return { label: group, icon: <FolderTypeIcon /> };
      },
      fileIcon: (file) => <FileTypeIcon path={file.id} />,
    }),
    [t],
  );
}
