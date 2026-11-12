/**
 * workspace-file-face — how a row of a named file tree
 * (`workspace-file-tree`) reads and is drawn: the section's title as
 * its panel shows it, an entity by its name and its panel's own icon, a
 * part by the word its editor uses ("Details" for the entity's
 * manifest), a page (the vault, the workspace's variables, the
 * workspace, its trusted certificates) as a header-styled row, a file
 * of the user's own by its name and file-type icon. An entity the
 * workspace no longer holds reads as its commit named it, in its kind's
 * icon.
 */

import {
  AppstoreOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import type {
  FormerEntity,
  WorkspaceFileEntity,
  WorkspaceFileNode,
  WorkspaceFilePage,
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
  vault: 'workbench.sidebar.section.vault',
  'workspace-variables': 'workbench.sidebar.section.workspaceVariables',
  'live-variables': 'workbench.sidebar.section.liveVariables',
  environments: 'workbench.sidebar.section.environments',
  workspace: 'workbench.gitLog.resolve.workspaceFile',
  'trusted-roots': 'workbench.trustedRoots.title',
  files: 'workbench.gitLog.resolve.otherFiles',
};

/** A page by the name its panel — or, for the two no panel shows, this listing — gives it. */
const PAGE_NAMES: Readonly<Record<WorkspaceFilePage, MessageKey>> = {
  vault: 'workbench.sidebar.singleton.vault',
  'workspace-variables': 'workbench.sidebar.singleton.workspaceVariables',
  workspace: 'workbench.gitLog.resolve.workspaceFile',
  'trusted-roots': 'workbench.trustedRoots.title',
};

type NamedPart = 'details' | 'body' | 'variables' | 'query' | 'message' | 'secret-names' | 'secret-values';

const PART_LABELS: Readonly<Record<NamedPart, MessageKey>> = {
  'secret-names': 'workbench.gitLog.resolve.partSecretNames',
  'secret-values': 'workbench.gitLog.resolve.partSecretValues',
  details: 'workbench.gitLog.resolve.partDetails',
  body: 'workbench.editors.request.tab.body',
  variables: 'workbench.editors.graphql.variables.title',
  query: 'workbench.editors.graphql.tab.query',
  message: 'workbench.editors.grpc.tab.message',
};

const QUIET = 'var(--ant-color-text-tertiary, #999)';

const workflowDot = (
  <span
    style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: QUIET, marginRight: 2 }}
  />
);

function isNamedPart(part: WorkspaceFilePart): part is NamedPart {
  return Object.hasOwn(PART_LABELS, part);
}

/** A part as its editor names it; a part with no name of its own goes by its file's. */
export function workspaceFilePartLabel(t: Translate, part: WorkspaceFilePart | null, fileName: string): string {
  if (part === null) return fileName;
  return t(isNamedPart(part) ? PART_LABELS[part] : SCRIPT_SLOT_BY_KIND[part].labelKey);
}

export function workspaceFileEntityName(t: Translate, entity: WorkspaceFileEntity): string {
  if (entity.kind === 'node') return entity.node.name;
  // A manifest may carry no name: its uid is what is left to tell it by.
  if (entity.kind === 'former') return entity.was.name || entity.was.uid;
  return 'name' in entity ? entity.name : t(PAGE_NAMES[entity.kind]);
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

    /** An entity the workspace no longer holds, drawn from what its commit says of it: kind, and a request's method. */
    const formerIcon = (section: WorkspaceFileSectionId, was: FormerEntity): ReactNode => {
      switch (was.kind) {
        case 'collection':
          return iconEl(FolderOpenOutlined, QUIET);
        case 'folder':
          return section === 'requests' ? folderTag(FolderOutlined) : iconEl(FolderOutlined, QUIET);
        case 'request':
          return methodTag(was.method ?? '');
        case 'graphql':
          return graphqlTag();
        case 'grpc':
          return grpcTag();
        case 'websocket':
          return websocketTag('raw');
        case 'mqtt':
          return mqttTag();
        case 'workflow':
          return workflowDot;
        case 'live-variable':
          return scopeBadge('live');
        case 'environment':
          return scopeBadge('environment');
        default:
          return iconEl(FileTextOutlined, QUIET);
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
            return workflowDot;
          case 'former':
            return formerIcon(section, entity.was);
          case 'live-variable':
            return scopeBadge('live');
          case 'environment':
            return scopeBadge('environment');
          case 'vault':
            return scopeBadge('vault');
          case 'workspace-variables':
            return scopeBadge('workspace');
          case 'workspace':
            return iconEl(AppstoreOutlined, QUIET);
          case 'trusted-roots':
            return iconEl(SafetyCertificateOutlined, QUIET);
        }
      },
    };
  }, [t, rules]);
}
