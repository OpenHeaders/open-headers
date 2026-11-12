/**
 * commit-conflict-tree — the files of a conflicted pass, listed as the
 * workbench lists what they belong to: by surface (the Browser
 * Interceptor, API Requests, Workflows, Variables — and Files for
 * everything that is the user's own), by the section a surface's panel
 * shows it under (RULES, TEMPLATES, REQUESTS, SPECS, …), then down the
 * collections and folders to the entity, in the panel's own order.
 *
 * A file is matched to its entity by its path: every entity of the tree
 * owns a directory, an environment and the workspace's variables one
 * file each. Only what holds a conflicted file is listed, with the
 * containers above it.
 *
 *   - an entity with one conflicted file is the row that opens it;
 *   - one with several lists them under it by the part of the entity
 *     each holds (its details, its body, a script), a part with no name
 *     of its own by its file name;
 *   - a collection or a folder lists its own parts ahead of what it
 *     holds;
 *   - a file no entity owns is listed under Files by its directory.
 *
 * Pure data: the names and the glyphs are the caller's.
 */

import { type ScriptKind, scriptKindOfFile } from '@openheaders/core/scripts';
import type { TreeNode as CoreTreeNode, FolderNode } from '@openheaders/core/types';
import {
  ENTITY_MANIFEST_FILES,
  environmentFilePath,
  environmentSecretTemplateFilePath,
  WORKSPACE_VARS_FILE,
} from '@openheaders/core/workspace-tree';

export type ConflictSurface = 'http-rules' | 'api-requests' | 'workflows' | 'variables' | 'files';

/** The surfaces in listing order — the activity bar's own, the user's files last. */
export const CONFLICT_SURFACES: readonly ConflictSurface[] = [
  'http-rules',
  'api-requests',
  'workflows',
  'variables',
  'files',
];

export type ConflictSectionId =
  | 'rules'
  | 'templates'
  | 'requests'
  | 'specs'
  | 'workflows'
  | 'workspace-variables'
  | 'live-variables'
  | 'environments'
  | 'files';

/** The sections in listing order, each under the surface whose panel shows it. */
const SECTIONS: ReadonlyArray<readonly [ConflictSectionId, ConflictSurface]> = [
  ['rules', 'http-rules'],
  ['templates', 'http-rules'],
  ['requests', 'api-requests'],
  ['specs', 'api-requests'],
  ['workflows', 'workflows'],
  ['workspace-variables', 'variables'],
  ['live-variables', 'variables'],
  ['environments', 'variables'],
  ['files', 'files'],
];

/** The part of an entity one of its files holds. */
export type ConflictPart = 'details' | 'body' | 'variables' | 'query' | 'message' | ScriptKind;

export type ConflictLeafNode = Exclude<CoreTreeNode, FolderNode>;

/** What a row stands for — enough for the caller to name and draw it as its panel does. */
export type ConflictEntity =
  | { kind: 'collection' | 'folder'; uid: string; name: string }
  | { kind: 'node'; node: ConflictLeafNode }
  | { kind: 'spec' | 'workflow' | 'live-variable' | 'environment'; uid: string; name: string }
  | { kind: 'workspace-variables' };

export type ConflictNode =
  /** `file` set: the row opens that file. Otherwise its parts and what it holds are under it. */
  | { type: 'entity'; id: string; entity: ConflictEntity; file?: string; children: ConflictNode[] }
  /** One file of an entity that lists several; `part` null = named by its file. */
  | { type: 'part'; id: string; part: ConflictPart | null; name: string; file: string }
  | { type: 'directory'; id: string; path: string; children: ConflictNode[] }
  | { type: 'file'; id: string; name: string; file: string };

export interface ConflictSection {
  id: ConflictSectionId;
  surface: ConflictSurface;
  nodes: ConflictNode[];
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
export interface ConflictWorkspace {
  ruleCollections: readonly CollectionOfNodes[];
  templateCollections: readonly CollectionOfNodes[];
  requestCollections: readonly CollectionOfNodes[];
  specs: readonly Listed[];
  workflows: readonly Listed[];
  liveVariables: readonly Listed[];
  environments: ReadonlyArray<{ uid: string; name: string }>;
}

/** One conflicted file where the tree lists it. */
export interface ListedConflictFile {
  path: string;
  surface: ConflictSurface;
  /** The entity the file belongs to; absent for one of the user's own files. */
  entity?: ConflictEntity;
  /** Set when the entity lists several files: this one's part, null = named by its file. */
  part?: ConflictPart | null;
  /** The file's name. */
  name: string;
}

function split(path: string): { dir: string; name: string } {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut), name: path.slice(cut + 1) };
}

/** The part a file of an entity's directory holds, by the name its codec writes it under. */
export function conflictPartOf(fileName: string): ConflictPart | null {
  if (ENTITY_MANIFEST_FILES.has(fileName)) return 'details';
  const script = scriptKindOfFile(fileName);
  if (script !== null) return script;
  if (/^body\.\w+$/.test(fileName)) return 'body';
  if (fileName === 'variables.json') return 'variables';
  if (fileName === 'query.graphql') return 'query';
  if (/^(message|payload)\.(json|txt)$/.test(fileName)) return 'message';
  return null;
}

/** An entity's own files as rows: the details first, then by name. */
function partsOf(names: readonly string[], pathOf: (name: string) => string): ConflictNode[] {
  return names
    .map((name) => ({ name, part: conflictPartOf(name) }))
    .sort((a, b) => Number(b.part === 'details') - Number(a.part === 'details') || a.name.localeCompare(b.name))
    .map(({ name, part }) => ({ type: 'part', id: pathOf(name), part, name, file: pathOf(name) }));
}

/** An entity's row: the file itself when it is all there is, its parts and what it holds otherwise. */
function entityNode(
  id: string,
  entity: ConflictEntity,
  files: readonly string[],
  pathOf: (name: string) => string,
  held: ConflictNode[],
): ConflictNode | null {
  if (files.length === 0 && held.length === 0) return null;
  if (files.length === 1 && held.length === 0) {
    return { type: 'entity', id, entity, file: pathOf(files[0]), children: [] };
  }
  return { type: 'entity', id, entity, children: [...partsOf(files, pathOf), ...held] };
}

export function commitConflictTree(paths: readonly string[], workspace: ConflictWorkspace): ConflictSection[] {
  const left = new Set(paths);
  const byDir = new Map<string, string[]>();
  for (const path of paths) {
    const { dir, name } = split(path);
    const names = byDir.get(dir);
    if (names) names.push(name);
    else byDir.set(dir, [name]);
  }
  /** The conflicted files in an entity's directory — claimed, so no other row lists them. */
  const claim = (dir: string): string[] => {
    const names = byDir.get(dir) ?? [];
    for (const name of names) left.delete(`${dir}/${name}`);
    return names;
  };
  const inDir = (dir: string) => (name: string) => `${dir}/${name}`;

  const walk = (section: ConflictSectionId, nodes: readonly CoreTreeNode[]): ConflictNode[] => {
    const out: ConflictNode[] = [];
    for (const node of nodes) {
      const id = `${section}:${node.uid}`;
      const built =
        node.type === 'folder'
          ? entityNode(
              id,
              { kind: 'folder', uid: node.uid, name: node.name },
              claim(node.path),
              inDir(node.path),
              walk(section, node.children),
            )
          : entityNode(id, { kind: 'node', node }, claim(node.path), inDir(node.path), []);
      if (built !== null) out.push(built);
    }
    return out;
  };

  const collections = (section: ConflictSectionId, listed: readonly CollectionOfNodes[]): ConflictNode[] => {
    const out: ConflictNode[] = [];
    for (const collection of listed) {
      const built = entityNode(
        `${section}:${collection.uid}`,
        { kind: 'collection', uid: collection.uid, name: collection.name },
        claim(collection.path),
        inDir(collection.path),
        walk(section, collection.tree),
      );
      if (built !== null) out.push(built);
    }
    return out;
  };

  const flat = (
    section: ConflictSectionId,
    kind: 'spec' | 'workflow' | 'live-variable',
    listed: readonly Listed[],
  ): ConflictNode[] => {
    const out: ConflictNode[] = [];
    for (const item of listed) {
      const built = entityNode(
        `${section}:${item.uid}`,
        { kind, uid: item.uid, name: item.name },
        claim(item.path),
        inDir(item.path),
        [],
      );
      if (built !== null) out.push(built);
    }
    return out;
  };

  /** An entity that is files of its own at fixed paths, not a directory — the first is its details. */
  const single = (id: string, entity: ConflictEntity, own: readonly string[]): ConflictNode | null => {
    const held = own.filter((path) => left.has(path));
    for (const path of held) left.delete(path);
    if (held.length === 0) return null;
    if (held.length === 1) return { type: 'entity', id, entity, file: held[0], children: [] };
    const parts = held.map(
      (path): ConflictNode => ({
        type: 'part',
        id: path,
        part: path === own[0] ? 'details' : null,
        name: split(path).name,
        file: path,
      }),
    );
    return { type: 'entity', id, entity, children: parts };
  };

  const nodesOf: Record<ConflictSectionId, () => ConflictNode[]> = {
    rules: () => collections('rules', workspace.ruleCollections),
    templates: () => collections('templates', workspace.templateCollections),
    requests: () => collections('requests', workspace.requestCollections),
    specs: () => flat('specs', 'spec', workspace.specs),
    workflows: () => flat('workflows', 'workflow', workspace.workflows),
    'workspace-variables': () => {
      const node = single('workspace-variables', { kind: 'workspace-variables' }, [WORKSPACE_VARS_FILE]);
      return node === null ? [] : [node];
    },
    'live-variables': () => flat('live-variables', 'live-variable', workspace.liveVariables),
    environments: () => {
      const out: ConflictNode[] = [];
      for (const environment of workspace.environments) {
        const node = single(
          `environments:${environment.uid}`,
          { kind: 'environment', uid: environment.uid, name: environment.name },
          [environmentFilePath(environment), environmentSecretTemplateFilePath(environment)],
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
      const out: ConflictNode[] = [];
      for (const [dir, names] of dirs) {
        const files = names.map((name): ConflictNode => {
          const path = dir === '' ? name : `${dir}/${name}`;
          return { type: 'file', id: path, name, file: path };
        });
        if (dir === '') out.push(...files);
        else out.push({ type: 'directory', id: `dir:${dir}`, path: dir, children: files });
      }
      return out;
    },
  };

  const sections: ConflictSection[] = [];
  for (const [id, surface] of SECTIONS) {
    const nodes = nodesOf[id]();
    if (nodes.length > 0) sections.push({ id, surface, nodes });
  }
  return sections;
}

/** Every conflicted file in listing order, with what it belongs to. */
export function listedConflictFiles(sections: readonly ConflictSection[]): ListedConflictFile[] {
  const out: ListedConflictFile[] = [];
  const visit = (surface: ConflictSurface, nodes: readonly ConflictNode[], owner: ConflictEntity | undefined): void => {
    for (const node of nodes) {
      if (node.type === 'entity') {
        if (node.file !== undefined) {
          out.push({ path: node.file, surface, entity: node.entity, name: split(node.file).name });
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
