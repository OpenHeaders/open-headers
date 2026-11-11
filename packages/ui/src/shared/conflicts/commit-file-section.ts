/**
 * commit-file-section — where a file of a conflicted pass is listed:
 * the section is the workbench surface the file belongs to, by the
 * tree's own conventions (`classifyTreePath`), and the group is its
 * place within that surface.
 *
 *   - a rule's files are the Interceptor's and a request's of any
 *     protocol the API Requests', grouped by the entity's directory
 *     under its tree (`rules/…`, `requests/…` — the root is the section
 *     itself and is left out); a collection or a folder follows the
 *     tree it sits in;
 *   - an environment, the workspace's variables, the vault and a live
 *     variable are the Variables', each under its own named group;
 *   - a workflow is the Workflows', grouped by its directory;
 *   - any other file — one of the user's own, a template, a spec, the
 *     workspace manifest — is listed under Files by its directory.
 */

import { classifyTreePath, ENVIRONMENTS_DIR, type WorkspaceTreeEntityKind } from '@openheaders/core/workspace-tree';

export type CommitFileSection = 'http-rules' | 'api-requests' | 'workflows' | 'variables' | 'files';

/** The sections in listing order — the activity bar's own, the user's files last. */
export const COMMIT_FILE_SECTIONS: readonly CommitFileSection[] = [
  'http-rules',
  'api-requests',
  'workflows',
  'variables',
  'files',
];

/** The Variables section's groups — names, not paths. */
export type CommitVariablesGroup = 'environments' | 'workspace-variables' | 'vault' | 'live-variables';

export interface CommitFilePlace {
  section: CommitFileSection;
  /** A directory path, one of the Variables groups, or `''` at a section's root. */
  group: string;
}

const VARIABLES_GROUP_OF_KIND: Readonly<Partial<Record<WorkspaceTreeEntityKind, CommitVariablesGroup>>> = {
  environment: 'environments',
  'workspace-variables': 'workspace-variables',
  vault: 'vault',
  'live-variable': 'live-variables',
};

const REQUEST_KINDS: ReadonlySet<WorkspaceTreeEntityKind> = new Set([
  'request',
  'grpc',
  'websocket',
  'mqtt',
  'graphql',
]);

function dirOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

/** A directory with its first segment — the tree's root — left out. */
function underRoot(dir: string): string {
  const cut = dir.indexOf('/');
  return cut === -1 ? '' : dir.slice(cut + 1);
}

export function commitFilePlace(path: string): CommitFilePlace {
  const dir = dirOf(path);
  // An environment's secret template sits beside it and classifies as no entity.
  if (dir === ENVIRONMENTS_DIR) return { section: 'variables', group: 'environments' };
  const classed = classifyTreePath(path);
  const candidate =
    classed.kind === 'manifest' ? classed.candidate : classed.kind === 'sibling' ? classed.candidates[0] : undefined;
  if (candidate === undefined) return { section: 'files', group: dir };
  // A sibling's entity is not known from its path, and a collection or a folder has none — the tree places all three.
  if (classed.kind === 'sibling' || candidate.kind === 'collection' || candidate.kind === 'folder') {
    if (candidate.tree === 'rules') return { section: 'http-rules', group: underRoot(dir) };
    if (candidate.tree === 'requests') return { section: 'api-requests', group: underRoot(dir) };
    return { section: 'files', group: dir };
  }
  if (candidate.kind === 'rule') return { section: 'http-rules', group: underRoot(dir) };
  if (REQUEST_KINDS.has(candidate.kind)) return { section: 'api-requests', group: underRoot(dir) };
  if (candidate.kind === 'workflow') return { section: 'workflows', group: dir };
  const variables = VARIABLES_GROUP_OF_KIND[candidate.kind];
  if (variables !== undefined) return { section: 'variables', group: variables };
  return { section: 'files', group: dir };
}
