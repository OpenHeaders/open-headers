/**
 * workspace-file-face — how a row of a named file tree
 * (`workspace-file-tree`) reads and is drawn: the section's title as
 * its panel shows it, an entity by its name and its panel's own icon, a
 * part by the word its editor uses ("Details" for the entity's
 * manifest), a file of the user's own by its name and file-type icon.
 */

import { FileTextOutlined, FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type {
  WorkspaceFileEntity,
  WorkspaceFileNode,
  WorkspaceFilePart,
  WorkspaceFileSectionId,
  WorkspaceLeafNode,
} from '@openheaders/ui/shared/workspace-files';
import { type ReactNode, useMemo } from 'react';
import { SCRIPT_SLOT_BY_KIND } from '../../script-editor/script-slots';
import { buildRuleIcon } from '../../shared/rule-icon';
import { scopeBadge } from '../../shared/scope-colors';
import { renderTwoToneIcon } from '../../shared/TwoToneIconPicker';
import { folderTag, graphqlTag, grpcTag, iconEl, methodTag, mqttTag, websocketTag } from '../../sidebar/icons';
import { FileTypeIcon } from './commit/FileTypeIcon';

const SECTION_TITLES: Readonly<Record<WorkspaceFileSectionId, MessageKey>> = {
  rules: 'workbench.sidebar.section.rules',
  templates: 'workbench.sidebar.section.templates',
  requests: 'workbench.sidebar.section.requests',
  specs: 'workbench.sidebar.section.specs',
  workflows: 'workbench.sidebar.section.workflows',
  'workspace-variables': 'workbench.sidebar.section.workspaceVariables',
  'live-variables': 'workbench.sidebar.section.liveVariables',
  environments: 'workbench.sidebar.section.environments',
  files: 'workbench.gitLog.resolve.otherFiles',
};

const PART_LABELS: Readonly<Record<'details' | 'body' | 'variables' | 'query' | 'message', MessageKey>> = {
  details: 'workbench.gitLog.resolve.partDetails',
  body: 'workbench.editors.request.tab.body',
  variables: 'workbench.editors.graphql.variables.title',
  query: 'workbench.editors.graphql.tab.query',
  message: 'workbench.editors.grpc.tab.message',
};

const QUIET = 'var(--ant-color-text-tertiary, #999)';

function isNamedPart(part: WorkspaceFilePart): part is keyof typeof PART_LABELS {
  return Object.hasOwn(PART_LABELS, part);
}

/** A part as its editor names it; a part with no name of its own goes by its file's. */
export function workspaceFilePartLabel(t: Translate, part: WorkspaceFilePart | null, fileName: string): string {
  if (part === null) return fileName;
  return t(isNamedPart(part) ? PART_LABELS[part] : SCRIPT_SLOT_BY_KIND[part].labelKey);
}

export function workspaceFileEntityName(t: Translate, entity: WorkspaceFileEntity): string {
  if (entity.kind === 'workspace-variables') return t('workbench.sidebar.singleton.workspaceVariables');
  return entity.kind === 'node' ? entity.node.name : entity.name;
}

export interface WorkspaceFileFace {
  sectionTitle(id: WorkspaceFileSectionId): string;
  labelOf(node: WorkspaceFileNode): string;
  /** `status` — the file's change, for the file-type icon of a row drawn as a file. */
  iconOf(section: WorkspaceFileSectionId, node: WorkspaceFileNode, status?: string): ReactNode;
}

export function useWorkspaceFileFace(): WorkspaceFileFace {
  const t = useT();
  const { rules } = useRules();

  return useMemo(() => {
    const leafIcon = (node: WorkspaceLeafNode): ReactNode => {
      switch (node.type) {
        case 'request':
          return methodTag(node.method);
        case 'graphql-request':
          return graphqlTag();
        case 'grpc-request':
          return grpcTag();
        case 'websocket-request':
          return websocketTag(node.flavor);
        case 'mqtt-request':
          return mqttTag();
        case 'rule':
          return buildRuleIcon({
            ruleType: node.ruleType,
            rule: rules.find((rule) => rule.uid === node.uid),
            isActive: node.enabled,
          });
        case 'template':
          return renderTwoToneIcon(node.icon, { fontSize: 12 }) || iconEl(FileTextOutlined, QUIET);
      }
    };

    return {
      sectionTitle: (id) => t(SECTION_TITLES[id]),
      labelOf: (node) => {
        if (node.type === 'entity') return workspaceFileEntityName(t, node.entity);
        if (node.type === 'part') return workspaceFilePartLabel(t, node.part, node.name);
        return node.type === 'directory' ? node.path : node.name;
      },
      iconOf: (section, node, status) => {
        if (node.type === 'directory') return iconEl(FolderOutlined, QUIET);
        if (node.type !== 'entity') return <FileTypeIcon path={node.file} status={status} />;
        const { entity } = node;
        switch (entity.kind) {
          case 'collection':
            return iconEl(FolderOpenOutlined, QUIET);
          case 'folder':
            return section === 'requests' ? folderTag(FolderOutlined) : iconEl(FolderOutlined, QUIET);
          case 'node':
            return leafIcon(entity.node);
          case 'spec':
            return iconEl(FileTextOutlined, QUIET);
          case 'workflow':
            return (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: QUIET,
                  marginRight: 2,
                }}
              />
            );
          case 'live-variable':
            return scopeBadge('live');
          case 'environment':
            return scopeBadge('environment');
          case 'workspace-variables':
            return scopeBadge('workspace');
        }
      },
    };
  }, [t, rules]);
}
