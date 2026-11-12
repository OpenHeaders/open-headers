/**
 * workspace-file-tree — files of the workspace's tree, listed as the
 * workbench lists what they belong to: by surface (the Browser
 * Interceptor, API Requests, Workflows, Variables — and Files for
 * everything that is the user's own), by the section a surface's panel
 * shows it under (RULES, TEMPLATES, REQUESTS, SPECS, …), then down the
 * collections and folders to the entity, in the panel's own order.
 *
 * A file is matched to its entity by its path: every entity of the tree
 * owns a directory whose name ends in its uid, an environment files
 * whose name does. What the workspace keeps in one file of its own — the
 * vault, its variables, the workspace itself (its name and the order of
 * its collections), its trusted certificates — is a page: a section
 * that is one row. An entity's
 * directory keeps its name through a rename and changes place on a
 * move, so a file under a directory no entity is at now is its
 * entity's by that uid — where it was before a move. Only what holds a
 * listed file is listed, with the containers above it, and every file
 * exactly once.
 *
 *   - an entity with one file is the row that stands for it;
 *   - one with several lists them under it by the part of the entity
 *     each holds (its details, its body, a script), a part with no name
 *     of its own by its file name;
 *   - a collection or a folder lists its own parts ahead of what it
 *     holds;
 *   - an environment lists its secrets' names (the committed template)
 *     and their values (the ignored file) as parts beside its details;
 *   - a file no entity owns is listed under Files by its directory.
 *
 * Pure data: the names and the glyphs are the caller's.
 */

import { type ScriptKind, scriptKindOfFile } from '@openheaders/core/scripts';
import type { TreeNode as CoreTreeNode, FolderNode } from '@openheaders/core/types';
import { extractUid, isUid } from '@openheaders/core/utils';
import {
  ENTITY_MANIFEST_FILES,
  ENVIRONMENTS_DIR,
  SECRET_FILE_SUFFIX,
  SECRET_TEMPLATE_FILE_SUFFIX,
  TRUSTED_ROOTS_FILE,
  VAULT_FILE,
  WORKSPACE_MANIFEST_FILE,
  WORKSPACE_VARS_FILE,
} from '@openheaders/core/workspace-tree';

export type WorkspaceFileSurface = 'http-rules' | 'api-requests' | 'workflows' | 'variables' | 'files';

/** The surfaces in listing order — the activity bar's own, the user's files last. */
export const WORKSPACE_FILE_SURFACES: readonly WorkspaceFileSurface[] = [
  'http-rules',
  'api-requests',
  'workflows',
  'variables',
  'files',
];

/** What the workspace keeps in one file of its own — a section that is one row. */
export type WorkspaceFilePage = 'vault' | 'workspace-variables' | 'workspace' | 'trusted-roots';

export type WorkspaceFileSectionId =
  | 'rules'
  | 'templates'
  | 'requests'
  | 'specs'
  | 'workflows'
  | 'live-variables'
  | 'environments'
  | WorkspaceFilePage
  | 'files';

const PAGE_FILES: Readonly<Record<WorkspaceFilePage, string>> = {
  vault: VAULT_FILE,
  'workspace-variables': WORKSPACE_VARS_FILE,
  workspace: WORKSPACE_MANIFEST_FILE,
  'trusted-roots': TRUSTED_ROOTS_FILE,
};

export function isWorkspaceFilePage(id: WorkspaceFileSectionId): id is WorkspaceFilePage {
  return Object.hasOwn(PAGE_FILES, id);
}

/**
 * The sections in listing order, each under the surface whose panel
 * shows it; the two pages no panel shows — the workspace and its
 * trusted certificates — sit with the user's own files, ahead of them.
 */
const SECTIONS: ReadonlyArray<readonly [WorkspaceFileSectionId, WorkspaceFileSurface]> = [
  ['rules', 'http-rules'],
  ['templates', 'http-rules'],
  ['requests', 'api-requests'],
  ['specs', 'api-requests'],
  ['workflows', 'workflows'],
  ['vault', 'variables'],
  ['workspace-variables', 'variables'],
  ['live-variables', 'variables'],
  ['environments', 'variables'],
  ['workspace', 'files'],
  ['trusted-roots', 'files'],
  ['files', 'files'],
];

/** The part of an entity one of its files holds. */
export type WorkspaceFilePart =
  | 'details'
  | 'body'
  | 'variables'
  | 'query'
  | 'message'
  | 'secret-names'
  | 'secret-values'
  | ScriptKind;

export type WorkspaceLeafNode = Exclude<CoreTreeNode, FolderNode>;

/** What a row stands for — enough for the caller to name and draw it as its panel does. */
export type WorkspaceFileEntity =
  | { kind: 'collection' | 'folder'; uid: string; name: string }
  | { kind: 'node'; node: WorkspaceLeafNode }
  | { kind: 'spec' | 'workflow' | 'live-variable' | 'environment'; uid: string; name: string }
  | { kind: WorkspaceFilePage };

export type WorkspaceFileNode =
  /** `file` set: the row stands for that file. Otherwise its parts and what it holds are under it. */
  | { type: 'entity'; id: string; entity: WorkspaceFileEntity; file?: string; children: WorkspaceFileNode[] }
  /** One file of an entity that lists several; `part` null = named by its file. */
  | { type: 'part'; id: string; part: WorkspaceFilePart | null; name: string; file: string }
  | { type: 'directory'; id: string; path: string; children: WorkspaceFileNode[] }
  | { type: 'file'; id: string; name: string; file: string };

type PartNode = Extract<WorkspaceFileNode, { type: 'part' }>;

export interface WorkspaceFileSection {
  id: WorkspaceFileSectionId;
  surface: WorkspaceFileSurface;
  nodes: WorkspaceFileNode[];
}

interface Listed {
  uid: string;
  name: string;
  path: string;
}

interface CollectionOfNodes extends Listed {
  tree: readonly CoreTreeNode[];
}

/** The workspace as its panels list it. */
export interface ListedWorkspace {
  ruleCollections: readonly CollectionOfNodes[];
  templateCollections: readonly CollectionOfNodes[];
  requestCollections: readonly CollectionOfNodes[];
  specs: readonly Listed[];
  workflows: readonly Listed[];
  liveVariables: readonly Listed[];
  environments: ReadonlyArray<{ uid: string; name: string }>;
}

/** One file where the tree lists it. */
export interface ListedWorkspaceFile {
  path: string;
  surface: WorkspaceFileSurface;
  /** The entity the file belongs to; absent for one of the user's own files. */
  entity?: WorkspaceFileEntity;
  /** Set when the entity lists several files: this one's part, null = named by its file. */
  part?: WorkspaceFilePart | null;
  /** The file's name. */
  name: string;
}

function split(path: string): { dir: string; name: string } {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut), name: path.slice(cut + 1) };
}

const nameOf = (path: string): string => split(path).name;

const rootOf = (path: string): string => path.slice(0, Math.max(path.indexOf('/'), 0));

/** The uid a directory's or a file's `<slug>-<uid>` name ends in. */
function uidOf(name: string): string | null {
  const uid = extractUid(name);
  return isUid(uid) ? uid : null;
}

/** The part a file of an entity's directory holds, by the name its codec writes it under. */
export function workspaceFilePartOf(fileName: string): WorkspaceFilePart | null {
  if (ENTITY_MANIFEST_FILES.has(fileName)) return 'details';
  const script = scriptKindOfFile(fileName);
  if (script !== null) return script;
  if (/^body\.\w+$/.test(fileName)) return 'body';
  if (fileName === 'variables.json') return 'variables';
  if (fileName === 'query.graphql') return 'query';
  if (/^(message|payload)\.(json|txt)$/.test(fileName)) return 'message';
  return null;
}

/** An environment's parts in listing order. */
const ENVIRONMENT_PARTS: readonly WorkspaceFilePart[] = ['details', 'secret-names', 'secret-values'];

/** What a file of the environments directory holds, and the `<slug>-<uid>` stem of its name. */
function environmentFile(name: string): { part: WorkspaceFilePart; stem: string } | null {
  const held = (suffix: string, part: WorkspaceFilePart) =>
    name.endsWith(suffix) ? { part, stem: name.slice(0, -suffix.length) } : null;
  return (
    held(SECRET_TEMPLATE_FILE_SUFFIX, 'secret-names') ??
    held(SECRET_FILE_SUFFIX, 'secret-values') ??
    held('.yaml', 'details')
  );
}

function partNode(file: string, part: WorkspaceFilePart | null): PartNode {
  return { type: 'part', id: file, part, name: nameOf(file), file };
}

/** An entity's own files as rows: the details first, then by name. */
function partsOf(files: readonly string[]): PartNode[] {
  return files
    .map((file) => ({ file, name: nameOf(file), part: workspaceFilePartOf(nameOf(file)) }))
    .sort(
      (a, b) =>
        Number(b.part === 'details') - Number(a.part === 'details') ||
        a.name.localeCompare(b.name) ||
        a.file.localeCompare(b.file),
    )
    .map(({ file, part }) => partNode(file, part));
}

/** An entity's row: the file itself when it is all there is, its parts and what it holds otherwise. */
function entityNode(
  id: string,
  entity: WorkspaceFileEntity,
  parts: PartNode[],
  held: WorkspaceFileNode[],
): WorkspaceFileNode | null {
  if (parts.length === 0 && held.length === 0) return null;
  if (parts.length === 1 && held.length === 0) return { type: 'entity', id, entity, file: parts[0].file, children: [] };
  return { type: 'entity', id, entity, children: [...parts, ...held] };
}

/** Every directory an entity of the workspace is at. */
function entityDirectories(workspace: ListedWorkspace): Set<string> {
  const dirs = new Set<string>();
  const walk = (nodes: readonly CoreTreeNode[]): void => {
    for (const node of nodes) {
      dirs.add(node.path);
      if (node.type === 'folder') walk(node.children);
    }
  };
  for (const collection of [
    ...workspace.ruleCollections,
    ...workspace.templateCollections,
    ...workspace.requestCollections,
  ]) {
    dirs.add(collection.path);
    walk(collection.tree);
  }
  for (const item of [...workspace.specs, ...workspace.workflows, ...workspace.liveVariables]) dirs.add(item.path);
  return dirs;
}

export function workspaceFileTree(paths: readonly string[], workspace: ListedWorkspace): WorkspaceFileSection[] {
  const left = new Set(paths);
  const byDir = new Map<string, string[]>();
  for (const path of left) {
    const { dir } = split(path);
    const files = byDir.get(dir);
    if (files) files.push(path);
    else byDir.set(dir, [path]);
  }

  /** Where an entity was before a move: the directories no entity is at now, by the uid their name ends in. */
  const formerByUid = new Map<string, string[]>();
  const at = entityDirectories(workspace);
  for (const dir of byDir.keys()) {
    if (dir === '' || at.has(dir)) continue;
    const uid = uidOf(nameOf(dir));
    if (uid === null) continue;
    const dirs = formerByUid.get(uid);
    if (dirs) dirs.push(dir);
    else formerByUid.set(uid, [dir]);
  }

  /** A directory's listed files — taken, so no other row lists them. */
  const take = (dir: string): string[] => {
    const files = byDir.get(dir) ?? [];
    byDir.delete(dir);
    for (const file of files) left.delete(file);
    return files;
  };

  /** An entity's listed files: those in its directory, and in one it left by a move within its tree. */
  const claim = (entity: { uid: string; path: string }): PartNode[] => {
    const files = entity.path === '' ? [] : take(entity.path);
    for (const dir of formerByUid.get(entity.uid) ?? []) {
      if (rootOf(dir) === rootOf(entity.path)) files.push(...take(dir));
    }
    return partsOf(files);
  };

  const walk = (section: WorkspaceFileSectionId, nodes: readonly CoreTreeNode[]): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const node of nodes) {
      const id = `${section}:${node.uid}`;
      const built =
        node.type === 'folder'
          ? entityNode(
              id,
              { kind: 'folder', uid: node.uid, name: node.name },
              claim(node),
              walk(section, node.children),
            )
          : entityNode(id, { kind: 'node', node }, claim(node), []);
      if (built !== null) out.push(built);
    }
    return out;
  };

  const collections = (section: WorkspaceFileSectionId, listed: readonly CollectionOfNodes[]): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const collection of listed) {
      const built = entityNode(
        `${section}:${collection.uid}`,
        { kind: 'collection', uid: collection.uid, name: collection.name },
        claim(collection),
        walk(section, collection.tree),
      );
      if (built !== null) out.push(built);
    }
    return out;
  };

  const flat = (
    section: WorkspaceFileSectionId,
    kind: 'spec' | 'workflow' | 'live-variable',
    listed: readonly Listed[],
  ): WorkspaceFileNode[] => {
    const out: WorkspaceFileNode[] = [];
    for (const item of listed) {
      const built = entityNode(`${section}:${item.uid}`, { kind, uid: item.uid, name: item.name }, claim(item), []);
      if (built !== null) out.push(built);
    }
    return out;
  };

  /**
   * An environment's files by its uid — its document under any name it
   * has had, then its secrets' names (the template), then their values.
   */
  const environmentFiles = (): Map<string, PartNode[]> => {
    const byUid = new Map<string, PartNode[]>();
    const files = (byDir.get(ENVIRONMENTS_DIR) ?? [])
      .flatMap((file) => {
        const name = nameOf(file);
        const held = environmentFile(name);
        const uid = held === null ? null : uidOf(held.stem);
        return held === null || uid === null ? [] : [{ file, name, part: held.part, uid }];
      })
      .sort(
        (a, b) => ENVIRONMENT_PARTS.indexOf(a.part) - ENVIRONMENT_PARTS.indexOf(b.part) || a.name.localeCompare(b.name),
      );
    for (const { file, part, uid } of files) {
      const node = partNode(file, part);
      const nodes = byUid.get(uid);
      if (nodes) nodes.push(node);
      else byUid.set(uid, [node]);
    }
    return byUid;
  };

  /** A page's row, when its file is listed. */
  const page = (kind: WorkspaceFilePage) => (): WorkspaceFileNode[] => {
    const file = PAGE_FILES[kind];
    if (!left.delete(file)) return [];
    return [{ type: 'entity', id: kind, entity: { kind }, file, children: [] }];
  };

  const nodesOf: Record<WorkspaceFileSectionId, () => WorkspaceFileNode[]> = {
    rules: () => collections('rules', workspace.ruleCollections),
    templates: () => collections('templates', workspace.templateCollections),
    requests: () => collections('requests', workspace.requestCollections),
    specs: () => flat('specs', 'spec', workspace.specs),
    workflows: () => flat('workflows', 'workflow', workspace.workflows),
    vault: page('vault'),
    'workspace-variables': page('workspace-variables'),
    workspace: page('workspace'),
    'trusted-roots': page('trusted-roots'),
    'live-variables': () => flat('live-variables', 'live-variable', workspace.liveVariables),
    environments: () => {
      const byUid = environmentFiles();
      const out: WorkspaceFileNode[] = [];
      for (const environment of workspace.environments) {
        const parts = byUid.get(environment.uid) ?? [];
        for (const part of parts) left.delete(part.file);
        const node = entityNode(
          `environments:${environment.uid}`,
          { kind: 'environment', uid: environment.uid, name: environment.name },
          parts,
          [],
        );
        if (node !== null) out.push(node);
      }
      return out;
    },
    // Last: whatever no entity claimed, by directory.
    files: () => {
      const dirs = new Map<string, string[]>();
      for (const path of [...left].sort((a, b) => a.localeCompare(b))) {
        const { dir, name } = split(path);
        const names = dirs.get(dir);
        if (names) names.push(name);
        else dirs.set(dir, [name]);
      }
      const out: WorkspaceFileNode[] = [];
      for (const [dir, names] of dirs) {
        const files = names.map((name): WorkspaceFileNode => {
          const path = dir === '' ? name : `${dir}/${name}`;
          return { type: 'file', id: path, name, file: path };
        });
        if (dir === '') out.push(...files);
        else out.push({ type: 'directory', id: `dir:${dir}`, path: dir, children: files });
      }
      return out;
    },
  };

  const sections: WorkspaceFileSection[] = [];
  for (const [id, surface] of SECTIONS) {
    const nodes = nodesOf[id]();
    if (nodes.length > 0) sections.push({ id, surface, nodes });
  }
  return sections;
}

/** Every listed file in listing order, with what it belongs to. */
export function listedWorkspaceFiles(sections: readonly WorkspaceFileSection[]): ListedWorkspaceFile[] {
  const out: ListedWorkspaceFile[] = [];
  const visit = (
    surface: WorkspaceFileSurface,
    nodes: readonly WorkspaceFileNode[],
    owner: WorkspaceFileEntity | undefined,
  ): void => {
    for (const node of nodes) {
      if (node.type === 'entity') {
        if (node.file !== undefined) {
          out.push({ path: node.file, surface, entity: node.entity, name: nameOf(node.file) });
        }
        visit(surface, node.children, node.entity);
      } else if (node.type === 'directory') {
        visit(surface, node.children, undefined);
      } else if (node.type === 'part') {
        out.push({
          path: node.file,
          surface,
          ...(owner !== undefined ? { entity: owner } : {}),
          part: node.part,
          name: node.name,
        });
      } else {
        out.push({ path: node.file, surface, name: node.name });
      }
    }
  };
  for (const section of sections) visit(section.surface, section.nodes, undefined);
  return out;
}
