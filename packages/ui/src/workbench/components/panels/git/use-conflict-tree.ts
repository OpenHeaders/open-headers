/**
 * useConflictTree — the files of a conflicted pass as the workbench's
 * panels list what they belong to (`workspace-file-tree`), read from
 * the same workspace data the panels draw, and the words a part of an
 * entity goes by: the editors' own tab and slot names, "Details" for
 * the entity's manifest.
 *
 * Mounted only while the merge editor is open.
 */

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useLiveVariables } from '@openheaders/ui/shared/hooks/readers/useLiveVariables';
import { useLiveWorkflows } from '@openheaders/ui/shared/hooks/readers/useLiveWorkflows';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import {
  type ListedWorkspaceFile,
  listedWorkspaceFiles,
  type WorkspaceFileEntity,
  type WorkspaceFilePart,
  type WorkspaceFileSection,
  workspaceFileTree,
} from '@openheaders/ui/shared/workspace-files';
import { useMemo } from 'react';
import { SCRIPT_SLOT_BY_KIND } from '../../script-editor/script-slots';

const PART_LABELS: Readonly<Record<'details' | 'body' | 'variables' | 'query' | 'message', MessageKey>> = {
  details: 'workbench.gitLog.resolve.partDetails',
  body: 'workbench.editors.request.tab.body',
  variables: 'workbench.editors.graphql.variables.title',
  query: 'workbench.editors.graphql.tab.query',
  message: 'workbench.editors.grpc.tab.message',
};

function isNamedPart(part: WorkspaceFilePart): part is keyof typeof PART_LABELS {
  return Object.hasOwn(PART_LABELS, part);
}

/** A part as its editor names it; a part with no name of its own goes by its file's. */
export function conflictPartLabel(t: Translate, part: WorkspaceFilePart | null, fileName: string): string {
  if (part === null) return fileName;
  return t(isNamedPart(part) ? PART_LABELS[part] : SCRIPT_SLOT_BY_KIND[part].labelKey);
}

export function conflictEntityName(t: Translate, entity: WorkspaceFileEntity): string {
  if (entity.kind === 'workspace-variables') return t('workbench.sidebar.singleton.workspaceVariables');
  return entity.kind === 'node' ? entity.node.name : entity.name;
}

/** The one line a file goes by outside the tree — its entity, and its part where the entity lists several. */
function fileLabel(t: Translate, file: ListedWorkspaceFile): string {
  if (file.entity === undefined) return file.path;
  const name = conflictEntityName(t, file.entity);
  return file.part === undefined ? name : `${name} · ${conflictPartLabel(t, file.part, file.name)}`;
}

export interface ConflictTree {
  sections: WorkspaceFileSection[];
  /** The conflicted files in listing order. */
  order: string[];
  /** A file's surface and the line it goes by. */
  place(path: string): { section: string; label: string };
}

export function useConflictTree(paths: readonly string[]): ConflictTree {
  const t = useT();
  const { localCollectionTrees, templateCollectionTrees, activeWorkspaceId } = useRules();
  const { collectionTrees } = useRequests();
  const specs = useSpecs(activeWorkspaceId);
  const { workflows } = useLiveWorkflows();
  const { variables } = useLiveVariables();
  const { environments } = useEnvironments();

  return useMemo(() => {
    const sections = workspaceFileTree(paths, {
      ruleCollections: localCollectionTrees,
      templateCollections: templateCollectionTrees,
      requestCollections: collectionTrees,
      specs,
      workflows,
      liveVariables: variables,
      environments,
    });
    const listed = listedWorkspaceFiles(sections);
    const places = new Map(listed.map((file) => [file.path, { section: file.surface, label: fileLabel(t, file) }]));
    return {
      sections,
      order: listed.map((file) => file.path),
      place: (path) => places.get(path) ?? { section: 'files', label: path },
    };
  }, [
    paths,
    localCollectionTrees,
    templateCollectionTrees,
    collectionTrees,
    specs,
    workflows,
    variables,
    environments,
    t,
  ]);
}
